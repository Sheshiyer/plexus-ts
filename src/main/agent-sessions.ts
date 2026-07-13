import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AgentSessionCandidate,
  AgentSessionAcceptInput,
  AgentSessionProvider,
  AgentSessionScanResult,
  Project,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskHistoryEvent,
  TimeEntry,
} from '../shared/types.js';
import { hasVerifiedGitHubRepository } from '../shared/github-repository-authority.js';
import {
  getAgentSessionCandidate,
  getFabricTask,
  getProject,
  getSetting,
  insertEntryAndAcceptAgentSession,
  listAgentSessionCandidates,
  listProjects,
  summarizeAgentSessionCandidates,
  updateAgentSessionCandidate,
  upsertFabricTask,
  upsertAgentSessionCandidates,
} from '../db/database.js';

const MAX_DEPTH = 6;
const MAX_FILES_PER_PROVIDER = 120;
const MAX_DISCOVERED_PER_PROVIDER = 600;
const MAX_SAMPLE_BYTES = 256 * 1024;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILE_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_SESSION_SECONDS = 15 * 60;
const DEFAULT_SESSION_SECONDS = 30 * 60;
const MAX_SESSION_SECONDS = 4 * 60 * 60;
const SESSION_EXTENSIONS = new Set(['.json', '.jsonl', '.log', '.md', '.txt']);
const SKIPPED_DIRS = new Set(['node_modules', '.git', 'Cache', 'CachedData', 'GPUCache', 'Code Cache']);

type SessionRoot = AgentSessionScanResult['roots'][number];

interface SessionWindow {
  startedAt: Date;
  endedAt: Date;
  confidenceReasons: string[];
}

function providerRoots(): { provider: AgentSessionProvider; path: string }[] {
  const home = os.homedir();
  return [
    { provider: 'codex', path: path.join(home, '.codex', 'sessions') },
    { provider: 'claude', path: path.join(home, '.claude', 'projects') },
    { provider: 'claude', path: path.join(home, 'Library', 'Application Support', 'Claude') },
    { provider: 'cursor', path: path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'workspaceStorage') },
    { provider: 'opencode', path: path.join(home, '.local', 'share', 'opencode') },
    { provider: 'opencode', path: path.join(home, '.opencode') },
  ];
}

function rootStatus(): SessionRoot[] {
  return providerRoots().map((root) => ({
    provider: root.provider,
    path: root.path,
    exists: existsSync(root.path),
  }));
}

async function scanEnabled(): Promise<boolean> {
  return (await getSetting('agentSessionScanEnabled')) === 'true';
}

export async function agentSessionStatus(): Promise<AgentSessionScanResult> {
  const enabled = await scanEnabled();
  const [candidates, summary] = await Promise.all([
    listAgentSessionCandidates('pending', 100),
    summarizeAgentSessionCandidates(),
  ]);
  return {
    ok: true,
    enabled,
    scanned: 0,
    imported: 0,
    ...summary,
    candidates,
    roots: rootStatus(),
    message: enabled ? undefined : 'Local agent session scanning is off.',
  };
}

export async function scanAgentSessions(): Promise<AgentSessionScanResult> {
  const enabled = await scanEnabled();
  const roots = rootStatus();
  if (!enabled) {
    return {
      ok: true,
      enabled: false,
      scanned: 0,
      imported: 0,
      ...(await summarizeAgentSessionCandidates()),
      candidates: await listAgentSessionCandidates('pending', 100),
      roots,
      message: 'Local agent session scanning is off.',
    };
  }

  const projects = await listProjects();
  const candidates: AgentSessionCandidate[] = [];
  for (const root of roots.filter((item) => item.exists)) {
    const files = await collectSessionFiles(root.provider, root.path);
    for (const filePath of files) {
      const candidate = await buildCandidate(root.provider, filePath, projects).catch(() => null);
      if (candidate) candidates.push(candidate);
    }
  }

  const imported = await upsertAgentSessionCandidates(candidates);
  const [pending, summary] = await Promise.all([
    listAgentSessionCandidates('pending', 100),
    summarizeAgentSessionCandidates(),
  ]);
  return {
    ok: true,
    enabled: true,
    scanned: candidates.length,
    imported,
    ...summary,
    candidates: pending,
    roots,
    message: candidates.length === 0 ? 'No recent local agent sessions found.' : undefined,
  };
}

