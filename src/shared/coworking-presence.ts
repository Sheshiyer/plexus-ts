import type { FloorPresence } from './types.js';

export type CoworkingActivityState = 'available' | 'focused';
export type CoworkingRoomKind = 'none' | 'lounge' | 'project';
export type CoworkingPresenceProof = 'authenticated_app_lease';

export interface CoworkingPresenceActivity {
  state: CoworkingActivityState;
  timerEntryId: string | null;
  projectId: string | null;
  timerStartedAt: string | null;
}

export interface CoworkingPresenceRoom {
  kind: CoworkingRoomKind;
  roomId: string | null;
  roomName: string | null;
  projectId: string | null;
  projectName: string | null;
  callId: string | null;
  participantId: string | null;
}

export interface CoworkingPresenceMember {
  identityId: string;
  employeeId: string | null;
  displayName: string;
  activity: CoworkingPresenceActivity;
  room: CoworkingPresenceRoom;
  observedAt: string;
  lastSeenAt: string;
  expiresAt: string;
  activeClientCount: number;
  presenceProof: CoworkingPresenceProof;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 512) {
    throw new Error(`${field} must be a bounded non-empty string${nullable ? ' or null' : ''}.`);
  }
  return value;
}

function timestamp(value: unknown, field: string, nullable = false): string | null {
  if (nullable && value === null) return null;
  const parsed = string(value, field);
  if (!parsed || !Number.isFinite(Date.parse(parsed))) {
    throw new Error(`${field} must be a valid timestamp.`);
  }
  return new Date(parsed).toISOString();
}

function activity(value: unknown): CoworkingPresenceActivity {
  const raw = record(value, 'activity');
  if (raw.state !== 'available' && raw.state !== 'focused') {
    throw new Error('activity.state must be available or focused.');
  }
  if (raw.state === 'available') {
    return {
      state: 'available',
      timerEntryId: null,
      projectId: null,
      timerStartedAt: null,
    };
  }
  const timerEntryId = string(raw.timerEntryId, 'activity.timerEntryId');
  const projectId = string(raw.projectId, 'activity.projectId');
  const timerStartedAt = timestamp(raw.timerStartedAt, 'activity.timerStartedAt');
  return {
    state: 'focused',
    timerEntryId: timerEntryId!,
    projectId: projectId!,
    timerStartedAt: timerStartedAt!,
  };
}

function room(value: unknown): CoworkingPresenceRoom {
  if (value === null || value === undefined) {
    return {
      kind: 'none',
      roomId: null,
      roomName: null,
      projectId: null,
      projectName: null,
      callId: null,
      participantId: null,
    };
  }
  const raw = record(value, 'room');
  if (raw.kind !== 'none' && raw.kind !== 'lounge' && raw.kind !== 'project') {
    throw new Error('room.kind must be none, lounge, or project.');
  }
  if (raw.kind === 'none') {
    return {
      kind: 'none',
      roomId: null,
      roomName: null,
      projectId: null,
      projectName: null,
      callId: null,
      participantId: null,
    };
  }
  return {
    kind: raw.kind,
    roomId: string(raw.roomId, 'room.roomId')!,
    roomName: string(raw.roomName, 'room.roomName')!,
    projectId: string(raw.projectId, 'room.projectId', true),
    projectName: string(raw.projectName, 'room.projectName', true),
    callId: string(raw.callId, 'room.callId')!,
    participantId: string(raw.participantId, 'room.participantId')!,
  };
}

function normalizeMember(value: unknown): CoworkingPresenceMember {
  const raw = record(value, 'presence member');
  if (raw.presenceProof !== 'authenticated_app_lease') {
    throw new Error('presenceProof must be authenticated_app_lease.');
  }
  if (!Number.isInteger(raw.activeClientCount) || (raw.activeClientCount as number) < 1) {
    throw new Error('activeClientCount must be a positive integer.');
  }
  return {
    identityId: string(raw.identityId, 'identityId')!,
    employeeId: string(raw.employeeId, 'employeeId', true),
    displayName: string(raw.displayName, 'displayName')!,
    activity: activity(raw.activity),
    room: room(raw.room),
    observedAt: timestamp(raw.observedAt, 'observedAt')!,
    lastSeenAt: timestamp(raw.lastSeenAt, 'lastSeenAt')!,
    expiresAt: timestamp(raw.expiresAt, 'expiresAt')!,
    activeClientCount: raw.activeClientCount as number,
    presenceProof: 'authenticated_app_lease',
  };
}

export function normalizeCoworkingPresenceMembers(value: unknown): CoworkingPresenceMember[] {
  const raw = record(value, 'presence response');
  if (!Array.isArray(raw.members)) throw new Error('presence response members must be an array.');
  return raw.members.map(normalizeMember);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function floorPresenceFromLease(member: CoworkingPresenceMember): FloorPresence {
  const ringState = member.activity.state === 'focused'
    ? 'timing'
    : member.room.kind === 'lounge'
      ? 'lounge'
      : 'online';
  const projectTag = member.room.kind === 'project'
    ? (member.room.projectName ?? member.room.projectId)?.toUpperCase() ?? null
    : null;
  return {
    identityId: member.identityId,
    employeeId: member.employeeId,
    participantId: member.room.participantId,
    displayName: member.displayName,
    initials: initials(member.displayName),
    ringState,
    roomId: member.room.roomId,
    roomName: member.room.roomName,
    projectTag,
    isSpeaking: false,
    observedAt: member.observedAt,
    lastSeenAt: member.lastSeenAt,
    expiresAt: member.expiresAt,
    activeClientCount: member.activeClientCount,
    presenceProof: member.presenceProof,
  };
}
