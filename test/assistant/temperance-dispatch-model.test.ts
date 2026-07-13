import { describe, expect, it } from 'vitest';
import {
  buildTemperanceParallelAgentHandoffRecord,
  buildTemperanceDispatchLaneStatusResult,
  buildTemperanceToolHarnessRunPlan,
  classifyTemperanceDispatchFailure,
  deriveTemperanceDispatchConflicts,
  deriveTemperanceDispatchEvents,
  deriveTemperanceDispatchLaneStatus,
  deriveTemperanceDispatchSessionLinks,
  deriveTemperanceSkillRecommendations,
} from '../../src/shared/temperance-dispatch';
import { buildAgentSessionCandidate, buildThoughtseedFabricTask, FIXTURE_NOW } from './fixtures/builders';

describe('Temperance dispatch shared model', () => {
  it('derives assigned, delegated, blocked, and done lanes from Fabric tasks', () => {
    const lanes = deriveTemperanceDispatchLaneStatus([
      buildThoughtseedFabricTask({ taskId: 'task_assigned', status: 'assigned', workMode: undefined }),
      buildThoughtseedFabricTask({ taskId: 'task_manual', status: 'in_progress', workMode: 'manual' }),
      buildThoughtseedFabricTask({ taskId: 'task_delegated', status: 'in_progress', workMode: 'delegated' }),
      buildThoughtseedFabricTask({ taskId: 'task_blocked', status: 'blocked', workMode: 'delegated' }),
      buildThoughtseedFabricTask({ taskId: 'task_done', status: 'done', workMode: 'delegated' }),
    ]);

    expect(lanes.map((lane) => [lane.key, lane.count])).toEqual([
      ['assigned', 2],
      ['delegated', 1],
      ['blocked', 1],
      ['done', 1],
    ]);
    expect(lanes.find((lane) => lane.key === 'assigned')?.tasks.map((task) => task.taskId).sort()).toEqual(['task_assigned', 'task_manual']);
  });

  it('parses skill hints as recommendations without leaking object metadata or executing unknown names', () => {
    const recommendations = deriveTemperanceSkillRecommendations([
      buildThoughtseedFabricTask({
        taskId: 'task_skill',
        skillHints: [
          'dispatching-parallel-agents',
          { name: 'executing-plans', token: 'secret-value-that-must-not-leak' },
          { skillName: 'custom-safe-skill', apiKey: 'also-secret' },
          { name: '../../bad-path' },
          'https://bad.example/skill',
        ],
      }),
    ]);

    expect(recommendations.map((item) => ({
      skillName: item.skillName,
      known: item.known,
      safety: item.safety,
    }))).toEqual([
      { skillName: 'dispatching-parallel-agents', known: true, safety: 'confirm_required' },
      { skillName: 'executing-plans', known: true, safety: 'confirm_required' },
      { skillName: 'custom-safe-skill', known: false, safety: 'confirm_required' },
    ]);
    expect(JSON.stringify(recommendations)).not.toContain('secret');
  });

  it('recognizes at most eight skill hints resolved by the main-process index', () => {
    const hints = Array.from({ length: 10 }, (_, index) => `indexed-skill-${index}`);
    const labels = Object.fromEntries(hints.map((name, index) => [name, `Indexed Skill ${index}`]));
    const recommendations = deriveTemperanceSkillRecommendations([
      buildThoughtseedFabricTask({ taskId: 'task_indexed', skillHints: hints }),
    ], [], labels).filter((item) => item.source === 'skillHints');

    expect(recommendations).toHaveLength(8);
    expect(recommendations.find((item) => item.skillName === 'indexed-skill-0')).toMatchObject({
      known: true,
      label: 'Indexed Skill 0',
      safety: 'confirm_required',
    });
  });

  it('ranks deterministic recommendations from task and linked session themes', () => {
    const task = buildThoughtseedFabricTask({
      taskId: 'task_themes',
      title: 'Audit release docs and regression tests',
      description: 'Review release workflow evidence and update documentation.',
      workMode: 'delegated',
      skillHints: [],
    });
    const session = buildAgentSessionCandidate({
      id: 'session_themes',
      projectId: 'project_verified',
      title: 'Review release docs and test matrix',
      summary: 'Added docs and vitest coverage.',
      confidence: 95,
    });
    const recommendations = deriveTemperanceSkillRecommendations([task], [session]);

    expect(recommendations.map((item) => item.skillName)).toEqual(expect.arrayContaining([
      'engineering:testing-strategy',
      'engineering:documentation',
      'engineering:code-review',
    ]));
    expect(recommendations.map((item) => item.source)).toEqual(expect.arrayContaining([
      'taskThemes',
      'sessionThemes',
    ]));
    expect(recommendations.every((item) => item.safety === 'confirm_required')).toBe(true);
    expect(recommendations[0].confidence).toBeGreaterThanOrEqual(recommendations.at(-1)?.confidence ?? 0);
    expect(JSON.stringify(recommendations)).not.toContain('/mock/');
  });

  it('projects task history into typed dispatch events with correlation ids and conflict markers', () => {
    const events = deriveTemperanceDispatchEvents([
      buildThoughtseedFabricTask({
        taskId: 'task_events',
        correlationId: 'corr_task',
        status: 'blocked',
        history: [
          {
            eventId: 'event_assigned',
            timestamp: '2026-07-01T08:00:00.000Z',
            actor: 'hermes',
            source: 'hermes',
            type: 'assigned',
            payloadHash: 'hash_assigned',
            payload: { status: 'assigned' },
            correlationId: 'corr_assigned',
          },
          {
            eventId: 'event_conflict',
            timestamp: '2026-07-01T09:00:00.000Z',
            actor: 'plexus',
            source: 'plexus',
            type: 'bridge_conflict',
            payloadHash: 'hash_conflict',
            payload: { reason: 'duplicate_event_payload_mismatch' },
          },
        ],
      }),
    ]);

    expect(events.map((event) => ({
      eventId: event.eventId,
      kind: event.kind,
      conflict: event.conflict,
      correlationId: event.correlationId,
    }))).toEqual([
      {
        eventId: 'event_conflict',
        kind: 'conflict',
        conflict: true,
        correlationId: 'corr_task',
      },
      {
        eventId: 'event_assigned',
        kind: 'assignment',
        conflict: false,
        correlationId: 'corr_assigned',
      },
    ]);
  });

  it('defines tool harness invariants and parallel-agent handoff proof records', () => {
    const plan = buildTemperanceToolHarnessRunPlan({ permission: 'write', timeoutMs: 90000 });
    const handoff = buildTemperanceParallelAgentHandoffRecord({
      parentTaskId: 'task_parent',
      childSessionId: 'agent_child',
      owner: 'codex',
      status: 'running',
      artifactRefs: ['https://github.com/Sheshiyer/plexus-ts/pull/79'],
      correlationId: 'corr_parent',
    });

    expect(plan).toMatchObject({
      visible: true,
      permissions: ['read_only', 'write'],
      auditRequired: true,
      timeoutMs: 90000,
      redactionRequired: true,
    });
    expect(plan.failureKinds).toEqual(['auth', 'quota', 'network', 'validation', 'conflict', 'user_cancel', 'unknown']);
    expect(plan.invariants).toContain('secret-like fields are redacted');
    expect(handoff).toMatchObject({
      id: 'handoff_task_parent_agent_child',
      parentTaskId: 'task_parent',
      childSessionId: 'agent_child',
      evidenceRequired: true,
      evidenceStrength: 'weak_evidence',
      correlationId: 'corr_parent',
    });
    expect(handoff.artifactRefs).toHaveLength(1);
    expect(FIXTURE_NOW).toContain('2026-07-01');
  });

  it('links agent session candidates to dispatch tasks without exposing source paths', () => {
    const links = deriveTemperanceDispatchSessionLinks(
      [
        buildThoughtseedFabricTask({
          taskId: 'task_linked',
          projectId: 'project_verified',
          projectName: 'Verified Project',
          evidenceStrength: 'verified_evidence',
        }),
      ],
      [
        buildAgentSessionCandidate({
          id: 'session_linked',
          provider: 'codex',
          projectId: 'project_verified',
          title: 'Dispatch implementation session',
          createdEntryId: 'entry_agent_1',
          confidence: 91,
        }),
        buildAgentSessionCandidate({
          id: 'session_dismissed',
          projectId: 'project_verified',
          status: 'dismissed',
        }),
      ],
    );

    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      taskId: 'task_linked',
      candidateId: 'session_linked',
      provider: 'codex',
      matchReason: 'project',
      evidenceStrength: 'verified_evidence',
      artifactRefs: ['entry_agent_1'],
    });
    expect(JSON.stringify(links)).not.toContain('/mock/');
  });

  it('builds dispatch diagnostics from lanes, recommendations, sessions, and recent events', () => {
    const result = buildTemperanceDispatchLaneStatusResult({
      tasks: [
        buildThoughtseedFabricTask({
          taskId: 'task_diag_delegated',
          workMode: 'delegated',
          status: 'in_progress',
          skillHints: ['dispatching-parallel-agents'],
          history: [
            {
              eventId: 'event_conflict',
              timestamp: '2026-07-01T10:00:00.000Z',
              actor: 'plexus',
              source: 'plexus',
              type: 'bridge_conflict',
              payloadHash: 'hash_conflict',
              payload: { reason: 'duplicate_event_payload_mismatch' },
            },
          ],
        }),
        buildThoughtseedFabricTask({
          taskId: 'task_diag_done',
          status: 'done',
          workMode: 'delegated',
          updatedAt: '2026-07-01T10:05:00.000Z',
        }),
      ],
      sessions: [buildAgentSessionCandidate({ id: 'session_diag', projectId: 'project_verified', confidence: 90 })],
      generatedAt: FIXTURE_NOW,
    });

    expect(result.diagnostics).toMatchObject({
      totalTasks: 2,
      activeTasks: 1,
      delegatedTasks: 1,
      doneTasks: 1,
      conflictCount: 1,
      linkedSessionCount: 2,
    });
    expect(result.diagnostics.recommendationCount).toBeGreaterThan(0);
    expect(result.diagnostics.lastEventAt).toBe('2026-07-01T10:00:00.000Z');
  });

  it('builds redacted runtime diagnostics with correlation ids, conflict records, and local smoke', () => {
    const result = buildTemperanceDispatchLaneStatusResult({
      tasks: [
        buildThoughtseedFabricTask({
          taskId: 'task_runtime',
          correlationId: 'corr_runtime',
          title: 'Dispatch delegated agent smoke',
          workMode: 'delegated',
          status: 'blocked',
          skillHints: [{ name: 'dispatching-parallel-agents', token: 'must-not-leak' }],
          history: [
            {
              eventId: 'event_runtime_assigned',
              timestamp: '2026-07-01T09:00:00.000Z',
              actor: 'hermes',
              source: 'hermes',
              type: 'assigned',
              payloadHash: 'hash_assigned',
              payload: { status: 'assigned', token: 'redacted' },
              correlationId: 'corr_runtime_assigned',
            },
          ],
        }),
      ],
      conflicts: [
        {
          taskId: 'task_runtime',
          eventId: 'event_runtime_assigned',
          existingPayloadHash: 'hash_assigned',
          incomingPayloadHash: 'hash_changed',
          incomingPayload: {
            status: 'blocked',
            reason: 'duplicate_event_payload_mismatch',
            token: 'secret-token',
            sourcePath: '/mock/secret/session.jsonl',
          },
          createdAt: '2026-07-01T09:10:00.000Z',
        },
      ],
      generatedAt: FIXTURE_NOW,
    });

    expect(result.runtime.correlationIds).toEqual(expect.arrayContaining(['corr_runtime', 'corr_runtime_assigned']));
    expect(result.runtime.conflicts).toEqual([
      expect.objectContaining({
        taskId: 'task_runtime',
        eventId: 'event_runtime_assigned',
        incomingPayloadHash: 'hash_changed',
        payloadSummary: 'blocked · duplicate_event_payload_mismatch',
        status: 'needs_review',
      }),
    ]);
    expect(result.runtime.supportPacket).toMatchObject({
      packetId: 'support_2026-07-01T09_00_00_000Z',
      localOnly: true,
      conflictEventIds: ['event_runtime_assigned'],
      boundary: expect.stringContaining('no live Cambium'),
    });
    expect(result.runtime.supportPacket.redactions).toEqual(expect.arrayContaining([
      'bridge tokens',
      'agent session source paths',
      'raw conflict payloads',
    ]));
    expect(result.runtime.localSmoke.ok).toBe(true);
    expect(result.runtime.localSmoke.checks.map((check) => check.name)).toEqual(expect.arrayContaining([
      'recommendations-confirm-required',
      'conflicts-renderer-safe',
      'support-packet-redacted',
      'tool-harness-bounded',
    ]));
    expect(JSON.stringify(result.runtime)).not.toMatch(/secret-token|sourcePath|session\.jsonl|must-not-leak/);
  });

  it('deduplicates explicit conflict events and stored conflict rows for review', () => {
    const conflicts = deriveTemperanceDispatchConflicts(
      [
        buildThoughtseedFabricTask({
          taskId: 'task_conflict',
          correlationId: 'corr_conflict',
          history: [
            {
              eventId: 'event_conflict',
              timestamp: '2026-07-01T09:00:00.000Z',
              actor: 'plexus',
              source: 'plexus',
              type: 'bridge_conflict',
              payloadHash: 'hash_changed',
              payload: { reason: 'duplicate_event_payload_mismatch' },
            },
          ],
        }),
      ],
      [
        {
          taskId: 'task_conflict',
          eventId: 'event_conflict',
          existingPayloadHash: 'hash_original',
          incomingPayloadHash: 'hash_changed',
          incomingPayload: { reason: 'duplicate_event_payload_mismatch', token: 'hidden' },
          createdAt: '2026-07-01T09:05:00.000Z',
        },
      ],
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      taskId: 'task_conflict',
      eventId: 'event_conflict',
      correlationId: 'corr_conflict',
      existingPayloadHash: 'hash_original',
      incomingPayloadHash: 'hash_changed',
      status: 'needs_review',
    });
    expect(JSON.stringify(conflicts)).not.toContain('hidden');
  });

  it('redacts secret-shaped text from renderer conflict summaries', () => {
    const conflicts = deriveTemperanceDispatchConflicts(
      [buildThoughtseedFabricTask({ taskId: 'task_redact', correlationId: 'corr_redact' })],
      [
        {
          taskId: 'task_redact',
          eventId: 'event_redact',
          existingPayloadHash: 'hash_original',
          incomingPayloadHash: 'hash_changed',
          incomingPayload: {
            status: 'blocked',
            reason: 'Bearer abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz.abcdefghijklmnopqrstuvwxyz',
            evidence: {
              value: 'api_key=sk_test_1234567890abcdef at /Users/example/.tokens/session.jsonl',
            },
          },
          createdAt: '2026-07-01T09:05:00.000Z',
        },
      ],
    );

    expect(conflicts[0]?.payloadSummary).toContain('bearer [redacted]');
    expect(conflicts[0]?.payloadSummary).toContain('api_key=[redacted]');
    expect(conflicts[0]?.payloadSummary).not.toMatch(/abcdefghijklmnopqrstuvwxyz|sk_test|\/Users\/example/);
  });

  it('classifies dispatch failure kinds and clamps tool permission plans', () => {
    expect(buildTemperanceToolHarnessRunPlan({ permission: 'read_only', timeoutMs: 1 }).permissions).toEqual(['read_only']);
    expect(buildTemperanceToolHarnessRunPlan({ permission: 'admin', timeoutMs: 999999 }).permissions).toEqual(['read_only', 'write', 'admin']);
    expect(buildTemperanceToolHarnessRunPlan({ timeoutMs: 1 }).timeoutMs).toBe(5000);
    expect(buildTemperanceToolHarnessRunPlan({ timeoutMs: 999999 }).timeoutMs).toBe(600000);

    expect(classifyTemperanceDispatchFailure(new Error('Unauthorized token'))).toBe('auth');
    expect(classifyTemperanceDispatchFailure('429 quota exceeded')).toBe('quota');
    expect(classifyTemperanceDispatchFailure('network timeout')).toBe('network');
    expect(classifyTemperanceDispatchFailure('schema validation failed')).toBe('validation');
    expect(classifyTemperanceDispatchFailure('duplicate event conflict')).toBe('conflict');
    expect(classifyTemperanceDispatchFailure('user cancelled')).toBe('user_cancel');
    expect(classifyTemperanceDispatchFailure('strange failure')).toBe('unknown');
  });
});
