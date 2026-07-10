import sqlite3 from 'sqlite3';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import type {
  AgentSessionCandidate,
  AgentSessionCandidateStatus,
  AssistantIntentStatus,
  AssistantModelUsageRecord,
  AssistantRole,
  AssistantToolId,
  BreakworkPrompt,
  DailyProofPacket,
  GitHubActivity,
  HandoffInput,
  HandoffRecord,
  HandoffStatus,
  ProofCustodyInput,
  ProofCustodyRecord,
  Project,
  ReviewCycle,
  StandupEvidenceRecord,
  ThoughtseedFabricTask,
  ThoughtseedFabricTaskHistoryEvent,
  TimeEntry,
} from '../shared/types.js';

const DEFAULT_DB_DIR = path.join(os.homedir(), '.plexus');
const DB_PATH = process.env.PLEXUS_DB_PATH?.trim() || path.join(DEFAULT_DB_DIR, 'plexus.db');
const DB_DIR = path.dirname(DB_PATH);

let db: sqlite3.Database | null = null;

export function getDatabasePath(): string {
  return DB_PATH;
}

function ensureDir() {
  if (DB_PATH === ':memory:') return;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
}

export function getDb(): Promise<sqlite3.Database> {
  if (db) return Promise.resolve(db);
  ensureDir();
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(DB_PATH, (err) => {
      if (err) return reject(err);
      db = database;
      migrate().then(() => resolve(database)).catch(reject);
    });
  });
}

function run(sql: string, params: any[] = []): Promise<void> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  }));
}

function exec(sql: string): Promise<void> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  }));
}

function all<T>(sql: string, params: any[] = []): Promise<T[]> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  }));
}

function get<T>(sql: string, params: any[] = []): Promise<T | null> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve((row as T) || null);
    });
  }));
}

