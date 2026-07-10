import { describe, expect, it } from 'vitest';
import { taskFromThoughtseedDirective } from '../../src/shared/thoughtseed-fabric-task';
import type { ThoughtseedBridgeDirective } from '../../src/shared/types';

function assignmentDirective(task: Record<string, unknown>): ThoughtseedBridgeDirective {
  return {
    id: 'directive_parser_1',
    memberId: 'member_1',
    tenantId: 'cambium',
    issuedAt: '2026-07-01T08:30:00.000Z',
    payload: {
      type: 'fabric_task_assignment',
      task,
    },
  };
}

describe('Fabric task directive parser', () => {
  it('preserves project and work-entry links when a directive provides them', () => {
    const parsed = taskFromThoughtseedDirective(
      assignmentDirective({
        taskId: 'fabric_task_parser_1',
        title: 'Ship task records',
        projectId: 'project_verified',
        projectName: 'Verified Project',
        workEntryId: 'entry_1',
      }),
      'member_1',
      'cambium',
    );

    expect(parsed?.task).toMatchObject({
      taskId: 'fabric_task_parser_1',
      projectId: 'project_verified',
      projectName: 'Verified Project',
      workEntryId: 'entry_1',
    });
    expect(parsed?.event.payload).toMatchObject({
      projectId: 'project_verified',
      workEntryId: 'entry_1',
    });
  });

  it('accepts workRecordId and timeEntryId aliases without making task actionability depend on them', () => {
    const fromWorkRecord = taskFromThoughtseedDirective(
      assignmentDirective({
        taskId: 'fabric_task_parser_2',
        title: 'Link from work record',
        workRecordId: 'entry_from_record',
      }),
      'member_1',
      'cambium',
    );
    const fromTimeEntry = taskFromThoughtseedDirective(
      assignmentDirective({
        taskId: 'fabric_task_parser_3',
        title: 'Link from time entry',
        timeEntryId: 'entry_from_time',
      }),
      'member_1',
      'cambium',
    );
    const withoutLink = taskFromThoughtseedDirective(
      assignmentDirective({
        taskId: 'fabric_task_parser_4',
        title: 'Still actionable',
      }),
      'member_1',
      'cambium',
    );

    expect(fromWorkRecord?.task.workEntryId).toBe('entry_from_record');
    expect(fromTimeEntry?.task.workEntryId).toBe('entry_from_time');
    expect(withoutLink?.task.workEntryId).toBeUndefined();
    expect(withoutLink?.task.title).toBe('Still actionable');
  });

  it('sanitizes skill hints from root, task, and branch metadata without retaining secrets', () => {
    const fromTask = taskFromThoughtseedDirective(
      {
        ...assignmentDirective({
          taskId: 'fabric_task_parser_hints',
          title: 'Dispatch with hints',
          skillHints: [
            ' dispatching-parallel-agents ',
            { name: 'executing-plans', token: 'secret-value-that-must-not-leak' },
            { name: '../../bad-path' },
          ],
        }),
        payload: {
          type: 'fabric_task_assignment',
          skillHints: ['engineering:testing-strategy'],
          branchMission: {
            skillHints: ['custom-safe-skill', 'https://bad.example/skill'],
          },
          task: {
            taskId: 'fabric_task_parser_hints',
            title: 'Dispatch with hints',
            skillHints: [
              ' dispatching-parallel-agents ',
              { name: 'executing-plans', token: 'secret-value-that-must-not-leak' },
              { name: '../../bad-path' },
            ],
          },
        },
      },
      'member_1',
      'cambium',
    );
    const fromRoot = taskFromThoughtseedDirective(
      {
        ...assignmentDirective({
          taskId: 'fabric_task_parser_root_hints',
          title: 'Dispatch with root hints',
        }),
        payload: {
          type: 'fabric_task_assignment',
          skillHints: ['engineering:testing-strategy', 'https://bad.example/skill'],
          task: {
            taskId: 'fabric_task_parser_root_hints',
            title: 'Dispatch with root hints',
          },
        },
      },
      'member_1',
      'cambium',
    );
    const fromBranch = taskFromThoughtseedDirective(
      {
        ...assignmentDirective({
          taskId: 'fabric_task_parser_branch_hints',
          title: 'Dispatch with branch hints',
        }),
        payload: {
          type: 'fabric_task_assignment',
          branchMission: {
            skillHints: ['custom-safe-skill', { name: '../../bad-path' }],
          },
          task: {
            taskId: 'fabric_task_parser_branch_hints',
            title: 'Dispatch with branch hints',
          },
        },
      },
      'member_1',
      'cambium',
    );

    expect(fromTask?.task.skillHints).toEqual(['dispatching-parallel-agents', 'executing-plans']);
    expect(fromTask?.event.payload.skillHints).toEqual(['dispatching-parallel-agents', 'executing-plans']);
    expect(fromRoot?.task.skillHints).toEqual(['engineering:testing-strategy']);
    expect(fromBranch?.task.skillHints).toEqual(['custom-safe-skill']);
    expect(JSON.stringify({ fromTask, fromRoot, fromBranch })).not.toContain('secret-value');
  });
});
