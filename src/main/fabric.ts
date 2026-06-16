import http from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getSetting } from '../db/database.js';
import type {
  FabricStatus, PortStatus, AgentHealth, StandupData, MemberKpiSummary,
  PaperclipInstallStatus, PaperclipPortConfig, OrgConfig, OrgDepartment,
  AgentSkillInfo, ProjectVaultDetail, TaskFeedStatus,
} from '../shared/types.js';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_UI_PORT = 3100;
const DEFAULT_ADAPTER_PORT = 3101;
const PAPERCLIP_CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.paperclip', 'instances', 'default', 'config.json',
);

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
function runShell(cmd: string, args: string[], cwd?: string, timeoutMs = 15000): Promise<{ ok: boolean; exitCode: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
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
async function resolveRepoRoot(): Promise<string | null> {
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

/* ── G1/G8: Paperclip install detection ─────────────────── */

export async function getPaperclipInstallStatus(): Promise<PaperclipInstallStatus> {
  const result: PaperclipInstallStatus = {
    binaryFound: false,
    repoFound: false,
    configFound: false,
  };

  // Check binary
  const which = await runShell('which', ['paperclipai'], undefined, 5000);
  if (which.ok && which.output.trim()) {
    result.binaryFound = true;
    result.binaryPath = which.output.trim();
  }

  // Check repo root
  const repoRoot = await resolveRepoRoot();
  if (repoRoot) {
    result.repoFound = true;
    result.repoRoot = repoRoot;
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

/* ── G3: Read org config from manifest.yaml ─────────────── */

export async function readOrgConfig(): Promise<OrgConfig | null> {
  const repoRoot = await resolveRepoRoot();
  if (!repoRoot) return null;
  const manifestPath = path.join(repoRoot, 'manifest.yaml');
  if (!existsSync(manifestPath)) return null;

  try {
    const text = readFileSync(manifestPath, 'utf-8');
    return parseManifestYaml(text);
  } catch { return null; }
}

function parseManifestYaml(text: string): OrgConfig {
  const lines = text.split(/\r?\n/);

  const orgName = extractYamlValue(lines, 'name', 'org') || 'Unknown';
  const version = extractYamlValue(lines, 'version') || '0.0.0';
  const coordinationMethod = extractYamlValue(lines, 'method', 'coordination') || 'unknown';
  const heartbeat = extractYamlValue(lines, 'heartbeat', 'coordination') || '—';

  // Parse departments
  const departments: OrgDepartment[] = [];
  const deptKeys = ['leadership', 'science', 'engineering', 'design', 'synthesis', 'communications'];
  for (const key of deptKeys) {
    const dept = extractDepartment(lines, key);
    if (dept) departments.push(dept);
  }

  // Parse standup config
  let standup: OrgConfig['standup'] | undefined;
  const standupTime = extractYamlValue(lines, 'time', 'standup');
  const aggregator = extractYamlValue(lines, 'aggregator', 'standup');
  const dispatcher = extractYamlValue(lines, 'dispatcher', 'standup');
  if (standupTime) standup = { time: standupTime, aggregator: aggregator || '—', dispatcher: dispatcher || '—' };

  return { orgName, version, departments, coordinationMethod, heartbeat, standup };
}

function extractYamlValue(lines: string[], key: string, afterSection?: string): string | undefined {
  let inSection = !afterSection;
  for (const line of lines) {
    if (afterSection && line.trim().startsWith(`${afterSection}:`)) { inSection = true; continue; }
    if (inSection) {
      const m = line.match(new RegExp(`^\\s+${key}:\\s*"?([^"#]+)"?`));
      if (m) return m[1].trim();
    }
  }
  return undefined;
}

function extractDepartment(lines: string[], key: string): OrgDepartment | null {
  let found = false;
  let indent = 0;
  const vals: Record<string, string> = {};
  for (const line of lines) {
    if (!found) {
      const m = line.match(new RegExp(`^(\\s+)${key}:`));
      if (m) { found = true; indent = m[1].length; continue; }
    } else {
      const lineIndent = line.search(/\S/);
      if (lineIndent <= indent && line.trim()) break;
      const m = line.match(/^\s+(name|icon|lead|description):\s*"?([^"#]+)"?/);
      if (m) vals[m[1]] = m[2].trim();
    }
  }
  if (!found || !vals.name) return null;
  return { key, name: vals.name, icon: vals.icon || key, lead: vals.lead || key, description: vals.description || '' };
}

/* ── G4: Per-agent skill info ───────────────────────────── */

export async function readAgentSkills(): Promise<AgentSkillInfo[]> {
  const repoRoot = await resolveRepoRoot();
  if (!repoRoot) return [];

  const org = await readOrgConfig();
  const departments = org?.departments ?? [];

  const skillMap = readSkillRoutingMap(repoRoot);
  const result: AgentSkillInfo[] = [];

  for (const dept of departments) {
    const agentId = dept.lead;
    const skills = skillMap.get(agentId) ?? [];
    const routingTags = extractRoutingTags(repoRoot, agentId);
    result.push({
      agentId,
      agentName: titleCase(agentId),
      department: dept.name,
      skills,
      routingTags,
    });
  }

  return result;
}

function readSkillRoutingMap(repoRoot: string): Map<string, string[]> {
  const mapPath = path.join(repoRoot, 'config', 'skill-routing-map.md');
  const result = new Map<string, string[]>();
  if (!existsSync(mapPath)) return result;

  try {
    const text = readFileSync(mapPath, 'utf-8');
    let currentAgent = '';
    for (const line of text.split(/\r?\n/)) {
      const agentMatch = line.match(/^###\s+(\w+)/);
      if (agentMatch) {
        currentAgent = agentMatch[1].toLowerCase();
        continue;
      }
      if (currentAgent && line.includes('|') && !line.includes('---')) {
        const cols = line.split('|').map((c) => c.trim()).filter(Boolean);
        if (cols.length >= 1 && cols[0].startsWith('thoughtseed-')) {
          const list = result.get(currentAgent) ?? [];
          list.push(cols[0]);
          result.set(currentAgent, list);
        }
      }
    }
  } catch { /* ignore */ }
  return result;
}

function extractRoutingTags(repoRoot: string, agentId: string): string[] {
  const manifestPath = path.join(repoRoot, 'manifest.yaml');
  if (!existsSync(manifestPath)) return [];
  try {
    const text = readFileSync(manifestPath, 'utf-8');
    const lines = text.split(/\r?\n/);
    let inRouting = false;
    const tags: string[] = [];
    for (const line of lines) {
      if (line.includes('task_routing:')) { inRouting = true; continue; }
      if (inRouting) {
        if (/^\s{4}\w/.test(line) && !line.includes('task_routing')) break;
        const m = line.match(new RegExp(`->\\s*${agentId}`, 'i')) || line.match(new RegExp(`route_to:\\s*${agentId}`, 'i'));
        if (m) {
          const tagM = line.match(/tags?:\s*\[([^\]]+)\]/);
          if (tagM) tags.push(...tagM[1].split(',').map((t) => t.trim().replace(/['"]/g, '')));
        }
      }
    }
    return tags;
  } catch { return []; }
}

/* ── G5/G6: Task feed status ────────────────────────────── */

export async function getTaskFeedStatus(): Promise<TaskFeedStatus> {
  const repoRoot = await resolveRepoRoot();
  const result: TaskFeedStatus = { feedSyncConfigured: false, pendingTasks: 0 };

  if (!repoRoot) return result;

  const feedScript = path.join(repoRoot, 'scripts', 'teamforge-feed-sync.sh');
  if (existsSync(feedScript)) {
    result.feedSyncConfigured = true;
    result.feedSyncScript = feedScript;
  }

  const feedFile = path.join(repoRoot, 'MEMORY', 'teamforge-feed.json');
  if (existsSync(feedFile)) {
    result.lastFeedFile = feedFile;
    try {
      const stat = statSync(feedFile);
      result.lastFeedAt = stat.mtime.toISOString();
      const feed = JSON.parse(readFileSync(feedFile, 'utf-8'));
      if (Array.isArray(feed)) result.pendingTasks = feed.filter((t: any) => t.status === 'pending' || t.status === 'open').length;
      else if (feed?.tasks && Array.isArray(feed.tasks)) result.pendingTasks = feed.tasks.filter((t: any) => t.status === 'pending' || t.status === 'open').length;
    } catch { /* ignore */ }
  }

  return result;
}

/* ── G7: Project vault detail enrichment ────────────────── */

export async function getProjectVaultDetail(projectCode: string): Promise<ProjectVaultDetail | null> {
  const repoRoot = await resolveRepoRoot();
  if (!repoRoot) return null;

  const projectDir = path.join(repoRoot, 'vault', 'projects', projectCode);
  if (!existsSync(projectDir)) return null;

  const listDir = (sub: string) => {
    const d = path.join(projectDir, sub);
    if (!existsSync(d)) return [];
    try { return readdirSync(d).filter((f) => !f.startsWith('.')); } catch { return []; }
  };

  const contextFiles = listDir('context');
  const decisionFiles = listDir('decisions');
  const handoffFiles = listDir('handoffs');
  const inboxFiles = listDir('inbox');

  return {
    projectCode,
    contextFiles,
    decisionFiles,
    handoffFiles,
    inboxFiles,
    totalFiles: contextFiles.length + decisionFiles.length + handoffFiles.length + inboxFiles.length,
  };
}

export async function getAllProjectVaults(): Promise<ProjectVaultDetail[]> {
  const repoRoot = await resolveRepoRoot();
  if (!repoRoot) return [];

  const projectsDir = path.join(repoRoot, 'vault', 'projects');
  if (!existsSync(projectsDir)) return [];

  const dirs = readdirSync(projectsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  const results: ProjectVaultDetail[] = [];
  for (const d of dirs) {
    const detail = await getProjectVaultDetail(d.name);
    if (detail) results.push(detail);
  }
  return results;
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

  // 1. Probe ports using discovered config
  const uiProbe = await probeHttp(portCfg.host, portCfg.uiPort, '/api/status', 2000);
  const adapterProbe = await probeHttp(portCfg.host, portCfg.adapterPort, '/api/runtime/status', 3000);

  const ports: PortStatus[] = [
    { port: portCfg.uiPort, label: 'Paperclip UI', reachable: uiProbe.ok, latencyMs: uiProbe.latencyMs, lastCheckedAt: checkedAt },
    { port: portCfg.adapterPort, label: 'Runtime adapter', reachable: adapterProbe.ok, latencyMs: adapterProbe.latencyMs, lastCheckedAt: checkedAt },
  ];

  // 2. Pull agent telemetry from adapter if reachable
  let agents: AgentHealth[] = [];
  let summary: FabricStatus['summary'] = { healthy: 0, degraded: 0, uninitialized: 0, stale: 0, missingFileAgents: 0, total: 0 };

  if (adapterProbe.ok && adapterProbe.body) {
    try {
      const runtime = JSON.parse(adapterProbe.body);
      if (runtime.agents && Array.isArray(runtime.agents)) {
        agents = runtime.agents.map((a: any): AgentHealth => ({
          agentId: a.userId || a.agentId || 'unknown',
          agentName: a.userName || a.agentName || titleCase(a.userId || 'unknown'),
          department: a.department || undefined,
          role: a.role || a.title || undefined,
          status: (a.status === 'healthy' || a.status === 'stale' || a.status === 'uninitialized') ? a.status : 'uninitialized',
          lastCycle: a.lastCycle || null,
          outcome: a.outcome || null,
          steps: typeof a.steps === 'number' ? a.steps : 0,
          blocked: typeof a.blocked === 'number' ? a.blocked : 0,
          missingFiles: typeof a.missingFiles === 'number' ? a.missingFiles : 0,
          staleSeconds: typeof a.ageSeconds === 'number' ? a.ageSeconds : undefined,
        }));
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
    const repoRoot = await resolveRepoRoot();
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

  // 3. Bridge status (MultiCA endpoint reachable via adapter)
  let bridgeReachable = false;
  let bridgeMessage: string | undefined;
  if (adapterProbe.ok) {
    const bridgeProbe = await probeHttp(portCfg.host, portCfg.adapterPort, '/api/bridge/status', 2000);
    bridgeReachable = bridgeProbe.ok;
    bridgeMessage = bridgeProbe.ok ? 'MultiCA bridge reachable' : 'MultiCA bridge not responding';
  } else {
    bridgeMessage = 'Runtime adapter offline — cannot reach bridge';
  }

  // 4. Vault counts
  const repoRoot = await resolveRepoRoot();
  const standups = repoRoot ? countMdFiles(path.join(repoRoot, 'vault', 'standups')) : 0;
  const handoffs = repoRoot ? countMdFiles(path.join(repoRoot, 'vault', 'handoffs')) : 0;

  const standup = repoRoot ? readTodayStandup(repoRoot) : undefined;
  const kpi = await fetchMemberKpi();

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

  // G3: Org config
  const org = await readOrgConfig();

  // G5/G6: Task feed
  const taskFeed = await getTaskFeedStatus();

  return {
    checkedAt,
    ports,
    agents,
    summary,
    bridge: { reachable: bridgeReachable, message: bridgeMessage },
    vault: { standups, handoffs },
    shellHealthCheck,
    standup,
    kpi,
    install,
    org: org ?? undefined,
    taskFeed,
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
