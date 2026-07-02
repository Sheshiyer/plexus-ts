import assert from 'node:assert/strict';
import {
  buildAssistantContext,
  redactForAssistant,
} from '../dist/main/assistant-context.js';

const now = '2026-07-01T09:00:00.000Z';
const project = {
  id: 'project_verified',
  name: 'Verified Project',
  clientName: 'Thoughtseed',
  color: '#E0FF4F',
  archived: false,
  createdAt: now,
  githubRepoUrl: 'https://github.com/thoughtseed/verified-project',
  githubRepoFullName: 'thoughtseed/verified-project',
  repoVerifiedAt: now,
  repoEvidenceStatus: 'verified',
  evidenceStatus: 'matched',
};
const entry = {
  id: 'entry_verified',
  projectId: project.id,
  description: 'Build assistant context smoke',
  startTime: now,
  endTime: '2026-07-01T10:00:00.000Z',
  durationSeconds: 3600,
  tags: ['assistant'],
  source: 'timer',
  githubRepoUrl: project.githubRepoUrl,
  githubRepoFullName: project.githubRepoFullName,
  evidenceStatus: 'matched',
  evidenceCheckedAt: now,
  githubActivityIds: ['activity_verified'],
};
const activity = {
  id: 'activity_verified',
  projectId: project.id,
  repoFullName: project.githubRepoFullName,
  repoUrl: project.githubRepoUrl,
  kind: 'commit',
  title: 'assistant context smoke',
  url: 'https://github.com/thoughtseed/verified-project/commit/abc123',
  actor: 'plexus',
  occurredAt: now,
  metadata: {
    token: 'super-secret-token',
    safe: 'visible',
  },
};

const snapshot = await buildAssistantContext({
  contextScopes: ['today', 'week', 'project', 'session_group', 'infra', 'app'],
  dateRangeScope: 'today',
  now,
  routeState: { routeKey: 'assistant', selectedProjectId: project.id },
  includeOptionalHelpers: true,
  sources: {
    async listProjects() {
      return [project];
    },
    async listEntries() {
      return [entry];
    },
    async getRunningEntry() {
      return null;
    },
    async listGitHubActivity(projectId) {
      return projectId === project.id ? [activity] : [];
    },
    async agentSessionStatus() {
      return {
        ok: true,
        enabled: true,
        scanned: 1,
        imported: 1,
        totalPending: 1,
        matchedPending: 1,
        readyPending: 1,
        roots: [],
        candidates: [{
          id: 'session_codex',
          provider: 'codex',
          providerSessionId: 'codex-1',
          sourcePath: '/tmp/session.jsonl',
          sourceLabel: 'Codex session',
          sourceHash: 'hash',
          repoRoot: '/repo',
          repoFullName: project.githubRepoFullName,
          projectId: project.id,
          projectName: project.name,
          startedAt: '2026-07-01T08:00:00.000Z',
          endedAt: now,
          lastSeenAt: now,
          title: 'Assistant context smoke',
          summary: 'Deterministic smoke session',
          confidence: 0.98,
          confidenceReasons: ['repo match'],
          matchStatus: 'ready',
          status: 'pending',
        }],
      };
    },
    async workerStatus() {
      return { connected: true };
    },
    async thoughtseedBridgeStatus() {
      return {
        configured: true,
        connected: true,
        bridgeApiUrl: 'https://curious.thoughtseed.space',
        tenantId: 'cambium',
        memberId: 'shesh',
        credentialExpiresAt: '2026-07-08T09:00:00.000Z',
        lastSeenAt: now,
        lastError: null,
      };
    },
    getUpdateStatus() {
      return {
        state: 'idle',
        currentVersion: '0.4.5',
        channel: 'latest',
        updatedAt: now,
        canCheck: true,
        canDownload: false,
        canInstall: false,
      };
    },
    getStandupEvidenceRecord() {
      return {
        id: 'standup_2026-07-01',
        date: '2026-07-01',
        totalSeconds: 3600,
        evidenceSummary: {
          totalEntries: 1,
          evidencedEntries: 1,
          missingEvidenceEntries: 0,
          legacyUnverifiedEntries: 0,
          evidencedSeconds: 3600,
          missingEvidenceSeconds: 0,
          projectRepoCoverage: { [project.id]: 'verified' },
        },
        activity: [activity],
        generatedAt: now,
      };
    },
  },
});

assert.equal(snapshot.projects.length, 1);
assert.equal(snapshot.entries.length, 1);
assert.equal(snapshot.agentSessions.candidates.length, 1);
assert.equal(snapshot.sessionGroups.length, 1);
assert.equal(snapshot.route?.routeKey, 'assistant');
assert.equal(snapshot.budget.entries.totalItems, 1);

const serialized = JSON.stringify(snapshot);
assert.equal(serialized.includes('super-secret-token'), false);
assert.equal(serialized.includes('[redacted]'), true);
assert.deepEqual(redactForAssistant({ accessJwt: 'secret', nested: { cookie: 'session-cookie' } }), {
  accessJwt: '[redacted]',
  nested: { cookie: '[redacted]' },
});

console.log(`assistant context smoke passed: ${snapshot.projects.length} project, ${snapshot.entries.length} entry, ${snapshot.sessionGroups.length} session group, secrets redacted`);
