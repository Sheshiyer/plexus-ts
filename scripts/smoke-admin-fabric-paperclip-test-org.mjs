import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { historyEventFromThoughtseedDirective, taskFromThoughtseedDirective } from '../dist/shared/thoughtseed-fabric-task.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = new Set(process.argv.slice(2));
const WRITE_MODE = args.has('--write');
const JSON_MODE = args.has('--json');

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : fallback;
}

function normalizeApiBase(value) {
  const raw = (value || 'http://127.0.0.1:3100/api').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

const API_BASE = normalizeApiBase(
  argValue('--api-base')
  || process.env.PAPERCLIP_ADMIN_FABRIC_API
  || process.env.PAPERCLIP_API
  || process.env.PAPERCLIP_API_URL
  || '',
);
const TOKEN = (
  process.env.PAPERCLIP_API_TOKEN
  || process.env.PAPERCLIP_API_KEY
  || process.env.PAPERCLIP_ADMIN_TOKEN
  || ''
).trim();
const COMPANY_ID = argValue('--company-id', process.env.PAPERCLIP_ADMIN_FABRIC_COMPANY_ID || process.env.PAPERCLIP_COMPANY_ID || '');
const COMPANY_NAME = argValue('--company-name', process.env.PAPERCLIP_ADMIN_FABRIC_COMPANY_NAME || 'Plexus Fabric Test Admin Smoke');
const COMPANY_PREFIX = argValue('--company-prefix', process.env.PAPERCLIP_ADMIN_FABRIC_COMPANY_PREFIX || 'TST');
const MEMBER_ID = argValue('--member-id', process.env.PLEXUS_ADMIN_FABRIC_MEMBER_ID || 'plexus-admin-smoke-employee');
const TENANT_ID = argValue('--tenant-id', process.env.PLEXUS_ADMIN_FABRIC_TENANT_ID || 'cambium-test');
const EVIDENCE_PATH = argValue(
  '--evidence',
  process.env.PLEXUS_ADMIN_FABRIC_EVIDENCE_PATH || '/tmp/plexus-admin-fabric-paperclip-smoke.json',
);

function testMarkerText(company) {
  const metadata = company?.metadata && typeof company.metadata === 'object'
    ? Object.entries(company.metadata).map(([key, value]) => `${key}:${String(value)}`).join(' ')
    : '';
  return [
    company?.name,
    company?.description,
    company?.issuePrefix,
    metadata,
  ].filter(Boolean).join(' ').toLowerCase();
}

function hasExplicitTestMarker(company) {
  const text = testMarkerText(company);
  const prefix = String(company?.issuePrefix || '').trim().toLowerCase();
  return /\b(test|disposable|sandbox|smoke|fixture|nonprod|non-production|qa|temp|temporary)\b/.test(text)
    || ['tst', 'test', 'qa', 'tmp', 'smk'].includes(prefix);
}

function isThoughtseedCompany(company) {
  const name = String(company?.name || '').toLowerCase();
  const prefix = String(company?.issuePrefix || '').trim().toLowerCase();
  return name.includes('thoughtseed') || prefix === 'tho';
}

function assertDisposableCompany(company) {
  if (!company?.id) throw new Error('Paperclip test company is missing an id.');
  if (isThoughtseedCompany(company)) {
    throw new Error(`Refusing to write to Thoughtseed company ${company.name} (${company.id}).`);
  }
  if (!hasExplicitTestMarker(company)) {
    throw new Error(`Refusing to write to ${company.name || company.id}; company lacks an explicit test/disposable marker.`);
  }
}

async function paperclipJson(route, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (TOKEN) headers.set('Authorization', `Bearer ${TOKEN}`);
  const res = await fetch(`${API_BASE}${route}`, { ...options, headers });
  const bodyText = await res.text();
  let body;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    throw new Error(`Paperclip ${route} returned ${res.status} non-JSON: ${bodyText.slice(0, 200)}`);
  }
  if (!res.ok) {
    const message = body?.error?.message ?? body?.error ?? body?.message ?? `HTTP ${res.status}`;
    throw new Error(`Paperclip ${route} failed: ${message}`);
  }
  return body;
}