async function migrate() {
  await run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      client_name TEXT,
      color TEXT NOT NULL DEFAULT '#3b82f6',
      hourly_rate REAL,
      currency TEXT DEFAULT 'USD',
      archived INTEGER NOT NULL DEFAULT 0,
      github_repo_url TEXT,
      github_repo_full_name TEXT,
      github_repo_id TEXT,
      repo_verified_at TEXT,
      repo_evidence_status TEXT NOT NULL DEFAULT 'missing',
      repo_required INTEGER NOT NULL DEFAULT 1,
      evidence_status TEXT NOT NULL DEFAULT 'missing',
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      description TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      target_seconds INTEGER,
      paused_at TEXT,
      paused_seconds INTEGER NOT NULL DEFAULT 0,
      tags TEXT NOT NULL DEFAULT '[]',
      billable INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'timer',
      github_repo_url TEXT,
      github_repo_full_name TEXT,
      evidence_status TEXT NOT NULL DEFAULT 'legacy_unverified',
      evidence_checked_at TEXT,
      github_activity_ids TEXT NOT NULL DEFAULT '[]',
      evidence_provenance TEXT NOT NULL DEFAULT '[]',
      synced_at TEXT
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_entries_start ON time_entries(start_time)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_entries_project ON time_entries(project_id)`);
  await ensureColumn('time_entries', 'target_seconds', 'INTEGER');
  await ensureColumn('time_entries', 'paused_at', 'TEXT');
  await ensureColumn('time_entries', 'paused_seconds', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn('time_entries', 'github_repo_url', 'TEXT');
  await ensureColumn('time_entries', 'github_repo_full_name', 'TEXT');
  await ensureColumn('time_entries', 'evidence_status', "TEXT NOT NULL DEFAULT 'legacy_unverified'");
  await ensureColumn('time_entries', 'evidence_checked_at', 'TEXT');
  await ensureColumn('time_entries', 'github_activity_ids', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn('time_entries', 'evidence_provenance', "TEXT NOT NULL DEFAULT '[]'");

  await ensureColumn('projects', 'github_repo_url', 'TEXT');
  await ensureColumn('projects', 'github_repo_full_name', 'TEXT');
  await ensureColumn('projects', 'github_repo_id', 'TEXT');
  await ensureColumn('projects', 'repo_verified_at', 'TEXT');
  await ensureColumn('projects', 'repo_evidence_status', "TEXT NOT NULL DEFAULT 'missing'");
  await ensureColumn('projects', 'repo_required', 'INTEGER NOT NULL DEFAULT 1');
  await ensureColumn('projects', 'evidence_status', "TEXT NOT NULL DEFAULT 'missing'");

  await run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await run("DELETE FROM settings WHERE key = 'tf.multicaApiUrl'");

  await run(`
    CREATE TABLE IF NOT EXISTS handoffs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      next_retry_at TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_handoffs_status ON handoffs(status, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_handoffs_kind ON handoffs(kind, updated_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS github_activity (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      repo_full_name TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      actor TEXT,
      occurred_at TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}'
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_github_activity_project_time ON github_activity(project_id, occurred_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_github_activity_repo_time ON github_activity(repo_full_name, occurred_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS standup_evidence_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      evidence_summary TEXT NOT NULL DEFAULT '{}',
      activity TEXT NOT NULL DEFAULT '[]',
      generated_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_standup_evidence_date ON standup_evidence_records(date)`);

  await run(`
    CREATE TABLE IF NOT EXISTS review_cycles (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      evidence_summary TEXT NOT NULL DEFAULT '{}',
      standup_compliance TEXT NOT NULL DEFAULT '{}',
      blockers TEXT NOT NULL DEFAULT '[]',
      appraisal_signals TEXT NOT NULL DEFAULT '[]',
      generated_at TEXT NOT NULL
    )
  `);
  await ensureColumn('review_cycles', 'standup_compliance', "TEXT NOT NULL DEFAULT '{}'");
  await run(`CREATE INDEX IF NOT EXISTS idx_review_cycles_kind_period ON review_cycles(kind, period_start)`);

  await run(`
    CREATE TABLE IF NOT EXISTS proof_custody_records (
      id TEXT PRIMARY KEY,
      subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      proof_status TEXT NOT NULL,
      evidence_type TEXT NOT NULL,
      strength TEXT,
      artifact_ref TEXT,
      payload_hash TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_proof_custody_subject ON proof_custody_records(subject_type, subject_id, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_proof_custody_status ON proof_custody_records(proof_status, updated_at)`);
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_proof_custody_unique ON proof_custody_records(subject_type, subject_id, evidence_type, payload_hash)`);

  await run(`
    CREATE TABLE IF NOT EXISTS daily_proof_packets (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      proof_status TEXT NOT NULL,
      report_subject_id TEXT NOT NULL,
      standup_evidence_record_id TEXT,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      entry_count INTEGER NOT NULL DEFAULT 0,
      task_count INTEGER NOT NULL DEFAULT 0,
      missing_proof_count INTEGER NOT NULL DEFAULT 0,
      blocker_count INTEGER NOT NULL DEFAULT 0,
      evidence_summary TEXT NOT NULL DEFAULT '{}',
      fabric_task_proof TEXT NOT NULL DEFAULT '{}',
      payload TEXT NOT NULL DEFAULT '{}',
      generated_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_daily_proof_packets_date ON daily_proof_packets(date)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_daily_proof_packets_status ON daily_proof_packets(proof_status, updated_at)`);
  await run(`
    UPDATE daily_proof_packets
    SET standup_evidence_record_id = NULL
    WHERE standup_evidence_record_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM standup_evidence_records
        WHERE standup_evidence_records.id = daily_proof_packets.standup_evidence_record_id
      )
  `);

  await exec(`
    CREATE TABLE IF NOT EXISTS fabric_tasks (
      task_id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'cambium',
      assignee_member_id TEXT NOT NULL,
      directive_id TEXT,
      correlation_id TEXT,
      project_id TEXT,
      project_name TEXT,
      work_entry_id TEXT,
      status TEXT NOT NULL,
      work_mode TEXT,
      work_mode_locked INTEGER NOT NULL DEFAULT 0,
      override_count INTEGER NOT NULL DEFAULT 0,
      evidence_strength TEXT NOT NULL DEFAULT 'weak_evidence',
      proof_status TEXT,
      source TEXT,
      title TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fabric_tasks_assignee_status ON fabric_tasks(assignee_member_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_fabric_tasks_project ON fabric_tasks(project_id, updated_at);
    CREATE INDEX IF NOT EXISTS idx_fabric_tasks_work_entry ON fabric_tasks(work_entry_id, updated_at);

    CREATE TABLE IF NOT EXISTS fabric_task_history_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      actor TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      correlation_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(task_id, event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_fabric_task_events_task_time ON fabric_task_history_events(task_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_fabric_task_events_type_time ON fabric_task_history_events(type, timestamp);

    CREATE TABLE IF NOT EXISTS fabric_task_history_conflicts (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      existing_payload_hash TEXT,
      incoming_payload_hash TEXT NOT NULL,
      incoming_payload TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      UNIQUE(task_id, event_id, incoming_payload_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_fabric_task_conflicts_task_time ON fabric_task_history_conflicts(task_id, created_at);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_fabric_task_conflicts_unique ON fabric_task_history_conflicts(task_id, event_id, incoming_payload_hash);
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS breakwork_prompts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      audio_file_ref TEXT,
      trigger_reason TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      completed_at TEXT,
      snoozed_until TEXT
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_breakwork_prompts_generated ON breakwork_prompts(generated_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS agent_session_candidates (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      provider_session_id TEXT,
      source_path TEXT NOT NULL,
      source_label TEXT,
      source_hash TEXT NOT NULL UNIQUE,
      repo_root TEXT,
      repo_full_name TEXT,
      project_id TEXT,
      project_name TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      confidence INTEGER NOT NULL DEFAULT 0,
      confidence_reasons TEXT NOT NULL DEFAULT '[]',
      match_status TEXT NOT NULL DEFAULT 'needs_project',
      status TEXT NOT NULL DEFAULT 'pending',
      created_entry_id TEXT,
      metadata TEXT NOT NULL DEFAULT '{}'
    )
  `);
  await ensureColumn('agent_session_candidates', 'provider_session_id', 'TEXT');
  await ensureColumn('agent_session_candidates', 'source_label', 'TEXT');
  await ensureColumn('agent_session_candidates', 'confidence_reasons', "TEXT NOT NULL DEFAULT '[]'");
  await ensureColumn('agent_session_candidates', 'match_status', "TEXT NOT NULL DEFAULT 'needs_project'");
  await run(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_status_time ON agent_session_candidates(status, ended_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_source_hash ON agent_session_candidates(source_hash)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_agent_sessions_match_status ON agent_session_candidates(status, match_status)`);

  await run(`
    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_conversations_updated ON assistant_conversations(updated_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS assistant_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation ON assistant_messages(conversation_id, created_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS assistant_intents (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES assistant_conversations(id),
      tool_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      result TEXT,
      expires_at TEXT,
      consumed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await ensureColumn('assistant_intents', 'expires_at', 'TEXT');
  await ensureColumn('assistant_intents', 'consumed_at', 'TEXT');
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_intents_conversation ON assistant_intents(conversation_id, created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_intents_status ON assistant_intents(status, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_intents_consumed ON assistant_intents(status, consumed_at, expires_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS assistant_tool_audits (
      id TEXT PRIMARY KEY,
      intent_id TEXT,
      tool_id TEXT NOT NULL,
      status TEXT NOT NULL,
      actor_id TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      input TEXT NOT NULL DEFAULT '{}',
      output TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      failure_kind TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0
    )
  `);
  await ensureColumn('assistant_tool_audits', 'failure_kind', 'TEXT');
  await ensureColumn('assistant_tool_audits', 'duration_ms', 'INTEGER NOT NULL DEFAULT 0');
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_tool_audits_tool ON assistant_tool_audits(tool_id, started_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_tool_audits_intent ON assistant_tool_audits(intent_id, started_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS assistant_model_usage (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER,
      output_tokens INTEGER,
      total_tokens INTEGER,
      finish_reason TEXT,
      failure_kind TEXT,
      fallback INTEGER NOT NULL DEFAULT 0,
      primary_provider TEXT,
      final_provider TEXT,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      metadata TEXT NOT NULL DEFAULT '{}'
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_model_usage_conversation_time ON assistant_model_usage(conversation_id, started_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_model_usage_status_time ON assistant_model_usage(status, started_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_model_usage_provider_time ON assistant_model_usage(provider, started_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS assistant_daily_events (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      artifact_ref TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      next_retry_at TEXT
    )
  `);
  await ensureColumn('assistant_daily_events', 'artifact_ref', 'TEXT');
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_daily_events_date ON assistant_daily_events(date, created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_assistant_daily_events_status ON assistant_daily_events(status, next_retry_at)`);
}

async function ensureColumn(table: string, column: string, definition: string) {
  const rows = await all<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!rows.some(r => r.name === column)) {
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function closeDb(): Promise<void> {
  if (!db) return Promise.resolve();
  const database = db;
  db = null;
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export interface AssistantConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessage {
  id: string;
  conversationId: string;
  role: AssistantRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AssistantMessageInput {
  id: string;
  conversationId: string;
  role: AssistantRole;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface AssistantIntentRecord {
  id: string;
  conversationId: string;
  toolId: AssistantToolId;
  status: AssistantIntentStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown>;
  expiresAt: string | null;
  consumedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantIntentInput {
  id: string;
  conversationId: string;
  toolId: AssistantToolId;
  status?: AssistantIntentStatus;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  expiresAt?: string | null;
  consumedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type AssistantIntentPatch = Partial<Pick<AssistantIntentRecord, 'status' | 'payload' | 'result' | 'expiresAt' | 'consumedAt'>> & {
  updatedAt?: string;
};

export type AssistantToolAuditStatus = 'succeeded' | 'failed';

export interface AssistantToolAuditRecord {
  id: string;
  intentId: string | null;
  toolId: AssistantToolId;
  status: AssistantToolAuditStatus;
  actorId: string | null;
  startedAt: string;
  endedAt: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  failureKind: string | null;
  durationMs: number;
}

export interface AssistantToolAuditInput {
  id: string;
  intentId?: string | null;
  toolId: AssistantToolId;
  status: AssistantToolAuditStatus;
  actorId?: string | null;
  startedAt: string;
  endedAt: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string | null;
  failureKind?: string | null;
  durationMs?: number;
}

export type AssistantModelUsageInput = Omit<AssistantModelUsageRecord, 'metadata'> & {
  metadata?: Record<string, unknown>;
};

export type AssistantDailyEventStatus = 'pending' | 'queued' | 'sending' | 'sent' | 'failed';

export interface AssistantDailyEventRecord {
  id: string;
  date: string;
  status: AssistantDailyEventStatus;
  payload: Record<string, unknown>;
  error: string | null;
  artifactRef: string | null;
  createdAt: string;
  updatedAt: string;
  nextRetryAt: string | null;
}

export interface AssistantDailyEventInput {
  id: string;
  date: string;
  status?: AssistantDailyEventStatus;
  payload?: Record<string, unknown>;
  error?: string | null;
  artifactRef?: string | null;
  createdAt?: string;
  updatedAt?: string;
  nextRetryAt?: string | null;
}

export type AssistantDailyEventPatch = Partial<Pick<AssistantDailyEventRecord, 'status' | 'payload' | 'error' | 'artifactRef' | 'nextRetryAt'>> & {
  updatedAt?: string;
};

function parseJsonRecord(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function parseJsonArray<T = unknown>(raw: string | null | undefined): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function cappedLimit(limit: number | undefined, fallback: number, max: number): number {
  const value = limit ?? fallback;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

function makeAssistantId(prefix: string): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
  return `${prefix}_${stamp}_${Math.random().toString(16).slice(2, 10)}`;
}

function rowToAssistantConversation(r: any): AssistantConversation {
  return {
    id: r.id,
    title: r.title ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToAssistantMessage(r: any): AssistantMessage {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    metadata: parseJsonRecord(r.metadata),
    createdAt: r.created_at,
  };
}

function rowToAssistantIntent(r: any): AssistantIntentRecord {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    toolId: r.tool_id,
    status: r.status,
    payload: parseJsonRecord(r.payload),
    result: parseJsonRecord(r.result),
    expiresAt: r.expires_at ?? null,
    consumedAt: r.consumed_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToAssistantToolAudit(r: any): AssistantToolAuditRecord {
  return {
    id: r.id,
    intentId: r.intent_id ?? null,
    toolId: r.tool_id,
    status: r.status,
    actorId: r.actor_id ?? null,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    input: parseJsonRecord(r.input),
    output: parseJsonRecord(r.output),
    error: r.error ?? null,
    failureKind: r.failure_kind ?? null,
    durationMs: Number.isFinite(Number(r.duration_ms)) ? Number(r.duration_ms) : 0,
  };
}

function rowToAssistantModelUsage(r: any): AssistantModelUsageRecord {
  return {
    id: r.id,
    conversationId: r.conversation_id ?? null,
    provider: r.provider,
    model: r.model,
    status: r.status,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationMs: Number.isFinite(Number(r.duration_ms)) ? Number(r.duration_ms) : 0,
    inputTokens: r.input_tokens == null ? null : Number(r.input_tokens),
    outputTokens: r.output_tokens == null ? null : Number(r.output_tokens),
    totalTokens: r.total_tokens == null ? null : Number(r.total_tokens),
    finishReason: r.finish_reason ?? null,
    failureKind: r.failure_kind ?? null,
    fallback: Boolean(r.fallback),
    primaryProvider: r.primary_provider ?? null,
    finalProvider: r.final_provider ?? null,
    attemptCount: Number.isFinite(Number(r.attempt_count)) ? Number(r.attempt_count) : 0,
    metadata: parseJsonRecord(r.metadata),
  };
}

function rowToAssistantDailyEvent(r: any): AssistantDailyEventRecord {
  return {
    id: r.id,
    date: r.date,
    status: r.status,
    payload: parseJsonRecord(r.payload),
    error: r.error ?? null,
    artifactRef: r.artifact_ref ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    nextRetryAt: r.next_retry_at ?? null,
  };
}

export async function createAssistantConversation(title?: string): Promise<AssistantConversation> {
  const now = new Date().toISOString();
  const id = makeAssistantId('assistant_conversation');
  await run(
    `INSERT INTO assistant_conversations (id, title, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
    [id, title ?? null, now, now],
  );
  const created = await get<any>('SELECT * FROM assistant_conversations WHERE id = ?', [id]);
  if (!created) throw new Error('Could not create assistant conversation.');
  return rowToAssistantConversation(created);
}

export async function listAssistantConversations(limit = 50): Promise<AssistantConversation[]> {
  const rows = await all<any>(
    'SELECT * FROM assistant_conversations ORDER BY updated_at DESC, created_at DESC LIMIT ?',
    [cappedLimit(limit, 50, 200)],
  );
  return rows.map(rowToAssistantConversation);
}

export async function insertAssistantMessage(message: AssistantMessageInput): Promise<AssistantMessage> {
  const createdAt = message.createdAt ?? new Date().toISOString();
  await run(
    `INSERT INTO assistant_messages (id, conversation_id, role, content, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.conversationId,
      message.role,
      message.content,
      JSON.stringify(message.metadata ?? {}),
      createdAt,
    ],
  );
  await run(
    'UPDATE assistant_conversations SET updated_at = ? WHERE id = ?',
    [createdAt, message.conversationId],
  );
  const created = await get<any>('SELECT * FROM assistant_messages WHERE id = ?', [message.id]);
  if (!created) throw new Error('Could not create assistant message.');
  return rowToAssistantMessage(created);
}

export async function listAssistantMessages(conversationId: string, limit = 100): Promise<AssistantMessage[]> {
  const rows = await all<any>(
    `SELECT * FROM (
       SELECT * FROM assistant_messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?
     )
     ORDER BY created_at ASC, id ASC`,
    [conversationId, cappedLimit(limit, 100, 500)],
  );
  return rows.map(rowToAssistantMessage);
}

export async function insertAssistantIntent(input: AssistantIntentInput): Promise<AssistantIntentRecord> {
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? createdAt;
  await run(
    `INSERT INTO assistant_intents (id, conversation_id, tool_id, status, payload, result, expires_at, consumed_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.conversationId,
      input.toolId,
      input.status ?? 'draft',
      JSON.stringify(input.payload ?? {}),
      input.result === undefined ? null : JSON.stringify(input.result),
      input.expiresAt ?? null,
      input.consumedAt ?? null,
      createdAt,
      updatedAt,
    ],
  );
  await run(
    'UPDATE assistant_conversations SET updated_at = ? WHERE id = ?',
    [updatedAt, input.conversationId],
  );
  const created = await get<any>('SELECT * FROM assistant_intents WHERE id = ?', [input.id]);
  if (!created) throw new Error('Could not create assistant intent.');
  return rowToAssistantIntent(created);
}

export async function updateAssistantIntent(id: string, patch: AssistantIntentPatch): Promise<AssistantIntentRecord> {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.status !== undefined) { sets.push('status = ?'); vals.push(patch.status); }
  if (patch.payload !== undefined) { sets.push('payload = ?'); vals.push(JSON.stringify(patch.payload)); }
  if (patch.result !== undefined) { sets.push('result = ?'); vals.push(JSON.stringify(patch.result)); }
  if (patch.expiresAt !== undefined) { sets.push('expires_at = ?'); vals.push(patch.expiresAt); }
  if (patch.consumedAt !== undefined) { sets.push('consumed_at = ?'); vals.push(patch.consumedAt); }
  if (sets.length > 0) {
    sets.push('updated_at = ?');
    vals.push(patch.updatedAt ?? new Date().toISOString());
    vals.push(id);
    await run(`UPDATE assistant_intents SET ${sets.join(', ')} WHERE id = ?`, vals);
  }
  const updated = await get<any>('SELECT * FROM assistant_intents WHERE id = ?', [id]);
  if (!updated) throw new Error('Assistant intent not found.');
  return rowToAssistantIntent(updated);
}

export async function listAssistantIntents(conversationId: string, limit = 100): Promise<AssistantIntentRecord[]> {
  const rows = await all<any>(
    `SELECT * FROM (
       SELECT * FROM assistant_intents
       WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?
     )
     ORDER BY created_at ASC, id ASC`,
    [conversationId, cappedLimit(limit, 100, 500)],
  );
  return rows.map(rowToAssistantIntent);
}

export async function getAssistantIntent(id: string): Promise<AssistantIntentRecord | null> {
  const row = await get<any>('SELECT * FROM assistant_intents WHERE id = ?', [id]);
  return row ? rowToAssistantIntent(row) : null;
}

export async function claimAssistantIntentForExecution(id: string, claimedAt: string): Promise<AssistantIntentRecord> {
  await run(
    `UPDATE assistant_intents
     SET status = 'running', consumed_at = ?, updated_at = ?
     WHERE id = ?
       AND status = 'confirmed'
       AND consumed_at IS NULL
       AND (expires_at IS NULL OR expires_at > ?)`,
    [claimedAt, claimedAt, id, claimedAt],
  );
  const claimed = await getAssistantIntent(id);
  if (!claimed) throw new Error('Assistant intent not found.');
  if (claimed.status !== 'running' || claimed.consumedAt !== claimedAt) {
    if (claimed.consumedAt) throw new Error('Assistant intent was already consumed.');
    if (claimed.expiresAt && claimed.expiresAt <= claimedAt) throw new Error('Assistant intent expired.');
    throw new Error(`Assistant intent cannot be claimed from ${claimed.status}.`);
  }
  return claimed;
}

export async function insertAssistantToolAudit(input: AssistantToolAuditInput): Promise<AssistantToolAuditRecord> {
  await run(
    `INSERT INTO assistant_tool_audits (id, intent_id, tool_id, status, actor_id, started_at, ended_at, input, output, error, failure_kind, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.intentId ?? null,
      input.toolId,
      input.status,
      input.actorId ?? null,
      input.startedAt,
      input.endedAt,
      JSON.stringify(input.input ?? {}),
      JSON.stringify(input.output ?? {}),
      input.error ?? null,
      input.failureKind ?? null,
      Math.max(0, Math.floor(input.durationMs ?? 0)),
    ],
  );
  const created = await get<any>('SELECT * FROM assistant_tool_audits WHERE id = ?', [input.id]);
  if (!created) throw new Error('Could not create assistant tool audit.');
  return rowToAssistantToolAudit(created);
}

export async function listAssistantToolAudits(limit = 100): Promise<AssistantToolAuditRecord[]> {
  const rows = await all<any>(
    'SELECT * FROM assistant_tool_audits ORDER BY started_at DESC, id DESC LIMIT ?',
    [cappedLimit(limit, 100, 500)],
  );
  return rows.map(rowToAssistantToolAudit);
}

export async function insertAssistantModelUsage(input: AssistantModelUsageInput): Promise<AssistantModelUsageRecord> {
  await run(
    `INSERT INTO assistant_model_usage (
       id, conversation_id, provider, model, status, started_at, ended_at, duration_ms,
       input_tokens, output_tokens, total_tokens, finish_reason, failure_kind,
       fallback, primary_provider, final_provider, attempt_count, metadata
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.conversationId ?? null,
      input.provider,
      input.model,
      input.status,
      input.startedAt,
      input.endedAt,
      Math.max(0, Math.floor(input.durationMs ?? 0)),
      input.inputTokens,
      input.outputTokens,
      input.totalTokens,
      input.finishReason ?? null,
      input.failureKind ?? null,
      input.fallback ? 1 : 0,
      input.primaryProvider ?? null,
      input.finalProvider ?? null,
      Math.max(0, Math.floor(input.attemptCount ?? 0)),
      JSON.stringify(input.metadata ?? {}),
    ],
  );
  const created = await get<any>('SELECT * FROM assistant_model_usage WHERE id = ?', [input.id]);
  if (!created) throw new Error('Could not create assistant model usage record.');
  return rowToAssistantModelUsage(created);
}

export async function listAssistantModelUsage(limit = 100): Promise<AssistantModelUsageRecord[]> {
  const rows = await all<any>(
    'SELECT * FROM assistant_model_usage ORDER BY started_at DESC, id DESC LIMIT ?',
    [cappedLimit(limit, 100, 500)],
  );
  return rows.map(rowToAssistantModelUsage);
}

export async function insertAssistantDailyEvent(input: AssistantDailyEventInput): Promise<AssistantDailyEventRecord> {
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? createdAt;
  await run(
    `INSERT INTO assistant_daily_events (id, date, status, payload, error, artifact_ref, created_at, updated_at, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.date,
      input.status ?? 'queued',
      JSON.stringify(input.payload ?? {}),
      input.error ?? null,
      input.artifactRef ?? null,
      createdAt,
      updatedAt,
      input.nextRetryAt ?? null,
    ],
  );
  const created = await getAssistantDailyEvent(input.id);
  if (!created) throw new Error('Could not create assistant daily event.');
  return created;
}

export async function listPendingAssistantDailyEvents(limit = 100, now = new Date().toISOString()): Promise<AssistantDailyEventRecord[]> {
  const rows = await all<any>(
    `SELECT * FROM assistant_daily_events
     WHERE status IN ('pending', 'queued')
        OR (status = 'failed' AND (next_retry_at IS NULL OR next_retry_at <= ?))
     ORDER BY COALESCE(next_retry_at, created_at) ASC, created_at ASC
     LIMIT ?`,
    [now, cappedLimit(limit, 100, 500)],
  );
  return rows.map(rowToAssistantDailyEvent);
}

export async function listAssistantDailyEvents(limit = 100): Promise<AssistantDailyEventRecord[]> {
  const rows = await all<any>(
    `SELECT * FROM assistant_daily_events
     ORDER BY updated_at DESC, created_at DESC, id DESC
     LIMIT ?`,
    [cappedLimit(limit, 100, 500)],
  );
  return rows.map(rowToAssistantDailyEvent);
}

export async function countAssistantDailyEventsByStatus(): Promise<Record<AssistantDailyEventStatus, number>> {
  const counts: Record<AssistantDailyEventStatus, number> = {
    pending: 0,
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
  };
  const rows = await all<{ status: AssistantDailyEventStatus; count: number }>(
    `SELECT status, COUNT(*) as count
     FROM assistant_daily_events
     GROUP BY status`,
  );
  for (const row of rows) {
    if (row.status in counts) counts[row.status] = Number(row.count) || 0;
  }
  return counts;
}

export async function updateAssistantDailyEvent(id: string, patch: AssistantDailyEventPatch): Promise<AssistantDailyEventRecord> {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.status !== undefined) { sets.push('status = ?'); vals.push(patch.status); }
  if (patch.payload !== undefined) { sets.push('payload = ?'); vals.push(JSON.stringify(patch.payload)); }
  if (patch.error !== undefined) { sets.push('error = ?'); vals.push(patch.error); }
  if (patch.artifactRef !== undefined) { sets.push('artifact_ref = ?'); vals.push(patch.artifactRef); }
  if (patch.nextRetryAt !== undefined) { sets.push('next_retry_at = ?'); vals.push(patch.nextRetryAt); }
  if (sets.length > 0) {
    sets.push('updated_at = ?');
    vals.push(patch.updatedAt ?? new Date().toISOString());
    vals.push(id);
    await run(`UPDATE assistant_daily_events SET ${sets.join(', ')} WHERE id = ?`, vals);
  }
  const updated = await getAssistantDailyEvent(id);
  if (!updated) throw new Error('Assistant daily event not found.');
  return updated;
}

export async function getAssistantDailyEvent(id: string): Promise<AssistantDailyEventRecord | null> {
  const row = await get<any>('SELECT * FROM assistant_daily_events WHERE id = ?', [id]);
  return row ? rowToAssistantDailyEvent(row) : null;
}

// Projects
export async function listProjects(): Promise<Project[]> {
  const rows = await all<any>('SELECT * FROM projects WHERE archived = 0 ORDER BY created_at DESC');
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    clientName: r.client_name,
    color: r.color,
    archived: !!r.archived,
    createdAt: r.created_at,
    githubRepoUrl: r.github_repo_url ?? undefined,
    githubRepoFullName: r.github_repo_full_name ?? undefined,
    githubRepoId: r.github_repo_id ?? undefined,
    repoVerifiedAt: r.repo_verified_at ?? undefined,
    repoEvidenceStatus: r.repo_evidence_status ?? (r.github_repo_url ? 'unverified' : 'missing'),
    repoRequired: r.repo_required === undefined ? true : !!r.repo_required,
    evidenceStatus: r.evidence_status ?? (r.github_repo_url ? 'pending' : 'missing'),
  }));
}

export async function getProject(id: string): Promise<Project | null> {
  const row = await get<any>('SELECT * FROM projects WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name,
    color: row.color,
    archived: !!row.archived,
    createdAt: row.created_at,
    githubRepoUrl: row.github_repo_url ?? undefined,
    githubRepoFullName: row.github_repo_full_name ?? undefined,
    githubRepoId: row.github_repo_id ?? undefined,
    repoVerifiedAt: row.repo_verified_at ?? undefined,
    repoEvidenceStatus: row.repo_evidence_status ?? (row.github_repo_url ? 'unverified' : 'missing'),
    repoRequired: row.repo_required === undefined ? true : !!row.repo_required,
    evidenceStatus: row.evidence_status ?? (row.github_repo_url ? 'pending' : 'missing'),
  };
}

export async function insertProject(p: Project) {
  await run(
    `INSERT INTO projects (id, name, client_name, color, archived, github_repo_url, github_repo_full_name, github_repo_id, repo_verified_at, repo_evidence_status, repo_required, evidence_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id,
      p.name,
      p.clientName ?? null,
      p.color,
      p.archived ? 1 : 0,
      p.githubRepoUrl ?? null,
      p.githubRepoFullName ?? null,
      p.githubRepoId ?? null,
      p.repoVerifiedAt ?? null,
      p.repoEvidenceStatus ?? (p.githubRepoUrl ? 'unverified' : 'missing'),
      p.repoRequired === false ? 0 : 1,
      p.evidenceStatus ?? (p.githubRepoUrl ? 'pending' : 'missing'),
      p.createdAt,
    ]
  );
}

export async function updateProject(id: string, patch: Partial<Project>) {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.name !== undefined) { sets.push('name = ?'); vals.push(patch.name); }
  if (patch.clientName !== undefined) { sets.push('client_name = ?'); vals.push(patch.clientName); }
  if (patch.color !== undefined) { sets.push('color = ?'); vals.push(patch.color); }
  if (patch.archived !== undefined) { sets.push('archived = ?'); vals.push(patch.archived ? 1 : 0); }
  if (patch.githubRepoUrl !== undefined) { sets.push('github_repo_url = ?'); vals.push(patch.githubRepoUrl ?? null); }
  if (patch.githubRepoFullName !== undefined) { sets.push('github_repo_full_name = ?'); vals.push(patch.githubRepoFullName ?? null); }
  if (patch.githubRepoId !== undefined) { sets.push('github_repo_id = ?'); vals.push(patch.githubRepoId ?? null); }
  if (patch.repoVerifiedAt !== undefined) { sets.push('repo_verified_at = ?'); vals.push(patch.repoVerifiedAt ?? null); }
  if (patch.repoEvidenceStatus !== undefined) { sets.push('repo_evidence_status = ?'); vals.push(patch.repoEvidenceStatus); }
  if (patch.repoRequired !== undefined) { sets.push('repo_required = ?'); vals.push(patch.repoRequired ? 1 : 0); }
  if (patch.evidenceStatus !== undefined) { sets.push('evidence_status = ?'); vals.push(patch.evidenceStatus); }
  if (sets.length === 0) return;
  vals.push(id);
  await run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteProject(id: string) {
  await run('DELETE FROM projects WHERE id = ?', [id]);
}

// Entries
function rowToEntry(r: any): TimeEntry {
  return {
    id: r.id,
    projectId: r.project_id,
    description: r.description,
    startTime: r.start_time,
    endTime: r.end_time ?? undefined,
    durationSeconds: r.duration_seconds,
    targetSeconds: r.target_seconds ?? undefined,
    pausedAt: r.paused_at ?? undefined,
    pausedSeconds: r.paused_seconds ?? 0,
    tags: JSON.parse(r.tags),
    source: r.source as 'manual' | 'timer',
    githubRepoUrl: r.github_repo_url ?? undefined,
    githubRepoFullName: r.github_repo_full_name ?? undefined,
    evidenceStatus: r.evidence_status ?? 'legacy_unverified',
    evidenceCheckedAt: r.evidence_checked_at ?? undefined,
    githubActivityIds: parseJsonArray<string>(r.github_activity_ids),
    evidenceProvenance: parseJsonArray(r.evidence_provenance),
    syncedAt: r.synced_at ?? undefined,
  };
}

export async function listEntries(from: string, to: string): Promise<TimeEntry[]> {
  const rows = await all<any>(
    'SELECT * FROM time_entries WHERE start_time >= ? AND start_time < ? ORDER BY start_time DESC',
    [from, to]
  );
  return rows.map(rowToEntry);
}

export async function listUnsyncedEntries(): Promise<TimeEntry[]> {
  const rows = await all<any>(
    'SELECT * FROM time_entries WHERE synced_at IS NULL AND end_time IS NOT NULL ORDER BY start_time ASC LIMIT 200'
  );
  return rows.map(rowToEntry);
}

export async function insertEntry(e: TimeEntry) {
  await run(
    `INSERT INTO time_entries (id, project_id, description, start_time, end_time, duration_seconds, target_seconds, paused_at, paused_seconds, tags, source, github_repo_url, github_repo_full_name, evidence_status, evidence_checked_at, github_activity_ids, evidence_provenance, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      e.id,
      e.projectId,
      e.description,
      e.startTime,
      e.endTime ?? null,
      e.durationSeconds,
      e.targetSeconds ?? null,
      e.pausedAt ?? null,
      e.pausedSeconds ?? 0,
      JSON.stringify(e.tags),
      e.source,
      e.githubRepoUrl ?? null,
      e.githubRepoFullName ?? null,
      e.evidenceStatus ?? 'pending',
      e.evidenceCheckedAt ?? null,
      JSON.stringify(e.githubActivityIds ?? []),
      JSON.stringify(e.evidenceProvenance ?? []),
      e.syncedAt ?? null,
    ]
  );
}

export async function updateEntry(id: string, patch: Partial<TimeEntry>) {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.projectId !== undefined) { sets.push('project_id = ?'); vals.push(patch.projectId); }
  if (patch.description !== undefined) { sets.push('description = ?'); vals.push(patch.description); }
  if (patch.startTime !== undefined) { sets.push('start_time = ?'); vals.push(patch.startTime); }
  if (patch.endTime !== undefined) { sets.push('end_time = ?'); vals.push(patch.endTime ?? null); }
  if (patch.durationSeconds !== undefined) { sets.push('duration_seconds = ?'); vals.push(patch.durationSeconds); }
  if (patch.targetSeconds !== undefined) { sets.push('target_seconds = ?'); vals.push(patch.targetSeconds ?? null); }
  if (patch.pausedAt !== undefined) { sets.push('paused_at = ?'); vals.push(patch.pausedAt ?? null); }
  if (patch.pausedSeconds !== undefined) { sets.push('paused_seconds = ?'); vals.push(patch.pausedSeconds ?? 0); }
  if (patch.tags !== undefined) { sets.push('tags = ?'); vals.push(JSON.stringify(patch.tags)); }
  if (patch.source !== undefined) { sets.push('source = ?'); vals.push(patch.source); }
  if (patch.githubRepoUrl !== undefined) { sets.push('github_repo_url = ?'); vals.push(patch.githubRepoUrl ?? null); }
  if (patch.githubRepoFullName !== undefined) { sets.push('github_repo_full_name = ?'); vals.push(patch.githubRepoFullName ?? null); }
  if (patch.evidenceStatus !== undefined) { sets.push('evidence_status = ?'); vals.push(patch.evidenceStatus); }
  if (patch.evidenceCheckedAt !== undefined) { sets.push('evidence_checked_at = ?'); vals.push(patch.evidenceCheckedAt ?? null); }
  if (patch.githubActivityIds !== undefined) { sets.push('github_activity_ids = ?'); vals.push(JSON.stringify(patch.githubActivityIds)); }
  if (patch.evidenceProvenance !== undefined) { sets.push('evidence_provenance = ?'); vals.push(JSON.stringify(patch.evidenceProvenance)); }
  if (patch.syncedAt !== undefined) { sets.push('synced_at = ?'); vals.push(patch.syncedAt ?? null); }
  if (sets.length === 0) return;
  vals.push(id);
  await run(`UPDATE time_entries SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteEntry(id: string) {
  await run('DELETE FROM time_entries WHERE id = ?', [id]);
}

export async function getRunningEntry(): Promise<TimeEntry | null> {
  const row = await get<any>('SELECT * FROM time_entries WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1');
  if (!row) return null;
  return rowToEntry(row);
}

// Evidence records
export async function upsertGitHubActivity(records: GitHubActivity[]): Promise<void> {
  for (const record of records) {
    await run(
      `INSERT OR REPLACE INTO github_activity (id, project_id, repo_full_name, repo_url, kind, title, url, actor, occurred_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.projectId,
        record.repoFullName,
        record.repoUrl,
        record.kind,
        record.title,
        record.url,
        record.actor ?? null,
        record.occurredAt,
        JSON.stringify(record.metadata ?? {}),
      ],
    );
  }
}

export async function listGitHubActivity(projectId: string, from: string, to: string): Promise<GitHubActivity[]> {
  const rows = await all<any>(
    'SELECT * FROM github_activity WHERE project_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at DESC',
    [projectId, from, to],
  );
  return rows.map((r) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(r.metadata || '{}');
    } catch {
      metadata = {};
    }
    return {
      id: r.id,
      projectId: r.project_id,
      repoFullName: r.repo_full_name,
      repoUrl: r.repo_url,
      kind: r.kind,
      title: r.title,
      url: r.url,
      actor: r.actor ?? null,
      occurredAt: r.occurred_at,
      metadata,
    };
  });
}

export async function upsertStandupEvidenceRecord(record: StandupEvidenceRecord): Promise<void> {
  await run(
    `INSERT OR REPLACE INTO standup_evidence_records (id, date, total_seconds, evidence_summary, activity, generated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.date,
      record.totalSeconds,
      JSON.stringify(record.evidenceSummary),
      JSON.stringify(record.activity ?? []),
      record.generatedAt,
    ],
  );
}

function rowToStandupEvidenceRecord(row: any): StandupEvidenceRecord {
  return {
    id: row.id,
    date: row.date,
    totalSeconds: Number(row.total_seconds ?? 0),
    evidenceSummary: parseJsonRecord(row.evidence_summary) as unknown as StandupEvidenceRecord['evidenceSummary'],
    activity: (() => {
      try {
        const activity = JSON.parse(row.activity || '[]');
        return Array.isArray(activity) ? activity : [];
      } catch {
        return [];
      }
    })(),
    generatedAt: row.generated_at,
  };
}

export async function getStandupEvidenceRecord(date: string): Promise<StandupEvidenceRecord | null> {
  const row = await get<any>(
    'SELECT * FROM standup_evidence_records WHERE date = ? ORDER BY generated_at DESC LIMIT 1',
    [date],
  );
  return row ? rowToStandupEvidenceRecord(row) : null;
}

export async function listStandupEvidenceRecords(
  fromDate: string,
  toDateExclusive: string,
): Promise<StandupEvidenceRecord[]> {
  const rows = await all<any>(
    'SELECT * FROM standup_evidence_records WHERE date >= ? AND date < ? ORDER BY date ASC, generated_at DESC',
    [fromDate, toDateExclusive],
  );
  return rows.map(rowToStandupEvidenceRecord);
}

export async function upsertReviewCycle(record: ReviewCycle): Promise<void> {
  await run(
    `INSERT OR REPLACE INTO review_cycles (id, kind, period_start, period_end, evidence_summary, standup_compliance, blockers, appraisal_signals, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.kind,
      record.periodStart,
      record.periodEnd,
      JSON.stringify(record.evidenceSummary),
      JSON.stringify(record.standupCompliance),
      JSON.stringify(record.blockers ?? []),
      JSON.stringify(record.appraisalSignals ?? []),
      record.generatedAt,
    ],
  );
}

export async function getReviewCycle(id: string): Promise<ReviewCycle | null> {
  const row = await get<any>('SELECT * FROM review_cycles WHERE id = ?', [id]);
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    evidenceSummary: JSON.parse(row.evidence_summary),
    standupCompliance: JSON.parse(row.standup_compliance),
    blockers: JSON.parse(row.blockers),
    appraisalSignals: JSON.parse(row.appraisal_signals),
    generatedAt: row.generated_at,
  } as ReviewCycle;
}

export async function insertBreakworkPrompt(record: BreakworkPrompt): Promise<void> {
  await run(
    `INSERT OR REPLACE INTO breakwork_prompts (id, category, title, prompt_text, audio_file_ref, trigger_reason, generated_at, completed_at, snoozed_until)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.category,
      record.title,
      record.promptText,
      record.audioFileRef ?? null,
      record.triggerReason,
      record.generatedAt,
      record.completedAt ?? null,
      record.snoozedUntil ?? null,
    ],
  );
}

// Local agent session suggestions
function parseStringArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function rowToAgentSessionCandidate(r: any): AgentSessionCandidate {
  const sourceLabel = r.source_label || agentSourceLabel(r.provider, r.source_path);
  return {
    id: r.id,
    provider: r.provider,
    providerSessionId: r.provider_session_id ?? null,
    sourcePath: sourceLabel,
    sourceLabel,
    sourceHash: r.source_hash,
    repoRoot: r.repo_root ?? null,
    repoFullName: r.repo_full_name ?? null,
    projectId: r.project_id ?? null,
    projectName: r.project_name ?? null,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    lastSeenAt: r.last_seen_at,
    title: r.title,
    summary: r.summary ?? null,
    confidence: Number(r.confidence ?? 0),
    confidenceReasons: parseStringArray(r.confidence_reasons),
    matchStatus: r.match_status ?? 'needs_project',
    status: r.status,
    createdEntryId: r.created_entry_id ?? null,
  };
}

function agentSourceLabel(provider: string, rawPath: string | null | undefined): string {
  const fileName = rawPath ? path.basename(rawPath) : 'local session';
  const providerName = provider === 'codex' ? 'Codex'
    : provider === 'claude' ? 'Claude'
      : provider === 'cursor' ? 'Cursor'
        : provider === 'opencode' ? 'OpenCode'
          : 'Agent';
  return `${providerName} session - ${fileName}`;
}

export async function upsertAgentSessionCandidates(records: AgentSessionCandidate[]): Promise<number> {
  let imported = 0;
  for (const record of records) {
    await run(
      `INSERT INTO agent_session_candidates (
        id, provider, provider_session_id, source_path, source_label, source_hash, repo_root, repo_full_name,
        project_id, project_name, started_at, ended_at, last_seen_at,
        title, summary, confidence, confidence_reasons, match_status, status, created_entry_id, metadata
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_hash) DO UPDATE SET
        provider = excluded.provider,
        provider_session_id = excluded.provider_session_id,
        source_path = excluded.source_path,
        source_label = excluded.source_label,
        repo_root = excluded.repo_root,
        repo_full_name = excluded.repo_full_name,
        project_id = CASE
          WHEN agent_session_candidates.status IN ('accepted', 'dismissed', 'ignored')
          THEN agent_session_candidates.project_id
          ELSE excluded.project_id
        END,
        project_name = CASE
          WHEN agent_session_candidates.status IN ('accepted', 'dismissed', 'ignored')
          THEN agent_session_candidates.project_name
          ELSE excluded.project_name
        END,
        started_at = excluded.started_at,
        ended_at = excluded.ended_at,
        last_seen_at = excluded.last_seen_at,
        title = excluded.title,
        summary = excluded.summary,
        confidence = excluded.confidence,
        confidence_reasons = excluded.confidence_reasons,
        match_status = CASE
          WHEN agent_session_candidates.status IN ('accepted', 'dismissed', 'ignored')
          THEN agent_session_candidates.match_status
          ELSE excluded.match_status
        END,
        status = CASE
          WHEN agent_session_candidates.status IN ('accepted', 'dismissed', 'ignored')
          THEN agent_session_candidates.status
          ELSE excluded.status
        END,
        created_entry_id = COALESCE(agent_session_candidates.created_entry_id, excluded.created_entry_id)`,
      [
        record.id,
        record.provider,
        record.providerSessionId ?? null,
        record.sourcePath,
        record.sourceLabel,
        record.sourceHash,
        record.repoRoot ?? null,
        record.repoFullName ?? null,
        record.projectId ?? null,
        record.projectName ?? null,
        record.startedAt,
        record.endedAt,
        record.lastSeenAt,
        record.title,
        record.summary ?? null,
        record.confidence,
        JSON.stringify(record.confidenceReasons ?? []),
        record.matchStatus,
        record.status,
        record.createdEntryId ?? null,
        '{}',
      ],
    );
    imported += 1;
  }
  return imported;
}

export async function listAgentSessionCandidates(
  status: AgentSessionCandidateStatus | 'all' = 'pending',
  limit = 100,
): Promise<AgentSessionCandidate[]> {
  const cappedLimit = Math.max(1, Math.min(250, Math.floor(limit)));
  const orderBy = `
    ORDER BY
      CASE match_status
        WHEN 'ready' THEN 0
        WHEN 'repo_unverified' THEN 1
        WHEN 'needs_project' THEN 2
        ELSE 3
      END,
      ended_at DESC
  `;
  const rows = status === 'all'
    ? await all<any>(`SELECT * FROM agent_session_candidates ${orderBy} LIMIT ?`, [cappedLimit])
    : await all<any>(`SELECT * FROM agent_session_candidates WHERE status = ? ${orderBy} LIMIT ?`, [status, cappedLimit]);
  return rows.map(rowToAgentSessionCandidate);
}

export async function summarizeAgentSessionCandidates(): Promise<{ totalPending: number; matchedPending: number; readyPending: number }> {
  const row = await get<any>(
    `SELECT
      COUNT(*) AS total_pending,
      SUM(CASE WHEN project_id IS NOT NULL THEN 1 ELSE 0 END) AS matched_pending,
      SUM(CASE WHEN match_status = 'ready' THEN 1 ELSE 0 END) AS ready_pending
     FROM agent_session_candidates
     WHERE status = 'pending'`,
  );
  return {
    totalPending: Number(row?.total_pending ?? 0),
    matchedPending: Number(row?.matched_pending ?? 0),
    readyPending: Number(row?.ready_pending ?? 0),
  };
}

export async function getAgentSessionCandidate(id: string): Promise<AgentSessionCandidate | null> {
  const row = await get<any>('SELECT * FROM agent_session_candidates WHERE id = ?', [id]);
  return row ? rowToAgentSessionCandidate(row) : null;
}

export async function updateAgentSessionCandidate(
  id: string,
  patch: Partial<Pick<AgentSessionCandidate, 'status' | 'createdEntryId' | 'projectId' | 'projectName'>>,
): Promise<AgentSessionCandidate> {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.status !== undefined) { sets.push('status = ?'); vals.push(patch.status); }
  if (patch.createdEntryId !== undefined) { sets.push('created_entry_id = ?'); vals.push(patch.createdEntryId ?? null); }
  if (patch.projectId !== undefined) { sets.push('project_id = ?'); vals.push(patch.projectId ?? null); }
  if (patch.projectName !== undefined) { sets.push('project_name = ?'); vals.push(patch.projectName ?? null); }
  if (sets.length === 0) {
    const current = await getAgentSessionCandidate(id);
    if (!current) throw new Error('Agent session suggestion not found.');
    return current;
  }
  vals.push(id);
  await run(`UPDATE agent_session_candidates SET ${sets.join(', ')} WHERE id = ?`, vals);
  const updated = await getAgentSessionCandidate(id);
  if (!updated) throw new Error('Agent session suggestion not found.');
  return updated;
}

function execSql(sql: string): Promise<void> {
  return getDb().then(d => new Promise((resolve, reject) => {
    d.exec(sql, (err) => (err ? reject(err) : resolve()));
  }));
}

export async function insertEntryAndAcceptAgentSession(
  entry: TimeEntry,
  candidateId: string,
  patch: Partial<Pick<AgentSessionCandidate, 'status' | 'createdEntryId' | 'projectId' | 'projectName'>>,
): Promise<AgentSessionCandidate> {
  await execSql('BEGIN IMMEDIATE TRANSACTION');
  try {
    await insertEntry(entry);
    const updated = await updateAgentSessionCandidate(candidateId, patch);
    await execSql('COMMIT');
    return updated;
  } catch (err) {
    await execSql('ROLLBACK').catch(() => {});
    throw err;
  }
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  const row = await get<any>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string) {
  await run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// Proof custody ledger
function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function proofPayloadHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function rowToProofCustodyRecord(r: any): ProofCustodyRecord {
  return {
    id: r.id,
    subjectType: r.subject_type,
    subjectId: r.subject_id,
    proofStatus: r.proof_status,
    evidenceType: r.evidence_type,
    strength: r.strength ?? null,
    artifactRef: r.artifact_ref ?? null,
    payloadHash: r.payload_hash,
    payload: parseJsonRecord(r.payload),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToDailyProofPacket(r: any): DailyProofPacket {
  const payload = parseJsonRecord(r.payload) as Partial<DailyProofPacket>;
  return {
    ...payload,
    id: r.id,
    date: r.date,
    generatedAt: r.generated_at,
    proofStatus: r.proof_status,
    reportSubjectId: r.report_subject_id,
    standupEvidenceRecordId: r.standup_evidence_record_id ?? null,
    totalSeconds: Number(r.total_seconds ?? 0),
    entryCount: Number(r.entry_count ?? 0),
    taskCount: Number(r.task_count ?? 0),
    missingProofCount: Number(r.missing_proof_count ?? 0),
    blockerCount: Number(r.blocker_count ?? 0),
    evidenceSummary: parseJsonRecord(r.evidence_summary) as unknown as DailyProofPacket['evidenceSummary'],
    fabricTaskProof: parseJsonRecord(r.fabric_task_proof) as unknown as DailyProofPacket['fabricTaskProof'],
  };
}

export async function upsertProofCustodyRecord(input: ProofCustodyInput): Promise<ProofCustodyRecord> {
  const now = new Date().toISOString();
  const createdAt = input.createdAt ?? now;
  const updatedAt = input.updatedAt ?? createdAt;
  const payload = input.payload ?? {};
  const payloadHash = proofPayloadHash(payload);
  await run(
    `INSERT INTO proof_custody_records (id, subject_type, subject_id, proof_status, evidence_type, strength, artifact_ref, payload_hash, payload, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(subject_type, subject_id, evidence_type, payload_hash) DO UPDATE SET
       proof_status = excluded.proof_status,
       strength = excluded.strength,
       artifact_ref = excluded.artifact_ref,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [
      input.id ?? makeAssistantId('proof'),
      input.subjectType,
      input.subjectId,
      input.proofStatus,
      input.evidenceType,
      input.strength ?? null,
      input.artifactRef ?? null,
      payloadHash,
      JSON.stringify(payload),
      createdAt,
      updatedAt,
    ],
  );
  const record = await get<any>(
    `SELECT * FROM proof_custody_records
     WHERE subject_type = ? AND subject_id = ? AND evidence_type = ? AND payload_hash = ?`,
    [input.subjectType, input.subjectId, input.evidenceType, payloadHash],
  );
  if (!record) throw new Error('Could not create proof custody record.');
  return rowToProofCustodyRecord(record);
}

export async function listProofCustodyRecords(input: {
  subjectType?: ProofCustodyInput['subjectType'];
  subjectId?: string;
  limit?: number;
} = {}): Promise<ProofCustodyRecord[]> {
  const limit = cappedLimit(input.limit, 100, 500);
  if (input.subjectType && input.subjectId) {
    const rows = await all<any>(
      `SELECT * FROM proof_custody_records
       WHERE subject_type = ? AND subject_id = ?
       ORDER BY updated_at DESC, id DESC LIMIT ?`,
      [input.subjectType, input.subjectId, limit],
    );
    return rows.map(rowToProofCustodyRecord);
  }
  if (input.subjectType) {
    const rows = await all<any>(
      `SELECT * FROM proof_custody_records
       WHERE subject_type = ?
       ORDER BY updated_at DESC, id DESC LIMIT ?`,
      [input.subjectType, limit],
    );
    return rows.map(rowToProofCustodyRecord);
  }
  const rows = await all<any>('SELECT * FROM proof_custody_records ORDER BY updated_at DESC, id DESC LIMIT ?', [limit]);
  return rows.map(rowToProofCustodyRecord);
}

export async function upsertDailyProofPacket(packet: DailyProofPacket): Promise<DailyProofPacket> {
  const updatedAt = new Date().toISOString();
  await run(
    `INSERT INTO daily_proof_packets (
       id, date, proof_status, report_subject_id, standup_evidence_record_id,
       total_seconds, entry_count, task_count, missing_proof_count, blocker_count,
       evidence_summary, fabric_task_proof, payload, generated_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET
       id = excluded.id,
       proof_status = excluded.proof_status,
       report_subject_id = excluded.report_subject_id,
       standup_evidence_record_id = excluded.standup_evidence_record_id,
       total_seconds = excluded.total_seconds,
       entry_count = excluded.entry_count,
       task_count = excluded.task_count,
       missing_proof_count = excluded.missing_proof_count,
       blocker_count = excluded.blocker_count,
       evidence_summary = excluded.evidence_summary,
       fabric_task_proof = excluded.fabric_task_proof,
       payload = excluded.payload,
       generated_at = excluded.generated_at,
       updated_at = excluded.updated_at`,
    [
      packet.id,
      packet.date,
      packet.proofStatus,
      packet.reportSubjectId,
      packet.standupEvidenceRecordId ?? null,
      packet.totalSeconds,
      packet.entryCount,
      packet.taskCount,
      packet.missingProofCount,
      packet.blockerCount,
      JSON.stringify(packet.evidenceSummary),
      JSON.stringify(packet.fabricTaskProof),
      JSON.stringify(packet),
      packet.generatedAt,
      updatedAt,
    ],
  );
  const stored = await getDailyProofPacketByDate(packet.date);
  if (!stored) throw new Error('Could not create daily proof packet.');
  return stored;
}

export async function getDailyProofPacketByDate(date: string): Promise<DailyProofPacket | null> {
  const row = await get<any>('SELECT * FROM daily_proof_packets WHERE date = ?', [date]);
  return row ? rowToDailyProofPacket(row) : null;
}

// Fabric task ledger
export type FabricTaskHistoryWriteResult = 'appended' | 'duplicate' | 'conflict';

export interface FabricTaskListInput {
  tenantId?: string;
  assigneeMemberId?: string;
  projectId?: string;
  workEntryId?: string;
  status?: ThoughtseedFabricTask['status'];
  limit?: number;
}

function fabricTaskPayload(task: ThoughtseedFabricTask): Record<string, unknown> {
  const { history: _history, ...rest } = task;
  return rest as Record<string, unknown>;
}

function fabricEventRowId(taskId: string, eventId: string): string {
  return `fabric_event_${createHash('sha256').update(`${taskId}:${eventId}`).digest('hex').slice(0, 24)}`;
}

function rowToFabricTaskHistoryEvent(r: any): ThoughtseedFabricTaskHistoryEvent {
  return {
    eventId: r.event_id,
    timestamp: r.timestamp,
    actor: r.actor,
    source: r.source,
    type: r.type,
    payloadHash: r.payload_hash,
    payload: parseJsonRecord(r.payload),
    correlationId: r.correlation_id ?? undefined,
  };
}

function rowToFabricTask(r: any, history: ThoughtseedFabricTaskHistoryEvent[]): ThoughtseedFabricTask {
  const payload = parseJsonRecord(r.payload) as Partial<ThoughtseedFabricTask>;
  return {
    ...payload,
    taskId: r.task_id,
    directiveId: r.directive_id ?? undefined,
    correlationId: r.correlation_id ?? undefined,
    projectId: r.project_id ?? undefined,
    projectName: r.project_name ?? undefined,
    workEntryId: r.work_entry_id ?? undefined,
    title: r.title,
    assigneeMemberId: r.assignee_member_id,
    status: r.status,
    proofStatus: r.proof_status ?? payload.proofStatus,
    workMode: r.work_mode ?? undefined,
    workModeLocked: !!r.work_mode_locked,
    overrideCount: Number(r.override_count ?? 0),
    evidenceStrength: r.evidence_strength,
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    history,
    updatedAt: r.updated_at,
  } as ThoughtseedFabricTask;
}

export async function listFabricTaskHistoryEvents(taskId: string): Promise<ThoughtseedFabricTaskHistoryEvent[]> {
  const rows = await all<any>(
    `SELECT * FROM fabric_task_history_events
     WHERE task_id = ?
     ORDER BY timestamp ASC, event_id ASC`,
    [taskId],
  );
  return rows.map(rowToFabricTaskHistoryEvent);
}

export async function getFabricTask(taskId: string): Promise<ThoughtseedFabricTask | null> {
  const row = await get<any>('SELECT * FROM fabric_tasks WHERE task_id = ?', [taskId]);
  if (!row) return null;
  return rowToFabricTask(row, await listFabricTaskHistoryEvents(taskId));
}

export async function listFabricTasks(input: FabricTaskListInput = {}): Promise<ThoughtseedFabricTask[]> {
  const clauses: string[] = [];
  const params: any[] = [];
  if (input.tenantId) {
    clauses.push('tenant_id = ?');
    params.push(input.tenantId);
  }
  if (input.assigneeMemberId) {
    clauses.push('assignee_member_id = ?');
    params.push(input.assigneeMemberId);
  }
  if (input.projectId) {
    clauses.push('project_id = ?');
    params.push(input.projectId);
  }
  if (input.workEntryId) {
    clauses.push('work_entry_id = ?');
    params.push(input.workEntryId);
  }
  if (input.status) {
    clauses.push('status = ?');
    params.push(input.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  params.push(cappedLimit(input.limit, 200, 1000));
  const rows = await all<any>(
    `SELECT * FROM fabric_tasks ${where}
     ORDER BY updated_at DESC, task_id ASC
     LIMIT ?`,
    params,
  );
  const tasks: ThoughtseedFabricTask[] = [];
  for (const row of rows) {
    tasks.push(rowToFabricTask(row, await listFabricTaskHistoryEvents(row.task_id)));
  }
  return tasks;
}

export async function recordFabricTaskHistoryConflict(input: {
  taskId: string;
  eventId: string;
  existingPayloadHash?: string | null;
  incomingPayloadHash: string;
  incomingPayload?: Record<string, unknown>;
  createdAt?: string;
}): Promise<void> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  await run(
    `INSERT OR IGNORE INTO fabric_task_history_conflicts (
       id, task_id, event_id, existing_payload_hash, incoming_payload_hash, incoming_payload, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      makeAssistantId('fabric_conflict'),
      input.taskId,
      input.eventId,
      input.existingPayloadHash ?? null,
      input.incomingPayloadHash,
      JSON.stringify(input.incomingPayload ?? {}),
      createdAt,
    ],
  );
}

export async function listFabricTaskHistoryConflicts(taskId: string): Promise<Array<{
  taskId: string;
  eventId: string;
  existingPayloadHash: string | null;
  incomingPayloadHash: string;
  incomingPayload: Record<string, unknown>;
  createdAt: string;
}>> {
  const rows = await all<any>(
    `SELECT * FROM fabric_task_history_conflicts
     WHERE task_id = ?
     ORDER BY created_at DESC, id DESC`,
    [taskId],
  );
  return rows.map((row) => ({
    taskId: row.task_id,
    eventId: row.event_id,
    existingPayloadHash: row.existing_payload_hash ?? null,
    incomingPayloadHash: row.incoming_payload_hash,
    incomingPayload: parseJsonRecord(row.incoming_payload),
    createdAt: row.created_at,
  }));
}

export async function upsertFabricTaskHistoryEvent(
  taskId: string,
  event: ThoughtseedFabricTaskHistoryEvent,
): Promise<FabricTaskHistoryWriteResult> {
  const existing = await get<any>(
    'SELECT * FROM fabric_task_history_events WHERE task_id = ? AND event_id = ?',
    [taskId, event.eventId],
  );
  if (existing?.payload_hash === event.payloadHash) return 'duplicate';
  if (existing) {
    await recordFabricTaskHistoryConflict({
      taskId,
      eventId: event.eventId,
      existingPayloadHash: existing.payload_hash,
      incomingPayloadHash: event.payloadHash,
      incomingPayload: event.payload,
      createdAt: event.timestamp,
    });
    return 'conflict';
  }
  await run(
    `INSERT INTO fabric_task_history_events (
       id, task_id, event_id, timestamp, actor, source, type, payload_hash, payload, correlation_id, created_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      fabricEventRowId(taskId, event.eventId),
      taskId,
      event.eventId,
      event.timestamp,
      event.actor,
      event.source,
      event.type,
      event.payloadHash,
      JSON.stringify(event.payload ?? {}),
      event.correlationId ?? null,
      event.timestamp,
    ],
  );
  return 'appended';
}

export async function upsertFabricTask(task: ThoughtseedFabricTask, tenantId = 'cambium'): Promise<ThoughtseedFabricTask> {
  const createdAt = task.history[0]?.timestamp ?? task.updatedAt ?? new Date().toISOString();
  await run(
    `INSERT INTO fabric_tasks (
       task_id, tenant_id, assignee_member_id, directive_id, correlation_id, project_id, project_name,
       work_entry_id, status, work_mode, work_mode_locked, override_count, evidence_strength,
       proof_status, source, title, payload, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(task_id) DO UPDATE SET
       tenant_id = excluded.tenant_id,
       assignee_member_id = excluded.assignee_member_id,
       directive_id = excluded.directive_id,
       correlation_id = excluded.correlation_id,
       project_id = excluded.project_id,
       project_name = excluded.project_name,
       work_entry_id = excluded.work_entry_id,
       status = excluded.status,
       work_mode = excluded.work_mode,
       work_mode_locked = excluded.work_mode_locked,
       override_count = excluded.override_count,
       evidence_strength = excluded.evidence_strength,
       proof_status = excluded.proof_status,
       source = excluded.source,
       title = excluded.title,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [
      task.taskId,
      tenantId,
      task.assigneeMemberId,
      task.directiveId ?? null,
      task.correlationId ?? null,
      task.projectId ?? null,
      task.projectName ?? null,
      task.workEntryId ?? null,
      task.status,
      task.workMode ?? null,
      task.workModeLocked ? 1 : 0,
      task.overrideCount,
      task.evidenceStrength,
      task.proofStatus ?? null,
      task.source ?? null,
      task.title,
      JSON.stringify(fabricTaskPayload(task)),
      createdAt,
      task.updatedAt,
    ],
  );
  for (const event of task.history) {
    await upsertFabricTaskHistoryEvent(task.taskId, event);
  }
  const stored = await getFabricTask(task.taskId);
  if (!stored) throw new Error('Could not create Fabric task record.');
  return stored;
}

export async function upsertFabricTasks(tasks: ThoughtseedFabricTask[], tenantId = 'cambium'): Promise<ThoughtseedFabricTask[]> {
  for (const task of tasks) {
    await upsertFabricTask(task, tenantId);
  }
  return listFabricTasks({ limit: Math.max(200, tasks.length) });
}

// Resilience handoffs
function rowToHandoff(r: any): HandoffRecord {
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(r.payload || '{}');
  } catch {
    payload = {};
  }
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    title: r.title,
    payload,
    error: r.error ?? null,
    attempts: r.attempts ?? 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    nextRetryAt: r.next_retry_at ?? null,
  };
}

export async function listHandoffs(status?: HandoffStatus): Promise<HandoffRecord[]> {
  const rows = status
    ? await all<any>('SELECT * FROM handoffs WHERE status = ? ORDER BY updated_at DESC LIMIT 100', [status])
    : await all<any>('SELECT * FROM handoffs ORDER BY updated_at DESC LIMIT 100');
  return rows.map(rowToHandoff);
}

export async function getHandoff(id: string): Promise<HandoffRecord | null> {
  const row = await get<any>('SELECT * FROM handoffs WHERE id = ?', [id]);
  return row ? rowToHandoff(row) : null;
}

export async function recordHandoff(input: HandoffInput): Promise<HandoffRecord> {
  const now = new Date().toISOString();
  const id = `handoff_${now.replace(/[-:.TZ]/g, '')}_${Math.random().toString(16).slice(2, 10)}`;
  await run(
    `INSERT INTO handoffs (id, kind, status, title, payload, error, attempts, created_at, updated_at, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.kind,
      input.status,
      input.title,
      JSON.stringify(input.payload ?? {}),
      input.error ?? null,
      0,
      now,
      now,
      input.nextRetryAt ?? null,
    ],
  );
  const created = await getHandoff(id);
  if (!created) throw new Error('Could not create handoff record.');
  return created;
}

export async function updateHandoff(
  id: string,
  patch: Partial<Pick<HandoffRecord, 'status' | 'title' | 'payload' | 'error' | 'attempts' | 'nextRetryAt'>>,
): Promise<HandoffRecord> {
  const sets: string[] = [];
  const vals: any[] = [];
  if (patch.status !== undefined) { sets.push('status = ?'); vals.push(patch.status); }
  if (patch.title !== undefined) { sets.push('title = ?'); vals.push(patch.title); }
  if (patch.payload !== undefined) { sets.push('payload = ?'); vals.push(JSON.stringify(patch.payload)); }
  if (patch.error !== undefined) { sets.push('error = ?'); vals.push(patch.error); }
  if (patch.attempts !== undefined) { sets.push('attempts = ?'); vals.push(patch.attempts); }
  if (patch.nextRetryAt !== undefined) { sets.push('next_retry_at = ?'); vals.push(patch.nextRetryAt); }
  sets.push('updated_at = ?');
  vals.push(new Date().toISOString());
  vals.push(id);
  await run(`UPDATE handoffs SET ${sets.join(', ')} WHERE id = ?`, vals);
  const updated = await getHandoff(id);
  if (!updated) throw new Error('Handoff record no longer exists.');
  return updated;
}
