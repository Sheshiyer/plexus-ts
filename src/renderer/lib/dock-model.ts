export interface DockJoinInput {
  scope: 'lounge' | 'project_room';
  roomId: string;
  roomName: string;
  hasSession: boolean;
  cloudflareConfigured: boolean;
  participantCount: number;
  joinedAt: string;
}

export interface DockState {
  visible: boolean;
  contextLabel: string;
  scope: 'lounge' | 'project_room' | null;
  transportReady: boolean;
  micDisabled: boolean;
  cameraDisabled: boolean;
  screenDisabled: boolean;
  participantCount: number;
  joinedAt: string | null;
}

const HIDDEN: DockState = {
  visible: false, contextLabel: '', scope: null, transportReady: false,
  micDisabled: true, cameraDisabled: true, screenDisabled: true,
  participantCount: 0, joinedAt: null,
};

/**
 * One media-capable join exists at a time (lounge XOR one project room —
 * enforced by leaveOtherActiveJoins). The dock renders for whichever join
 * owns the shared RealtimeSession.
 */
export function deriveDockState(input: {
  joins: DockJoinInput[];
  busy: string | null;
  wiringEnabled: boolean;
}): DockState {
  const active = input.joins.find((join) => join.hasSession) ?? null;
  if (!active) return HIDDEN;
  return {
    visible: true,
    contextLabel: active.roomName,
    scope: active.scope,
    transportReady: input.wiringEnabled && active.cloudflareConfigured,
    micDisabled: input.busy === 'mic',
    cameraDisabled: input.busy === 'camera',
    screenDisabled: input.busy === 'screen',
    participantCount: active.participantCount,
    joinedAt: active.joinedAt,
  };
}