async function createCompany() {
  const payload = {
    name: COMPANY_NAME,
    description: 'Disposable test org for Plexus admin Fabric smoke; safe to keep or remove after proof.',
    issuePrefix: COMPANY_PREFIX,
    budgetMonthlyCents: 0,
    feedbackDataSharingEnabled: false,
    requireBoardApprovalForNewAgents: false,
    metadata: {
      disposable: true,
      testOrg: true,
      source: 'plexus-admin-fabric-smoke',
    },
  };
  const created = await paperclipJson('/companies', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return created && typeof created === 'object' ? created : null;
}

async function findOrCreateCompany() {
  const companies = await paperclipJson('/companies');
  if (!Array.isArray(companies)) throw new Error('Paperclip /companies did not return a list.');
  const existing = COMPANY_ID
    ? companies.find((company) => company.id === COMPANY_ID)
    : companies.find((company) => String(company.name || '').trim().toLowerCase() === COMPANY_NAME.toLowerCase())
      || companies.find((company) => hasExplicitTestMarker(company) && !isThoughtseedCompany(company));
  if (existing) return { company: existing, created: false };
  if (!WRITE_MODE) {
    throw new Error(`Paperclip test company "${COMPANY_NAME}" is absent. Re-run with --write to create it.`);
  }
  const created = await createCompany();
  const refreshed = await paperclipJson('/companies');
  const company = Array.isArray(refreshed)
    ? refreshed.find((row) => row.id === created?.id)
      || refreshed.find((row) => String(row.name || '').trim().toLowerCase() === COMPANY_NAME.toLowerCase())
    : null;
  if (!company) throw new Error('Paperclip company create returned but the test company was not visible in /companies.');
  return { company, created: true };
}

async function findOrCreateAgent(company) {
  const agents = await paperclipJson(`/companies/${encodeURIComponent(company.id)}/agents`);
  if (!Array.isArray(agents)) throw new Error('Paperclip company agents endpoint did not return a list.');
  const existing = agents.find((agent) => String(agent.name || '').trim().toLowerCase() === 'plexus admin smoke employee');
  if (existing) return { agent: existing, created: false };
  if (!WRITE_MODE) return { agent: null, created: false };

  const created = await paperclipJson(`/companies/${encodeURIComponent(company.id)}/agents`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'Plexus Admin Smoke Employee',
      role: 'engineer',
      title: 'Plexus Admin Smoke Employee',
      icon: 'terminal',
      capabilities: 'Disposable employee target for Plexus admin Fabric smoke.',
      adapterType: 'process',
      adapterConfig: {
        cwd: __dirname,
        command: 'true',
      },
      runtimeConfig: {
        heartbeat: {
          enabled: false,
          intervalSec: 1800,
          wakeOnDemand: false,
        },
      },
      budgetMonthlyCents: 0,
      permissions: { canCreateAgents: false },
      metadata: {
        disposable: true,
        testOrg: true,
        source: 'plexus-admin-fabric-smoke',
        localAgentId: MEMBER_ID,
      },
    }),
  });
  return { agent: created, created: true };
}

async function findOrCreateIssue(company, agent) {
  const issues = await paperclipJson(`/companies/${encodeURIComponent(company.id)}/issues`);
  if (!Array.isArray(issues)) throw new Error('Paperclip company issues endpoint did not return a list.');
  const title = '[Plexus Admin Smoke] Emulate admin Fabric assignment';
  const existing = issues.find((issue) => String(issue.title || '').trim() === title);
  if (existing) return { issue: existing, created: false };
  if (!WRITE_MODE) return { issue: null, created: false };

  const created = await paperclipJson(`/companies/${encodeURIComponent(company.id)}/issues`, {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: 'Disposable issue created by Plexus admin Fabric smoke to emulate assignment, work-mode choice, and report evidence.',
      priority: 'medium',
      status: 'todo',
      assigneeAgentId: agent?.id ?? null,
      metadata: {
        disposable: true,
        testOrg: true,
        source: 'plexus-admin-fabric-smoke',
        memberId: MEMBER_ID,
      },
    }),
  });
  return { issue: created, created: true };
}

function makeDirective(company, issue) {
  const issuedAt = new Date().toISOString();
  const taskId = `paperclip:${issue?.id || 'dry-run-issue'}`;
  const correlationId = `plexus-admin-fabric-smoke:${taskId}`;
  return {
    id: `paperclip-admin-smoke-${Date.now()}`,
    memberId: MEMBER_ID,
    tenantId: TENANT_ID,
    direction: 'downstream',
    issuedAt,
    payload: {
      type: 'fabric_task_assignment',
      kind: 'fabric_task_assignment',
      schema: 'thoughtseed.fabric_task_assignment.v1',
      source: 'paperclip',
      tenantId: TENANT_ID,
      eventId: `${correlationId}:assigned`,
      correlationId,
      issuedAt,
      target: { memberId: MEMBER_ID, tenantId: TENANT_ID, surface: 'plexus-agent-fabric' },
      task: {
        taskId,
        projectId: company.id,
        projectName: company.name,
        title: issue?.title || '[Plexus Admin Smoke] Emulate admin Fabric assignment',
        description: issue?.description || 'Dry-run Paperclip admin Fabric assignment.',
        priority: 'normal',
        taskType: 'operations',
        assigneeMemberId: MEMBER_ID,
        assignedBy: 'paperclip-admin-test',
        source: 'paperclip',
        eventId: `${correlationId}:assigned`,
        correlationId,
        proofRequired: 'Completion note or disposable evidence from the Plexus admin smoke.',
        autonomyBoundary: 'Non-destructive disposable/test Paperclip company only.',
      },
    },
  };
}

