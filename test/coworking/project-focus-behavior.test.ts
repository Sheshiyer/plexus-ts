import { describe, expect, it, vi } from 'vitest';
import { deriveFocusedZone } from '../../src/renderer/lib/coworkingModel';
import type { RealtimeRoom } from '../../src/shared/types';

function projectRoom(overrides: Partial<RealtimeRoom> = {}): RealtimeRoom {
  const id = overrides.id ?? 'room_project_ambient_floor';
  const projectId = overrides.projectId ?? 'project_ambient_floor';
  const projectName = overrides.projectName ?? 'Ambient floor';

  return {
    id,
    workspaceId: 'workspace_1',
    projectId,
    projectName,
    name: overrides.name ?? `${projectName} room`,
    slug: overrides.slug ?? id.replaceAll('_', '-'),
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: null,
    activeCall: null,
    presence: {
      participants: 0,
      screenShares: 0,
    },
    metadata: {},
    lastActivityAt: '2026-07-05T10:00:00.000Z',
    createdAt: '2026-07-05T09:00:00.000Z',
    updatedAt: '2026-07-05T10:00:00.000Z',
    ...overrides,
  };
}

describe('coworking project focus behavior', () => {
  it('changes the focused zone room when the selected project changes', () => {
    const ambientFloor = projectRoom();
    const bridgeRoom = projectRoom({
      id: 'room_project_bridge',
      projectId: 'project_bridge',
      projectName: 'Bridge',
      name: 'Bridge room',
      slug: 'bridge',
    });

    const firstFocus = deriveFocusedZone({ selectedRoom: ambientFloor });
    const nextFocus = deriveFocusedZone({ selectedRoom: bridgeRoom });

    expect(firstFocus.room).toBe(ambientFloor);
    expect(firstFocus.projectId).toBe('project_ambient_floor');
    expect(firstFocus.selectionIntent).toBe('focus_only');
    expect(nextFocus.room).toBe(bridgeRoom);
    expect(nextFocus.projectId).toBe('project_bridge');
    expect(nextFocus.selectionIntent).toBe('focus_only');
    expect(nextFocus.room?.id).not.toBe(firstFocus.room?.id);
  });

  it('does not call join when the selected project changes', () => {
    const join = vi.fn();
    const selectedRooms = [
      projectRoom(),
      projectRoom({
        id: 'room_project_bridge',
        projectId: 'project_bridge',
        projectName: 'Bridge',
        name: 'Bridge room',
        slug: 'bridge',
      }),
    ];

    const focusProject = (selectedRoom: RealtimeRoom) => deriveFocusedZone({ selectedRoom });

    const zones = selectedRooms.map(focusProject);

    expect(zones.map((zone) => zone.room?.id)).toEqual([
      'room_project_ambient_floor',
      'room_project_bridge',
    ]);
    expect(join).not.toHaveBeenCalled();
  });

  it('keeps joinState not_joined until there is an active local join', () => {
    const selectedRoomWithLiveCall = projectRoom({
      activeCallId: 'call_project_bridge',
      presence: {
        participants: 3,
        screenShares: 1,
      },
    });

    expect(deriveFocusedZone({ selectedRoom: selectedRoomWithLiveCall })).toMatchObject({
      room: selectedRoomWithLiveCall,
      joinState: 'not_joined',
      selectionIntent: 'focus_only',
    });
    expect(
      deriveFocusedZone({
        selectedRoom: selectedRoomWithLiveCall,
        activeRoomId: 'room_project_somewhere_else',
      }).joinState,
    ).toBe('not_joined');
  });
});
