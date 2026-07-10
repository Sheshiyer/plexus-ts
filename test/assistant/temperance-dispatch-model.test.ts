import { describe, expect, it } from 'vitest';
import {
  buildTemperanceParallelAgentHandoffRecord,
  buildTemperanceDispatchLaneStatusResult,
  buildTemperanceToolHarnessRunPlan,
  classifyTemperanceDispatchFailure,
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
