import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getSetting } from '../db/database.js';
import type {
  FabricStatus, PortStatus, AgentHealth, StandupData, MemberKpiSummary,
  PaperclipInstallStatus, PaperclipPortConfig,
} from '../shared/types.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_UI_PORT = 3100;
const DEFAULT_ADAPTER_PORT = 3101;
const PAPERCLIP_CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.paperclip', 'instances', 'default', 'config.json',
);

type PaperclipApiCompany = {
  id?: string;
  name?: string;
  description?: string | null;
  issuePrefix?: string;
  metadata?: Record<string, unknown> | null;
};

type PaperclipApiAgent = {
  id?: string;
  name?: string;
  role?: string | null;
  title?: string | null;
  status?: string | null;
  lastHeartbeatAt?: string | null;
  runtimeConfig?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type ResolvedPaperclipCompany = {
  id: string | null;
  name: string | null;
  issuePrefix: string | null;
  selectionSource: 'configured' | 'thoughtseed_default' | 'first_available' | 'unknown';
  thoughtseedOrg: boolean | null;
  testCompany: boolean | null;
  writesAllowed: boolean;
  reason: string;
};

/* ── Low-level HTTP probe (no external deps) ─────────────── */
function probeHttp(host: string, port: number, path: string, timeoutMs = 3000): Promise<{ ok: boolean; latencyMs: number; body?: string; status?: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const req = http.request({ host, port, path, method: 'GET', timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        resolve({ ok: res.statusCode === 200, latencyMs: Date.now() - start, body: data, status: res.statusCode });
      });
    });
    req.on('error', () => resolve({ ok: false, latencyMs: Date.now() - start }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, latencyMs: timeoutMs }); });
    req.end();
  });
}

/* ── Shell helper ──────────────────────────────────────────── */
function runShell(cmd: string, args: string[], cwd?: string, timeoutMs = 15000, env: NodeJS.ProcessEnv = process.env): Promise<{ ok: boolean; exitCode: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result: { ok: boolean; exitCode: number | null; output: string }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ ok: false, exitCode: null, output: [stdout.trim(), stderr.trim(), `Timed out after ${timeoutMs}ms`].filter(Boolean).join('\n') });
    }, timeoutMs);
    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (err) => finish({ ok: false, exitCode: null, output: String(err) }));
    child.on('close', (code) => finish({ ok: code === 0, exitCode: code, output: [stdout.trim(), stderr.trim()].filter(Boolean).join('\n') }));
  });
}

/* ── Count markdown files in a directory (1 level) ─────────── */
function countMdFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md')).length;
  } catch { return 0; }
}

/* ── Resolve Paperclip repo root ─────────────────────────── */
export async function resolveRepoRoot(): Promise<string | null> {
  // 1. Provisioned repo root from Worker (Phase 7 — email-only, no device secrets)
  const provisioned = await getSetting('tf.paperclipRepoRoot');
  if (provisioned && existsSync(path.join(provisioned, 'manifest.yaml'))) return provisioned;

  // 2. Try the sibling repo layout (common in our workspace)
  const sibling = path.resolve(process.cwd(), '..', 'thoughtseed-paperclip');
  if (existsSync(path.join(sibling, 'manifest.yaml'))) return sibling;

  // 3. Try env override
  const envRoot = process.env.PAPERCLIP_REPO_ROOT;
  if (envRoot && existsSync(path.join(envRoot, 'manifest.yaml'))) return envRoot;

  // 4. Try home
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    const homeCandidate = path.join(home, 'thoughtseed-paperclip');
    if (existsSync(path.join(homeCandidate, 'manifest.yaml'))) return homeCandidate;
  }
  return null;
}