function makeOverrideDirective(parsedTask) {
  const issuedAt = new Date().toISOString();
  return {
    id: `paperclip-admin-override-${Date.now()}`,
    memberId: MEMBER_ID,
    tenantId: TENANT_ID,
    direction: 'downstream',
    issuedAt,
    payload: {
      type: 'fabric_task_history_event',
      kind: 'fabric_task_history_event',
      schema: 'thoughtseed.fabric_task_history_event.v1',
      source: 'paperclip',
      tenantId: TENANT_ID,
      event: {
        eventId: `paperclip-admin-override:${parsedTask.taskId}`,
        timestamp: issuedAt,
        actor: 'paperclip-admin-test',
        source: 'paperclip',
        type: 'workMode_override',
        correlationId: parsedTask.correlationId,
        payload: {
          taskId: parsedTask.taskId,
          projectId: parsedTask.projectId,
          previousWorkMode: null,
          workMode: 'delegated',
          reason: 'Disposable admin smoke verifies one-time override directive parsing.',
        },
      },
    },
  };
}

async function main() {
  const health = await paperclipJson('/health');
  const { company, created: companyCreated } = await findOrCreateCompany();
  assertDisposableCompany(company);

  const { agent, created: agentCreated } = await findOrCreateAgent(company);
  if (WRITE_MODE && !agent?.id) throw new Error('Paperclip write mode requires an agent record.');
  const { issue, created: issueCreated } = await findOrCreateIssue(company, agent);
  if (WRITE_MODE && !issue?.id) throw new Error('Paperclip write mode requires an issue record.');

  const assignmentDirective = makeDirective(company, issue);
  const parsedAssignment = taskFromThoughtseedDirective(assignmentDirective, MEMBER_ID, TENANT_ID);
  if (!parsedAssignment) throw new Error('Plexus Fabric parser rejected the Paperclip assignment directive.');
  if (parsedAssignment.task.source !== 'paperclip') {
    throw new Error(`Plexus Fabric parser did not preserve Paperclip task source: ${parsedAssignment.task.source || 'missing'}`);
  }
  const overrideDirective = makeOverrideDirective(parsedAssignment.task);
  const parsedOverride = historyEventFromThoughtseedDirective(overrideDirective);
  if (!parsedOverride) throw new Error('Plexus Fabric parser rejected the Paperclip admin override directive.');

  const summary = {
    ok: true,
    mode: WRITE_MODE ? 'write' : 'dry-run',
    apiBase: API_BASE,
    health,
    safety: {
      companyId: company.id,
      companyName: company.name,
      companyPrefix: company.issuePrefix ?? null,
      explicitTestMarker: hasExplicitTestMarker(company),
      thoughtseedOrg: isThoughtseedCompany(company),
      writesAllowed: hasExplicitTestMarker(company) && !isThoughtseedCompany(company),
    },
    paperclip: {
      companyCreated,
      agentId: agent?.id ?? null,
      agentCreated,
      issueId: issue?.id ?? null,
      issueIdentifier: issue?.identifier ?? null,
      issueCreated,
    },
    plexusFlow: {
      assignmentTaskId: parsedAssignment.task.taskId,
      assignmentSource: parsedAssignment.task.source,
      assigneeMemberId: parsedAssignment.task.assigneeMemberId,
      assignmentStatus: parsedAssignment.task.status,
      overrideTaskId: parsedOverride.taskId,
      overrideEventType: parsedOverride.event.type,
      overrideWorkMode: parsedOverride.event.payload.workMode,
    },
    evidencePath: EVIDENCE_PATH,
  };

  await writeFile(EVIDENCE_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  if (JSON_MODE) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`admin Fabric Paperclip smoke passed (${summary.mode})`);
    console.log(`company: ${summary.safety.companyName} (${summary.safety.companyId})`);
    console.log(`agent: ${summary.paperclip.agentId || 'dry-run'}; issue: ${summary.paperclip.issueIdentifier || summary.paperclip.issueId || 'dry-run'}`);
    console.log(`parsed: ${summary.plexusFlow.assignmentTaskId} -> ${summary.plexusFlow.overrideEventType}/${summary.plexusFlow.overrideWorkMode}`);
    console.log(`evidence: ${summary.evidencePath}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
