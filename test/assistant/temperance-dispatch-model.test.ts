import { describe, expect, it } from 'vitest';
import {
  buildTemperanceParallelAgentHandoffRecord,
  buildTemperanceToolHarnessRunPlan,
  deriveTemperanceDispatchEvents,
  deriveTemperanceDispatchLaneStatus,
  deriveTemperanceSkillRecommendations,
} from '../../src/shared/temperance-dispatch';
import { buildThoughtseedFabricTask, FIXTURE_NOW } from './fixtures/builders';

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
});
