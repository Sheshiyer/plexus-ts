import assert from 'node:assert/strict';

process.env.PLEXUS_DB_PATH = process.env.PLEXUS_DB_PATH || ':memory:';

const {
  buildAssistantDailyEvent,
  generateAssistantDailySummary,
  queueAndSendAssistantDailyEvent,
  readDailyAssistantConfirmation,
  validateAssistantDailyEvent,
} = await import('../dist/main/assistant-daily.js');
const { redactForAssistant } = await import('../dist/main/assistant-context.js');
const { closeDb, getAssistantDailyEvent, updateAssistantDailyEvent } = await import('../dist/db/database.js');
const { ASSISTANT_DAILY_EVENT_SCHEMA } = await import('../dist/shared/native-assistant.js');

const now = '2026-07-01T09:00:00.000Z';
const context = {
  generatedAt: now,
  requestedScopes: ['today', 'session_group', 'infra'],
  dateRange: {
    scope: 'today',
    from: '2026-07-01T00:00:00.000Z',
    to: '2026-07-02T00:00:00.000Z',
  },
  projects: [{
    id: 'project_verified',
    name: 'Verified Project',
    clientName: 'Thoughtseed',
    archived: false,
    evidenceStatus: 'matched',
    repo: {
      fullName: 'thoughtseed/verified-project',
      url: 'https://github.com/thoughtseed/verified-project',
      verifiedAt: now,
      status: 'verified',
      required: true,
    },
  }],
  entries: [{
    id: 'entry_verified',
    projectId: 'project_verified',
    description: 'Build assistant daily smoke',
    startTime: now,
    endTime: '2026-07-01T10:00:00.000Z',
    durationSeconds: 3600,
    tags: ['assistant'],
    evidenceStatus: 'matched',
    githubActivityIds: ['activity_verified'],
  }],
  workSummary: {
    totalEntries: 1,
    totalDurationSeconds: 3600,
    evidencedEntries: 1,
    missingEvidenceEntries: 0,
  },
  timer: { running: false },
  evidence: {
    summary: {
      totalEntries: 1,
      evidencedEntries: 1,
      missingEvidenceEntries: 0,
      legacyUnverifiedEntries: 0,
      evidencedSeconds: 3600,
      missingEvidenceSeconds: 0,
      projectRepoCoverage: { project_verified: 'verified' },
    },
    standupEvidence: {
      id: 'standup_2026-07-01',
      date: '2026-07-01',
      totalSeconds: 3600,
      generatedAt: now,
    },
  },
  githubActivity: [],
  agentSessions: {
    enabled: true,
    consentState: 'enabled',
    scanned: 1,
    imported: 1,
    totalPending: 1,
    matchedPending: 1,
    readyPending: 1,
    candidates: [],
    groups: [],
  },
  sessionGroups: [{
    id: 'group_verified',
    key: 'repo:thoughtseed/verified-project',
    label: 'Verified Project',
    projectId: 'project_verified',
    projectName: 'Verified Project',
    repoFullName: 'thoughtseed/verified-project',
    sessionCount: 2,
    providerCounts: { codex: 1, claude: 1 },
    earliestStartedAt: '2026-07-01T08:00:00.000Z',
    latestEndedAt: now,
    averageConfidence: 0.95,
    matchStatus: 'ready',
    themes: ['assistant', 'daily'],
    sessionIds: ['session_codex', 'session_claude'],
  }],
  infra: {
    worker: { connected: true },
    thoughtseedBridge: {
      configured: true,
      connected: true,
      bridgeApiUrl: 'https://curious.thoughtseed.space',
      tenantId: 'cambium',
      memberId: 'shesh',
      lastSeenAt: now,
    },
    updates: null,
    optionalHelpers: {},
  },
  route: { routeKey: 'assistant', updatedAt: now },
  budget: {},
};

const event = buildAssistantDailyEvent({
  date: '2026-07-01',
  memberId: 'shesh',
  context,
  generatedAt: now,
});

assert.equal(event.schema, ASSISTANT_DAILY_EVENT_SCHEMA);
assert.equal(validateAssistantDailyEvent(event).length, 0);
assert.equal(JSON.stringify(redactForAssistant({ token: 'secret-token', event })).includes('secret-token'), false);

const deps = {
  async sendWorker(sentEvent) {
    assert.equal(sentEvent.eventId, event.eventId);
    return {
      ok: true,
      channel: 'worker',
      status: 'sent',
      message: 'dry run accepted',
      artifactRef: `dry-run://${sentEvent.eventId}`,
    };
  },
  async sendBridge() {
    throw new Error('bridge should not be used when worker succeeds');
  },
  async recordHandoff() {
    throw new Error('handoff should not be recorded for successful dry run');
  },
  async getConfirmation(input) {
    return {
      ok: true,
      date: input.date,
      status: 'sent',
      artifactRef: input.artifactRef ?? null,
      message: 'dry run confirmed',
    };
  },
};

const sent = await queueAndSendAssistantDailyEvent(event, {
  now,
  deps,
});
assert.equal(sent.status, 'sent');
assert.equal(sent.artifactRef, `dry-run://${event.eventId}`);

const confirmation = await readDailyAssistantConfirmation({
  date: event.date,
  eventId: event.eventId,
}, deps);
assert.equal(confirmation.status, 'sent');

const skipped = await updateAssistantDailyEvent(event.eventId, {
  status: 'failed',
  error: 'dry-run skipped after smoke confirmation',
  nextRetryAt: null,
  updatedAt: now,
});
assert.equal(skipped.error, 'dry-run skipped after smoke confirmation');
assert.equal((await getAssistantDailyEvent(event.eventId))?.status, 'failed');

const summary = generateAssistantDailySummary(event);
assert.equal(summary.date, event.date);
assert.ok(summary.today.includes('Verified Project'));

closeDb();

console.log(`assistant daily smoke passed: ${event.schema}, queued dry-run ${sent.artifactRef}, marked skipped locally`);
