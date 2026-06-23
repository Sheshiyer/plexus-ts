import assert from 'node:assert/strict';
import {
  canonicalJson,
  hashBridgePayload,
  isBridgeTokenExpired,
  signBridgeMessage,
} from '../dist/shared/thoughtseed-bridge-crypto.js';
import { historyEventFromThoughtseedDirective, taskFromThoughtseedDirective } from '../dist/shared/thoughtseed-fabric-task.js';

const unordered = { z: 1, a: { d: undefined, b: 2 }, list: [{ y: 2, x: 1 }] };
assert.equal(canonicalJson(unordered), '{"a":{"b":2},"list":[{"x":1,"y":2}],"z":1}');
assert.equal(hashBridgePayload(unordered), hashBridgePayload({ list: [{ x: 1, y: 2 }], a: { b: 2 }, z: 1 }));
assert.notEqual(hashBridgePayload(unordered), hashBridgePayload({ list: [{ x: 1, y: 3 }], a: { b: 2 }, z: 1 }));

const message = {
  version: '1.0.0',
  id: 'plexus_test',
  timestamp: '2026-06-21T00:00:00.000Z',
  direction: 'upstream',
  tenantId: 'cambium',
  memberId: 'shesh',
  payload: { type: 'heartbeat', value: 1 },
};
const signed = signBridgeMessage(message, 'member-token-fixture');
assert.equal(signed.signature, '7iQ6hwoW3Us7Y4Lql2J1-0hxehLwMBVWcnDzou4iGVI');
assert.equal(signBridgeMessage({ ...signed, payload: { type: 'heartbeat', value: 2 } }, 'member-token-fixture').signature === signed.signature, false);
assert.equal(isBridgeTokenExpired('2026-06-21T00:00:00.000Z', Date.parse('2026-06-21T00:00:01.000Z')), true);
assert.equal(isBridgeTokenExpired('2026-06-21T00:00:02.000Z', Date.parse('2026-06-21T00:00:01.000Z')), false);

const cambiumAssignmentDirective = {
  id: 'assign-1',
  memberId: 'mathis',
  direction: 'downstream',
  issuedAt: '2026-06-22T08:00:00.000Z',
  payload: {
    type: 'project_task_assignment',
    kind: 'project_task_assignment',
    schema: 'thoughtseed.project_task_assignment.v1',
    source: 'cambium',
    eventId: 'cambium:fitcheck-product:task-fitcheck-brief:assigned',
    correlationId: 'cambium:fitcheck-product:task-fitcheck-brief:assigned',
    issuedAt: '2026-06-22T08:00:00.000Z',
    target: { memberId: 'mathis', surface: 'plexus-agent-fabric' },
    task: {
      taskId: 'task-fitcheck-brief',
      projectId: 'fitcheck-product',
      projectName: 'FitCheck Product',
      questId: 'quest-77',
      clientId: 'fitcheck',
      clientName: 'FitCheck',
      title: 'Prepare branch proof packet',
      description: 'Collect branch, PR, and preview evidence before final report.',
      priority: 'high',
      taskType: 'engineering',
      assigneeMemberId: 'mathis',
      assignedBy: 'cambium',
      source: 'cambium',
      eventId: 'cambium:fitcheck-product:task-fitcheck-brief:assigned',
      correlationId: 'cambium:fitcheck-product:task-fitcheck-brief:assigned',
    },
  },
};
const parsedAssignment = taskFromThoughtseedDirective(cambiumAssignmentDirective, 'mathis', 'cambium', '2026-06-22T08:00:00.000Z');
assert.ok(parsedAssignment);
assert.equal(parsedAssignment.task.taskId, 'task-fitcheck-brief');
assert.equal(parsedAssignment.task.projectId, 'fitcheck-product');
assert.equal(parsedAssignment.task.projectName, 'FitCheck Product');
assert.equal(parsedAssignment.task.questId, 'quest-77');
assert.equal(parsedAssignment.task.clientName, 'FitCheck');
assert.equal(parsedAssignment.task.priority, 'high');
assert.equal(parsedAssignment.task.taskType, 'engineering');
assert.equal(parsedAssignment.task.assigneeMemberId, 'mathis');
assert.equal(parsedAssignment.task.source, 'cambium');
assert.equal(parsedAssignment.task.status, 'assigned');
assert.equal(parsedAssignment.event.eventId, 'cambium:fitcheck-product:task-fitcheck-brief:assigned');
assert.equal(parsedAssignment.event.source, 'cambium');
assert.equal(parsedAssignment.event.actor, 'cambium');
assert.equal(parsedAssignment.event.correlationId, 'cambium:fitcheck-product:task-fitcheck-brief:assigned');
assert.equal(parsedAssignment.event.payloadHash, hashBridgePayload(parsedAssignment.event.payload));

const overrideDirective = {
  id: 'hermes-override-1',
  memberId: 'mathis',
  direction: 'downstream',
  issuedAt: '2026-06-22T08:10:00.000Z',
  payload: {
    type: 'fabric_task_history_event',
    kind: 'fabric_task_history_event',
    schema: 'thoughtseed.fabric_task_history_event.v1',
    source: 'hermes',
    event: {
      eventId: 'hermes-override-1',
      timestamp: '2026-06-22T08:10:00.000Z',
      actor: 'hermes-admin',
      source: 'hermes',
      type: 'workMode_override',
      correlationId: 'cambium:fitcheck-product:task-fitcheck-brief:assigned',
      payload: {
        taskId: 'task-fitcheck-brief',
        projectId: 'fitcheck-product',
        status: 'in_progress',
        previousWorkMode: 'manual',
        workMode: 'delegated',
        reason: 'original mode was wrong',
      },
    },
  },
};
const parsedOverride = historyEventFromThoughtseedDirective(overrideDirective, '2026-06-22T08:10:00.000Z');
assert.ok(parsedOverride);
assert.equal(parsedOverride.taskId, 'task-fitcheck-brief');
assert.equal(parsedOverride.event.type, 'workMode_override');
assert.equal(parsedOverride.event.source, 'hermes');
assert.equal(parsedOverride.event.payload.workMode, 'delegated');

const rejectedDirective = {
  id: 'cambium-review-1',
  memberId: 'mathis',
  direction: 'downstream',
  issuedAt: '2026-06-22T08:20:00.000Z',
  payload: {
    type: 'fabric_task_history_event',
    kind: 'fabric_task_history_event',
    schema: 'thoughtseed.fabric_task_history_event.v1',
    source: 'cambium',
    event: {
      eventId: 'cambium-review-1',
      timestamp: '2026-06-22T08:20:00.000Z',
      actor: 'founder',
      source: 'cambium',
      type: 'candidate_rejected',
      payload: {
        taskId: 'task-fitcheck-brief',
        projectId: 'fitcheck-product',
        evidenceCandidateId: 'cand-1',
        evidence: { type: 'github_branch', value: 'other-branch' },
        status: 'rejected_candidate',
        reason: 'branch belongs to another proof packet',
      },
    },
  },
};
const parsedRejected = historyEventFromThoughtseedDirective(rejectedDirective, '2026-06-22T08:20:00.000Z');
assert.ok(parsedRejected);
assert.equal(parsedRejected.taskId, 'task-fitcheck-brief');
assert.equal(parsedRejected.event.type, 'candidate_rejected');
assert.equal(parsedRejected.event.payload.status, 'rejected_candidate');

console.log('thoughtseed bridge smoke passed: signing, expiry, Cambium assignment, override, and rejected candidate parsing are deterministic');
