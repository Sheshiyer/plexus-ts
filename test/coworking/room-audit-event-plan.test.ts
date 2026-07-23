import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveCoWorkingRoomAuditEventPlan,
  deriveFocusedZone,
} from '../../src/renderer/lib/coworkingModel';
import type { RealtimeRoom } from '../../src/shared/types';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function projectRoom(): RealtimeRoom {
  return {
    id: 'room_project_stage',
    workspaceId: 'workspace_1',
    projectId: 'project_stage',
    projectName: 'Stage foundation',
    name: 'Stage foundation room',
    slug: 'stage-foundation',
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_project_stage',
    activeCall: null,
    presence: { participants: 2, screenShares: 1 },
    metadata: {},
    lastActivityAt: '2026-07-10T10:00:00.000Z',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
  };
}

describe('coworking room audit event plan', () => {
  it('describes expected append-only room audit rows without claiming Worker proof', () => {
    const focusedZone = deriveFocusedZone({
      selectedRoom: projectRoom(),
      activeRoomId: 'room_project_stage',
    });
    const plan = deriveCoWorkingRoomAuditEventPlan({
      focusedZone,
      activeProjectJoin: true,
      transportState: 'unavailable',
      recordingConsentRequired: true,
    });

    expect(plan.visible).toBe(true);
    expect(plan.appendOnly).toBe(true);
    expect(plan.destination).toBe('worker_realtime_audit_events');
    expect(plan.roomId).toBe('room_project_stage');
    expect(plan.copy).toBe('Room actions should leave append-only audit rows without creating hidden artifacts.');
    expect(plan.events.map((event) => event.kind)).toEqual([
      'presence_leave',
      'media_state',
      'recording_consent',
      'recording_blocked',
      'closeout_saved',
      'paperclip_handoff_requested',
    ]);
    expect(plan.events.find((event) => event.kind === 'paperclip_handoff_requested')).toMatchObject({
      required: false,
    });
    expect(plan.hiddenSideEffectsForbidden).toEqual([
      'hidden transcription',
      'hidden recording',
      'hidden Paperclip write',
      'hidden time-entry creation',
    ]);
  });

  it('tracks join rather than leave when the focused room is not joined', () => {
    const focusedZone = deriveFocusedZone({ selectedRoom: projectRoom() });

    expect(deriveCoWorkingRoomAuditEventPlan({ focusedZone }).events[0]).toMatchObject({
      kind: 'presence_join',
      label: 'Drop in writes participant-joined audit',
      required: true,
    });
  });

  it('keeps the audit plan near room actions and closeout wiring', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(panel).toContain('dropInToRoom');
    expect(panel).toContain('leaveProjectRoom');
    expect(panel).toContain('saveCloseout');
    expect(panel).toContain('deriveCoWorkingRoomAuditEventPlan');
    expect(stage).toContain('Room audit');
    expect(stage).toContain('append-only');
  });
});