function normalizeAcceptInput(input: AgentSessionAcceptInput): { candidateId: string; taskId?: string } {
  return typeof input === 'string' ? { candidateId: input } : input;
}

function fabricPayloadHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload, Object.keys(payload).sort())).digest('hex');
}

async function attachAcceptedSessionToTask(
  taskId: string | undefined,
  candidate: AgentSessionCandidate,
  entry: TimeEntry,
): Promise<void> {
  if (!taskId) return;
  const task = await getFabricTask(taskId);
  if (!task) throw new Error('Dispatch task was not found for this agent session.');
  if (task.projectId && task.projectId !== entry.projectId) {
    throw new Error('Agent session project does not match the dispatch task project.');
  }

  const now = new Date().toISOString();
  const evidenceId = `agent_session_${candidate.id}_${entry.id}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const evidenceExists = task.evidence.some((item) => item.id === evidenceId || item.value === `agent-session:${candidate.id}`);
  const payload = {
    candidateId: candidate.id,
    provider: candidate.provider,
    createdEntryId: entry.id,
    projectId: entry.projectId,
    status: 'review_pending',
  };
  const event: ThoughtseedFabricTaskHistoryEvent = {
    eventId: `agent_session_${candidate.id}_accepted`,
    timestamp: now,
    actor: 'plexus',
    source: 'manual',
    type: 'candidate_review_pending',
    payloadHash: fabricPayloadHash(payload),
    payload,
    correlationId: task.correlationId,
  };
  const historyExists = task.history.some((item) => item.eventId === event.eventId);
  const updated: ThoughtseedFabricTask = {
    ...task,
    workEntryId: task.workEntryId ?? entry.id,
    evidence: evidenceExists ? task.evidence : [
      ...task.evidence,
      {
        id: evidenceId,
        type: 'note',
        value: `agent-session:${candidate.id}`,
        label: `Agent session: ${candidate.title}`,
        source: 'manual',
        strength: 'weak_evidence',
        status: 'review_pending',
        addedAt: now,
      },
    ],
    history: historyExists ? task.history : [...task.history, event],
    updatedAt: now,
  };
  await upsertFabricTask(updated);
}

export async function acceptAgentSession(input: AgentSessionAcceptInput): Promise<TimeEntry> {
  const { candidateId, taskId } = normalizeAcceptInput(input);
  const candidate = await getAgentSessionCandidate(candidateId);
  if (!candidate) throw new Error('Agent session suggestion not found.');
  if (candidate.status === 'accepted') throw new Error('Agent session suggestion was already accepted.');
  if (!candidate.projectId) {
    throw new Error('Link this session to a verified project before creating a work record.');
  }

  const project = await getProject(candidate.projectId);
  if (!project || !hasVerifiedRepo(project)) {
    const name = project?.name || candidate.projectName || 'Project';
    throw new Error(`${name} needs a verified GitHub repo before Plexus can create this work record.`);
  }

  const startedAt = safeDate(candidate.startedAt, new Date(Date.now() - MIN_SESSION_SECONDS * 1000));
  let endedAt = safeDate(candidate.endedAt, new Date());
  if (endedAt.getTime() <= startedAt.getTime()) {
    endedAt = new Date(startedAt.getTime() + MIN_SESSION_SECONDS * 1000);
  }

  const entry: TimeEntry = {
    id: randomUUID(),
    projectId: project.id,
    description: `Agent session: ${candidate.title}`,
    startTime: startedAt.toISOString(),
    endTime: endedAt.toISOString(),
    durationSeconds: Math.max(MIN_SESSION_SECONDS, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)),
    pausedSeconds: 0,
    tags: ['agent-session', candidate.provider],
    source: 'manual',
    githubRepoUrl: project.githubRepoUrl,
    githubRepoFullName: project.githubRepoFullName,
    evidenceStatus: 'pending',
    evidenceCheckedAt: null,
    githubActivityIds: [],
  };
  await insertEntryAndAcceptAgentSession(entry, candidate.id, {
    status: 'accepted',
    createdEntryId: entry.id,
    projectId: project.id,
    projectName: project.name,
  });
  await attachAcceptedSessionToTask(taskId, candidate, entry);
  return entry;
}

export async function dismissAgentSession(candidateId: string): Promise<void> {
  await updateAgentSessionCandidate(candidateId, { status: 'dismissed' });
}

async function collectSessionFiles(provider: AgentSessionProvider, rootPath: string): Promise<string[]> {
  const files: { path: string; mtimeMs: number }[] = [];
  const deadline = Date.now() - MAX_FILE_AGE_MS;

  async function walk(dir: string, depth: number) {
    if (depth > MAX_DEPTH || files.length >= MAX_DISCOVERED_PER_PROVIDER) return;
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (files.length >= MAX_DISCOVERED_PER_PROVIDER) return;
      if (entry.name.startsWith('.') && depth > 0) continue;
      const next = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) await walk(next, depth + 1);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!isSessionFile(provider, next)) continue;
      try {
        const stat = await fs.stat(next);
        if (stat.size <= 0 || stat.size > MAX_FILE_BYTES) continue;
        if (stat.mtimeMs < deadline) continue;
        files.push({ path: next, mtimeMs: stat.mtimeMs });
      } catch {
        // Ignore files that disappear or are unreadable during a scan.
      }
    }
  }

  await walk(rootPath, 0);
  return files
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_FILES_PER_PROVIDER)
    .map((file) => file.path);
}

function isSessionFile(provider: AgentSessionProvider, filePath: string): boolean {
  const ext = path.extname(filePath);
  const base = path.basename(filePath);
  if (provider === 'cursor') return base === 'workspace.json' || SESSION_EXTENSIONS.has(ext);
  return SESSION_EXTENSIONS.has(ext);
}

async function buildCandidate(
  provider: AgentSessionProvider,
  filePath: string,
  projects: Project[],
): Promise<AgentSessionCandidate | null> {
  const stat = await fs.stat(filePath);
  const sample = await readSample(filePath);
  const inferredRepoRoot = await inferRepoRoot(sample, filePath);
  const sampleRepoFullName = parseGitHubFullName(sample);
  const repoFullName = sampleRepoFullName ?? (inferredRepoRoot ? await repoFullNameFromGitConfig(inferredRepoRoot) : null);
  const matchedProject = repoFullName ? matchProject(projects, repoFullName) : null;
  const window = normalizeSessionWindow(sample, stat);
  const sourceHash = hashSource(provider, filePath);
  const providerSessionId = providerSessionIdFor(provider, filePath);
  const subject = matchedProject?.name
    ?? repoFullName?.split('/').at(-1)
    ?? (inferredRepoRoot ? path.basename(inferredRepoRoot) : path.basename(filePath));
  const confidenceReasons = confidenceReasonsFor({
    base: window.confidenceReasons,
    matchedProject,
    repoFullName,
    repoRoot: inferredRepoRoot,
  });
  const confidence = confidenceFor(matchedProject, repoFullName, inferredRepoRoot, confidenceReasons);
  const matchStatus = matchStatusFor(matchedProject, confidence);

  return {
    id: `agent_${sourceHash.slice(0, 24)}`,
    provider,
    providerSessionId,
    sourcePath: filePath,
    sourceLabel: sourceLabelFor(provider, subject, filePath, window.endedAt),
    sourceHash,
    repoRoot: inferredRepoRoot,
    repoFullName,
    projectId: matchedProject?.id ?? null,
    projectName: matchedProject?.name ?? null,
    startedAt: window.startedAt.toISOString(),
    endedAt: window.endedAt.toISOString(),
    lastSeenAt: window.endedAt.toISOString(),
    title: `${providerLabel(provider)} - ${subject}`,
    summary: repoFullName
      ? `Local ${providerLabel(provider)} session matched to ${repoFullName}.`
      : `Local ${providerLabel(provider)} session metadata awaiting project match.`,
    confidence,
    confidenceReasons,
    matchStatus,
    status: 'pending',
    createdEntryId: null,
  };
}

function normalizeSessionWindow(sample: string, stat: import('node:fs').Stats): SessionWindow {
  const reasons: string[] = [];
  const parsedDates = extractSessionDates(sample);
  const rawEnd = parsedDates.length > 0
    ? new Date(Math.max(...parsedDates.map((date) => date.getTime()), stat.mtimeMs))
    : new Date(stat.mtimeMs);
  const rawStart = parsedDates.length > 1
    ? new Date(Math.min(...parsedDates.map((date) => date.getTime())))
    : stat.birthtimeMs > 0 && stat.birthtimeMs < stat.mtimeMs
      ? new Date(stat.birthtimeMs)
      : new Date(rawEnd.getTime() - DEFAULT_SESSION_SECONDS * 1000);

  if (parsedDates.length > 0) reasons.push('provider timestamps parsed');
  else reasons.push('filesystem timestamp fallback');

  let endedAt = rawEnd;
  const now = Date.now();
  if (endedAt.getTime() > now + 5 * 60 * 1000) {
    endedAt = new Date(now);
    reasons.push('future timestamp clamped');
  }

  let startedAt = rawStart;
  if (startedAt.getTime() >= endedAt.getTime()) {
    startedAt = new Date(endedAt.getTime() - DEFAULT_SESSION_SECONDS * 1000);
    reasons.push('invalid timestamp order repaired');
  }

  const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  if (durationSeconds > MAX_SESSION_SECONDS) {
    startedAt = new Date(endedAt.getTime() - DEFAULT_SESSION_SECONDS * 1000);
    reasons.push('long transcript duration clamped');
  } else if (durationSeconds < MIN_SESSION_SECONDS) {
    startedAt = new Date(endedAt.getTime() - MIN_SESSION_SECONDS * 1000);
    reasons.push('short session minimum applied');
  }

  return { startedAt, endedAt, confidenceReasons: reasons };
}

function extractSessionDates(sample: string): Date[] {
  const found = new Map<string, Date>();
  const isoRegex = /20\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?Z/g;
  let match: RegExpExecArray | null;
  while ((match = isoRegex.exec(sample)) !== null) {
    const date = new Date(match[0]);
    if (validSessionDate(date)) found.set(date.toISOString(), date);
  }

  const numericTimestampRegex = /"(?:timestamp|createdAt|created_at|updatedAt|updated_at|time|ts)"\s*:\s*(\d{10,13})/gi;
  while ((match = numericTimestampRegex.exec(sample)) !== null) {
    const value = Number(match[1]);
    const date = new Date(value > 10_000_000_000 ? value : value * 1000);
    if (validSessionDate(date)) found.set(date.toISOString(), date);
  }
  return Array.from(found.values()).slice(0, 100);
}

function validSessionDate(date: Date): boolean {
  const time = date.getTime();
  return Number.isFinite(time) && time > Date.UTC(2024, 0, 1) && time < Date.now() + 24 * 60 * 60 * 1000;
}

function confidenceReasonsFor(input: {
  base: string[];
  matchedProject: Project | null;
  repoFullName: string | null;
  repoRoot: string | null;
}): string[] {
  const reasons = [...input.base];
  if (input.repoRoot) reasons.push('local git root found');
  if (input.repoFullName) reasons.push('GitHub repo hint found');
  if (input.matchedProject && hasVerifiedRepo(input.matchedProject)) reasons.push('verified project match');
  else if (input.matchedProject) reasons.push('project match needs repo verification');
  else if (input.repoFullName) reasons.push('repo not yet in project resolver');
  else reasons.push('no repo/project hint found');
  return Array.from(new Set(reasons));
}

function confidenceFor(
  matchedProject: Project | null,
  repoFullName: string | null,
  repoRoot: string | null,
  reasons: string[],
): number {
  let score = 20;
  if (repoRoot) score = 35;
  if (repoFullName) score = 50;
  if (matchedProject) score = hasVerifiedRepo(matchedProject) ? 92 : 70;
  if (reasons.includes('provider timestamps parsed')) score += 5;
  if (reasons.some((reason) => reason.includes('clamped'))) score -= 10;
  if (reasons.includes('no repo/project hint found')) score -= 5;
  return Math.max(10, Math.min(95, score));
}

function matchStatusFor(matchedProject: Project | null, confidence: number): AgentSessionCandidate['matchStatus'] {
  if (matchedProject && hasVerifiedRepo(matchedProject)) return confidence >= 70 ? 'ready' : 'low_confidence';
  if (matchedProject) return 'repo_unverified';
  return confidence < 40 ? 'low_confidence' : 'needs_project';
}

function sourceLabelFor(provider: AgentSessionProvider, subject: string, filePath: string, endedAt: Date): string {
  const fileName = path.basename(filePath);
  const day = endedAt.toISOString().slice(0, 10);
  return `${providerLabel(provider)} - ${subject} - ${day} (${fileName})`;
}

function providerSessionIdFor(provider: AgentSessionProvider, filePath: string): string {
  return `${provider}_${createHash('sha256').update(filePath).digest('hex').slice(0, 16)}`;
}

async function readSample(filePath: string): Promise<string> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(MAX_SAMPLE_BYTES);
    const result = await handle.read(buffer, 0, MAX_SAMPLE_BYTES, 0);
    return buffer.subarray(0, result.bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
}

async function inferRepoRoot(sample: string, sourcePath: string): Promise<string | null> {
  const candidates = extractPathCandidates(sample);
  candidates.push(path.dirname(sourcePath));
  for (const candidate of candidates) {
    const root = await findGitRoot(candidate);
    if (root) return root;
  }
  return null;
}

function extractPathCandidates(sample: string): string[] {
  const found = new Set<string>();
  const keyRegex = /"(?:cwd|workdir|worktree|repoRoot|projectPath|workspace|workspaceFolder|root|path|folder)"\s*:\s*"([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = keyRegex.exec(sample)) !== null) {
    const value = decodeJsonString(match[1]);
    if (looksLikeLocalPath(value)) found.add(value);
  }

  const absolutePathRegex = /(?:file:\/\/)?(\/(?:Users|Volumes|private|tmp|var)\/[^\s"',}]+)/g;
  while ((match = absolutePathRegex.exec(sample)) !== null) {
    const value = decodeURIComponent(match[1]);
    if (looksLikeLocalPath(value)) found.add(value);
  }
  return Array.from(found).slice(0, 20);
}

function decodeJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw.replace(/\\\//g, '/');
  }
}

function looksLikeLocalPath(value: string): boolean {
  return value.startsWith('/Users/') || value.startsWith('/Volumes/') || value.startsWith('/private/') || value.startsWith('/tmp/') || value.startsWith('/var/');
}

async function findGitRoot(candidatePath: string): Promise<string | null> {
  let current = candidatePath;
  try {
    const stat = await fs.stat(current);
    if (stat.isFile()) current = path.dirname(current);
  } catch {
    return null;
  }

  for (let i = 0; i < 12; i += 1) {
    if (await pathExists(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current || parent === os.homedir()) return null;
    current = parent;
  }
  return null;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function repoFullNameFromGitConfig(repoRoot: string): Promise<string | null> {
  const dotGit = path.join(repoRoot, '.git');
  let configPath = path.join(dotGit, 'config');
  try {
    const stat = await fs.stat(dotGit);
    if (stat.isFile()) {
      const pointer = await fs.readFile(dotGit, 'utf8');
      const match = pointer.match(/^gitdir:\s*(.+)$/m);
      if (match) {
        const gitDir = path.isAbsolute(match[1]) ? match[1] : path.resolve(repoRoot, match[1]);
        configPath = path.join(gitDir, 'config');
      }
    }
    const config = await fs.readFile(configPath, 'utf8');
    return parseGitHubFullName(config);
  } catch {
    return null;
  }
}

function parseGitHubFullName(input: string): string | null {
  const match = input.match(/github\.com[/:]([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git|[\s"'#?]|$)/i);
  return match?.[1]?.replace(/\.git$/i, '') ?? null;
}

function matchProject(projects: Project[], repoFullName: string): Project | null {
  const normalized = repoFullName.toLowerCase();
  return projects.find((project) => project.githubRepoFullName?.toLowerCase() === normalized) ?? null;
}

function hashSource(provider: AgentSessionProvider, filePath: string): string {
  return createHash('sha256').update(`${provider}:${filePath}`).digest('hex');
}

function providerLabel(provider: AgentSessionProvider): string {
  if (provider === 'codex') return 'Codex';
  if (provider === 'claude') return 'Claude';
  if (provider === 'cursor') return 'Cursor';
  return 'OpenCode';
}

function safeDate(value: string, fallback: Date): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function hasVerifiedRepo(project: Project | null): boolean {
  return hasVerifiedGitHubRepository(project);
}