function readEnvValue(filePath: string, key: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const text = readFileSync(filePath, 'utf-8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [rawKey, ...rest] = line.split('=');
      if (rawKey.trim() !== key) continue;
      return rest.join('=').trim().replace(/^['"]|['"]$/g, '') || null;
    }
  } catch { /* ignore */ }
  return null;
}

async function resolvePaperclipCompanyId(repoRoot: string | null): Promise<string | null> {
  const configured = await getSetting('tf.paperclipCompanyId');
  if (configured?.trim()) return configured.trim();
  if (process.env.PAPERCLIP_COMPANY_ID?.trim()) return process.env.PAPERCLIP_COMPANY_ID.trim();
  if (repoRoot) {
    const repoEnvCompanyId = readEnvValue(path.join(repoRoot, '.env'), 'PAPERCLIP_COMPANY_ID');
    if (repoEnvCompanyId) return repoEnvCompanyId;
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readHeartbeatConfig(agent: PaperclipApiAgent): { enabled: boolean; intervalSec: number } {
  const runtime = isObject(agent.runtimeConfig) ? agent.runtimeConfig : {};
  const heartbeat = isObject(runtime.heartbeat) ? runtime.heartbeat : {};
  const intervalSec = typeof heartbeat.intervalSec === 'number' && Number.isFinite(heartbeat.intervalSec)
    ? heartbeat.intervalSec
    : 1800;
  return { enabled: heartbeat.enabled === true, intervalSec };
}

function normalizePaperclipAgentStatus(agent: PaperclipApiAgent): AgentHealth['status'] {
  const status = String(agent.status ?? '').toLowerCase();
  const heartbeat = readHeartbeatConfig(agent);
  if (status === 'pending_approval' || status === 'paused' || status === 'terminated') return 'uninitialized';
  if (!agent.lastHeartbeatAt) return heartbeat.enabled ? 'uninitialized' : 'healthy';
  if (heartbeat.enabled) {
    const elapsedSeconds = Math.floor((Date.now() - Date.parse(agent.lastHeartbeatAt)) / 1000);
    if (Number.isFinite(elapsedSeconds) && elapsedSeconds > heartbeat.intervalSec * 2) return 'stale';
  }
  return 'healthy';
}

function paperclipAgentToHealth(agent: PaperclipApiAgent): AgentHealth {
  const heartbeat = readHeartbeatConfig(agent);
  const lastCycle = nonEmptyText(agent.lastHeartbeatAt);
  return {
    agentId: nonEmptyText(agent.id) ?? nonEmptyText(agent.name) ?? 'paperclip-agent',
    agentName: nonEmptyText(agent.name) ?? 'Paperclip agent',
    department: nonEmptyText(agent.metadata?.department) ?? undefined,
    role: nonEmptyText(agent.title) ?? nonEmptyText(agent.role) ?? undefined,
    status: normalizePaperclipAgentStatus(agent),
    lastCycle,
    outcome: agent.status ? `paperclip:${agent.status}` : null,
    steps: 0,
    blocked: 0,
    missingFiles: 0,
    staleSeconds: heartbeat.enabled && lastCycle ? Math.max(0, Math.floor((Date.now() - Date.parse(lastCycle)) / 1000)) : undefined,
  };
}

function summarizeAgents(agents: AgentHealth[]): FabricStatus['summary'] {
  return {
    healthy: agents.filter((a) => a.status === 'healthy').length,
    degraded: 0,
    uninitialized: agents.filter((a) => a.status === 'uninitialized').length,
    stale: agents.filter((a) => a.status === 'stale').length,
    missingFileAgents: agents.filter((a) => a.missingFiles > 0).length,
    total: agents.length,
  };
}

async function fetchPaperclipJson<T>(host: string, port: number, apiPath: string, timeoutMs = 3000): Promise<T | null> {
  const probe = await probeHttp(host, port, apiPath, timeoutMs);
  if (!probe.ok || !probe.body) return null;
  try {
    return JSON.parse(probe.body) as T;
  } catch {
    return null;
  }
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function classifyCompanySafety(input: {
  id: string | null;
  name: string | null;
  description?: string | null;
  issuePrefix: string | null;
  metadata?: Record<string, unknown> | null;
  selectionSource: ResolvedPaperclipCompany['selectionSource'];
}): ResolvedPaperclipCompany {
  const normalizedName = input.name?.toLowerCase() ?? '';
  const normalizedDescription = input.description?.toLowerCase() ?? '';
  const normalizedPrefix = input.issuePrefix?.toLowerCase() ?? '';
  const thoughtseedOrg = normalizedName.includes('thoughtseed') || normalizedPrefix === 'tho';
  const metadataText = input.metadata
    ? Object.entries(input.metadata)
      .map(([key, value]) => `${key}:${String(value)}`)
      .join(' ')
      .toLowerCase()
    : '';
  const markerText = `${normalizedName} ${normalizedDescription} ${normalizedPrefix} ${metadataText}`;
  const explicitTestMarker = /\b(test|disposable|sandbox|smoke|fixture|nonprod|non-production|qa|temp|temporary)\b/.test(markerText)
    || ['tst', 'test', 'qa', 'tmp', 'smk'].includes(normalizedPrefix);
  const testCompany = input.id ? explicitTestMarker && !thoughtseedOrg : null;
  const writesAllowed = Boolean(testCompany);
  const reason = !input.id
    ? 'No Paperclip company selected yet; writes stay blocked.'
    : writesAllowed
      ? 'Explicit disposable/test Paperclip company selected; employee test-mode writes are allowed.'
      : thoughtseedOrg
        ? 'Thoughtseed org detected; writes require one-time guarded override.'
        : 'Paperclip company lacks an explicit disposable/test marker; writes stay blocked.';
  return {
    id: input.id,
    name: input.name,
    issuePrefix: input.issuePrefix,
    selectionSource: input.selectionSource,
    thoughtseedOrg: input.id ? thoughtseedOrg : null,
    testCompany,
    writesAllowed,
    reason,
  };
}

async function fetchPaperclipApiSnapshot(
  portCfg: PaperclipPortConfig,
  preferredCompanyId: string | null,
): Promise<{ agents: AgentHealth[]; company: ResolvedPaperclipCompany }> {
  const companies = await fetchPaperclipJson<PaperclipApiCompany[]>(portCfg.host, portCfg.uiPort, '/api/companies', 3000);
  if (!Array.isArray(companies) || companies.length === 0) {
    return {
      agents: [],
      company: classifyCompanySafety({
        id: null,
        name: null,
        description: null,
        issuePrefix: null,
        metadata: null,
        selectionSource: 'unknown',
      }),
    };
  }
  const configuredMatch = preferredCompanyId
    ? companies.find((row) => row.id === preferredCompanyId)
    : null;
  const thoughtseedDefault = companies.find((row) => row.issuePrefix === 'THO' || row.name === 'Thoughtseed Labs');
  const selected = configuredMatch ?? thoughtseedDefault ?? companies[0];
  const selectedId = textOrNull(selected?.id);
  const selectedName = textOrNull(selected?.name);
  const selectedPrefix = textOrNull(selected?.issuePrefix);
  const selectedDescription = textOrNull(selected?.description);
  const selectionSource: ResolvedPaperclipCompany['selectionSource'] = configuredMatch
    ? 'configured'
    : thoughtseedDefault && thoughtseedDefault.id === selected?.id
      ? 'thoughtseed_default'
      : 'first_available';
  const company = classifyCompanySafety({
    id: selectedId,
    name: selectedName,
    description: selectedDescription,
    issuePrefix: selectedPrefix,
    metadata: isObject(selected?.metadata) ? selected.metadata : null,
    selectionSource,
  });
  if (!selectedId) return { agents: [], company };
  const agents = await fetchPaperclipJson<PaperclipApiAgent[]>(
    portCfg.host,
    portCfg.uiPort,
    `/api/companies/${selectedId}/agents`,
    3000,
  );
  return { agents: Array.isArray(agents) ? agents.map(paperclipAgentToHealth) : [], company };
}

/* ── G1/G8: Paperclip install detection ─────────────────── */

export async function getPaperclipInstallStatus(): Promise<PaperclipInstallStatus> {
  const result: PaperclipInstallStatus = {
    binaryFound: false,
    configFound: false,
  };

  // Check binary. Packaged macOS apps inherit a minimal GUI PATH (no /opt/homebrew,
  // /usr/local, ~/.local), so `which` alone misses Homebrew/user installs. Check the
  // common locations directly first, then fall back to `which` with an augmented PATH.
  const installHome = process.env.HOME || process.env.USERPROFILE || '';
  const knownBins = [
    '/opt/homebrew/bin/paperclipai',
    '/usr/local/bin/paperclipai',
    installHome && path.join(installHome, '.local', 'bin', 'paperclipai'),
    installHome && path.join(installHome, '.bun', 'bin', 'paperclipai'),
  ].filter(Boolean) as string[];
  const directHit = knownBins.find((p) => existsSync(p));
  if (directHit) {
    result.binaryFound = true;
    result.binaryPath = directHit;
  } else {
    const augmentedPath = [process.env.PATH, '/opt/homebrew/bin', '/usr/local/bin', installHome && path.join(installHome, '.local', 'bin')]
      .filter(Boolean)
      .join(':');
    const which = await runShell('which', ['paperclipai'], undefined, 5000, { ...process.env, PATH: augmentedPath });
    if (which.ok && which.output.trim()) {
      result.binaryFound = true;
      result.binaryPath = which.output.trim();
    }
  }

  // Check config.json for port info
  const portCfg = readPortConfig();
  if (portCfg.source === 'config.json') {
    result.configFound = true;
    result.serverPort = portCfg.uiPort;
    result.serverHost = portCfg.host;
    result.adapterPort = portCfg.adapterPort;
  }

  return result;
}

/* ── G2: Dynamic port discovery ─────────────────────────── */

function readPortConfig(): PaperclipPortConfig {
  try {
    if (existsSync(PAPERCLIP_CONFIG_PATH)) {
      const raw = readFileSync(PAPERCLIP_CONFIG_PATH, 'utf-8');
      const cfg = JSON.parse(raw);
      const host = cfg?.server?.host || DEFAULT_HOST;
      const uiPort = typeof cfg?.server?.port === 'number' ? cfg.server.port : DEFAULT_UI_PORT;
      return { host, uiPort, adapterPort: uiPort + 1, source: 'config.json' };
    }
  } catch { /* fall through */ }
  return { host: DEFAULT_HOST, uiPort: DEFAULT_UI_PORT, adapterPort: DEFAULT_ADAPTER_PORT, source: 'default' };
}

/* ── Read today's standup from vault ─────────────────────── */

function readTodayStandup(repoRoot: string): StandupData | undefined {
  const today = new Date().toISOString().slice(0, 10);
  const standupDir = path.join(repoRoot, 'vault', 'standups');
  if (!existsSync(standupDir)) return undefined;
  // Look for files named <member>-<date>.md or <date>-*.md
  const files = readdirSync(standupDir).filter((f) => f.endsWith('.md'));
  // Try member-specific first, then any for today
  const memberId = process.env.PAPERCLIP_MEMBER_ID || 'default';
  const memberFile = files.find((f) => f.includes(`${memberId}-${today}`) || f.startsWith(`${today}-`));
  if (!memberFile) return undefined;
  try {
    const text = readFileSync(path.join(standupDir, memberFile), 'utf-8');
    // Simple parsing: look for ## Yesterday, ## Today, ## Blockers
    const yesterday = extractSection(text, 'Yesterday', 'Previous', 'Completed');
    const todayPlan = extractSection(text, 'Today', 'Plan', 'Working on');
    const blockers = extractSection(text, 'Blockers', 'Blocked', 'Impediments');
    return { date: today, yesterday, today: todayPlan, blockers, source: 'vault' };
  } catch { return undefined; }
}

function extractSection(text: string, ...headers: string[]): string {
  const lines = text.split(/\r?\n/);
  let capturing = false;
  const out: string[] = [];
  for (const line of lines) {
    const headerMatch = headers.some((h) => line.toLowerCase().startsWith(`## ${h.toLowerCase()}`));
    if (headerMatch) { capturing = true; continue; }
    if (capturing && line.startsWith('## ')) break;
    if (capturing && line.trim()) out.push(line.trim());
  }
  return out.slice(0, 3).join(' · ') || '—';
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/* ── Fetch KPI from Worker ──────────────────────────────── */
async function fetchMemberKpi(): Promise<MemberKpiSummary | undefined> {
  try {
    const { getMemberKpiSummary } = await import('./teamforge.js');
    const res = await getMemberKpiSummary();
    if (res.ok && res.data) {
      return {
        todaySeconds: res.data.todaySeconds ?? 0,
        weekSeconds: res.data.weekSeconds ?? 0,
        projectBreakdown: res.data.projectBreakdown ?? {},
        standupCompliant: res.data.standupCompliant ?? false,
      };
    }
  } catch { /* ignore */ }
  return undefined;
}

/* ── Main public API ─────────────────────────────────────── */
export async function getFabricStatus(): Promise<FabricStatus> {
  const checkedAt = new Date().toISOString();

  // G2: Dynamic port discovery
  const portCfg = readPortConfig();
  const repoRoot = await resolveRepoRoot();
  const preferredCompanyId = await resolvePaperclipCompanyId(repoRoot);

  // 1. Probe ports using discovered config
  let uiProbe = await probeHttp(portCfg.host, portCfg.uiPort, '/api/health', 2000);
  if (!uiProbe.ok) {
    uiProbe = await probeHttp(portCfg.host, portCfg.uiPort, '/api/status', 2000);
  }
  const adapterProbe = await probeHttp(portCfg.host, portCfg.adapterPort, '/api/runtime/status', 3000);

  const ports: PortStatus[] = [
    { port: portCfg.uiPort, label: 'Paperclip API', reachable: uiProbe.ok, latencyMs: uiProbe.latencyMs, lastCheckedAt: checkedAt },
    { port: portCfg.adapterPort, label: 'Runtime adapter optional', reachable: adapterProbe.ok, latencyMs: adapterProbe.latencyMs, lastCheckedAt: checkedAt },
  ];

  // 2. Pull Paperclip company agents from the primary 3100 API first. The
  // adapter remains an optional compatibility path, not the employee source of truth.
  let agents: AgentHealth[] = [];
  let summary: FabricStatus['summary'] = { healthy: 0, degraded: 0, uninitialized: 0, stale: 0, missingFileAgents: 0, total: 0 };
  let safety = classifyCompanySafety({
    id: preferredCompanyId,
    name: null,
    description: null,
    issuePrefix: null,
    metadata: null,
    selectionSource: preferredCompanyId ? 'configured' : 'unknown',
  });

  if (uiProbe.ok) {
    const apiSnapshot = await fetchPaperclipApiSnapshot(portCfg, preferredCompanyId);
    agents = apiSnapshot.agents;
    safety = apiSnapshot.company;
    if (agents.length > 0) {
      summary = summarizeAgents(agents);
    }
  }

  if (agents.length === 0 && adapterProbe.ok && adapterProbe.body) {
    try {
      const runtime = JSON.parse(adapterProbe.body);
      if (runtime.agents && Array.isArray(runtime.agents)) {
        agents = runtime.agents.flatMap((a: any): AgentHealth[] => {
          const agentId = nonEmptyText(a.userId) ?? nonEmptyText(a.agentId);
          if (!agentId) return [];
          const agentName = nonEmptyText(a.userName) ?? nonEmptyText(a.agentName) ?? titleCase(agentId);
          return [{
            agentId,
            agentName,
            department: nonEmptyText(a.department) ?? undefined,
            role: nonEmptyText(a.role) ?? nonEmptyText(a.title) ?? undefined,
            status: (a.status === 'healthy' || a.status === 'stale' || a.status === 'uninitialized') ? a.status : 'uninitialized',
            lastCycle: nonEmptyText(a.lastCycle),
            outcome: nonEmptyText(a.outcome),
            steps: typeof a.steps === 'number' ? a.steps : 0,
            blocked: typeof a.blocked === 'number' ? a.blocked : 0,
            missingFiles: typeof a.missingFiles === 'number' ? a.missingFiles : 0,
            staleSeconds: typeof a.ageSeconds === 'number' ? a.ageSeconds : undefined,
          }];
        });
      }
      if (runtime.summary && typeof runtime.summary === 'object') {
        summary = {
          healthy: runtime.summary.healthy || 0,
          degraded: runtime.summary.degraded || 0,
          uninitialized: runtime.summary.uninitialized || 0,
          stale: runtime.summary.stale || 0,
          missingFileAgents: runtime.summary.missingFileAgents || 0,
          total: runtime.summary.total || agents.length,
        };
      }
    } catch {
      // ignore JSON parse errors
    }
  }

  // Fallback: if adapter is down but repo root is known, do a minimal file-based scan
  if (agents.length === 0) {
    if (repoRoot) {
      agents = await fileBasedAgentScan(repoRoot);
      summary = {
        healthy: 0,
        degraded: 0,
        uninitialized: agents.filter((a) => a.status === 'uninitialized').length,
        stale: 0,
        missingFileAgents: agents.filter((a) => a.missingFiles > 0).length,
        total: agents.length,
      };
    }
  }

  // 3. Paperclip bridge status (local adapter sidecar)
  let bridgeReachable = false;
  let bridgeMessage: string | undefined;
  if (adapterProbe.ok) {
    const bridgeProbe = await probeHttp(portCfg.host, portCfg.adapterPort, '/api/bridge/status', 2000);
    bridgeReachable = bridgeProbe.ok;
    bridgeMessage = bridgeProbe.ok ? 'Paperclip bridge reachable' : 'Paperclip bridge not responding';
  } else {
    bridgeReachable = uiProbe.ok;
    bridgeMessage = uiProbe.ok
      ? 'Paperclip API reachable; bridge sidecar not exposed on this server'
      : 'Paperclip API and runtime adapter are offline';
  }

  // 4. Vault counts
  const standups = repoRoot ? countMdFiles(path.join(repoRoot, 'vault', 'standups')) : 0;
  const handoffs = repoRoot ? countMdFiles(path.join(repoRoot, 'vault', 'handoffs')) : 0;

  const paperclipStandup = repoRoot ? readTodayStandup(repoRoot) : undefined;
  const kpi = await fetchMemberKpi();
  const dailyProofReady = Boolean(kpi?.standupCompliant);

  // 5. Shell health-check.sh (best-effort)
  let shellHealthCheck: FabricStatus['shellHealthCheck'] | undefined;
  if (repoRoot) {
    const script = path.join(repoRoot, 'scripts', 'health-check.sh');
    if (existsSync(script)) {
      const result = await runShell('bash', [script], repoRoot, 20000);
      shellHealthCheck = { ok: result.ok, exitCode: result.exitCode, output: result.output };
    }
  }

  // G1/G8: Install detection
  const install = await getPaperclipInstallStatus();

  return {
    checkedAt,
    ports,
    agents,
    summary,
    bridge: { reachable: bridgeReachable, message: bridgeMessage },
    safety: {
      mode: 'strict_with_guarded_override',
      targetCompanyId: safety.id,
      targetCompanyName: safety.name,
      targetCompanyPrefix: safety.issuePrefix,
      selectionSource: safety.selectionSource,
      thoughtseedOrg: safety.thoughtseedOrg,
      testCompany: safety.testCompany,
      writesAllowed: safety.writesAllowed,
      reason: safety.reason,
    },
    vault: { standups, handoffs },
    dailyProof: {
      ready: dailyProofReady,
      source: kpi ? 'assistant_worker' : 'assistant_local_queue',
      label: dailyProofReady ? 'assistant proof ready' : 'assistant proof needed',
      message: kpi
        ? 'Worker/KPI status is the primary daily proof signal.'
        : 'Assistant daily proof can queue locally; Paperclip standups are optional enrichment only.',
    },
    optionalHelperProof: {
      paperclipStandup,
      paperclipStandupCount: standups,
      handoffCount: handoffs,
      message: 'Paperclip vault standups are optional enrichment and do not gate assistant daily readiness.',
    },
    shellHealthCheck,
    standup: undefined,
    kpi,
    install,
  };
}

/* ── Best-effort file-based agent scan (no adapter) ───────── */
async function fileBasedAgentScan(repoRoot: string): Promise<AgentHealth[]> {
  const agentsDir = path.join(repoRoot, 'agents');
  if (!existsSync(agentsDir)) return [];
  const dirs = readdirSync(agentsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const out: AgentHealth[] = [];
  for (const d of dirs) {
    const agentDir = path.join(agentsDir, d.name);
    const required = ['MANIFEST.yaml', 'IDENTITY.md', 'SOUL.md', 'CONTEXT.md', 'TASKS.md', 'INBOX.md', 'HEARTBEAT.md', 'AGENTS.md'];
    let missing = 0;
    for (const f of required) {
      if (!existsSync(path.join(agentDir, f))) missing++;
    }
    let lastCycle: string | null = null;
    let outcome: string | null = null;
    const hb = path.join(agentDir, 'HEARTBEAT.md');
    if (existsSync(hb)) {
      try {
        const { readFileSync } = await import('node:fs');
        const text = readFileSync(hb, 'utf-8');
        const lines = text.split(/\r?\n/).filter((l) => /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(l));
        const last = lines[lines.length - 1];
        if (last) {
          const tsMatch = last.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?)/);
          if (tsMatch) lastCycle = tsMatch[1];
          const outMatch = last.match(/\|\s*(completed|blocked|failed|timeout|idle)\s*\|/i);
          if (outMatch) outcome = outMatch[1].toLowerCase();
        }
      } catch { /* ignore */ }
    }
    out.push({
      agentId: d.name,
      agentName: titleCase(d.name),
      status: missing > 0 || !lastCycle ? 'uninitialized' : 'healthy',
      lastCycle,
      outcome,
      steps: 0,
      blocked: 0,
      missingFiles: missing,
    });
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}
