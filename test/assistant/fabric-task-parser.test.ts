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
});
