import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveFocusedZone,
  deriveRecordingConsentShell,
} from '../../src/renderer/lib/coworkingModel';
import type { RealtimeRoom } from '../../src/shared/types';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function room(roomType: RealtimeRoom['roomType']): RealtimeRoom {
  return {
    id: roomType === 'project_room' ? 'room_project_ambient_floor' : 'room_lounge',
    workspaceId: 'workspace_1',
    projectId: roomType === 'project_room' ? 'project_ambient_floor' : null,
    projectName: roomType === 'project_room' ? 'Ambient floor' : null,
    name: roomType === 'project_room' ? 'Ambient floor room' : 'Lounge',
    slug: roomType === 'project_room' ? 'ambient-floor' : 'lounge',
    roomType,
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_1',
    activeCall: null,
    presence: { participants: 1, screenShares: 0 },
    metadata: {},
    lastActivityAt: '2026-07-10T10:00:00.000Z',
    createdAt: '2026-07-10T09:00:00.000Z',
    updatedAt: '2026-07-10T10:00:00.000Z',
  };
}

describe('coworking recording consent shell', () => {
  it('derives a disabled project-scoped consent shell for focused project zones only', () => {
    const focusedZone = deriveFocusedZone({
      selectedRoom: room('project_room'),
      activeRoomId: 'room_project_ambient_floor',
    });

    expect(deriveRecordingConsentShell({ focusedZone, activeProjectJoin: true })).toMatchObject({
      visible: true,
      scope: 'focused_project_zone',
      loungeDefault: false,
      projectScoped: true,
      requiresConsent: true,
      startEnabled: false,
      title: 'Recording consent',
      disabledReason: 'Start disabled until every visible participant consents and recording routes are ready.',
      chips: [
        'focused project zone only',
        'project scoped',
        'consent required',
        'lounge is not recorded',
        'no hidden capture',
      ],
    });
  });

  it('does not expose recording as a lounge default', () => {
    const loungeZone = deriveFocusedZone({ selectedRoom: room('workspace_lobby') });

    expect(deriveRecordingConsentShell({ focusedZone: loungeZone, activeProjectJoin: true })).toMatchObject({
      visible: false,
      loungeDefault: false,
      startEnabled: false,
    });
  });

  it('wires copy into the focused stage and keeps lounge privacy copy non-recording', () => {
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');
    const lounge = source('src/renderer/components/coworking/CoWorkingLoungeSection.tsx');
    const model = source('src/renderer/lib/coworkingModel.ts');

    expect(stage).toContain('Recording consent shell');
    expect(stage).toContain('Focused project zone only');
    expect(stage).toContain('Recording requires project consent');
    expect(model).toContain('lounge is not recorded');
    expect(model).toContain('Start disabled until every visible participant consents and recording routes are ready.');
    expect(lounge).toContain('NO REC');
    expect(lounge).toContain('NO TRANSCRIPT');
  });
});
