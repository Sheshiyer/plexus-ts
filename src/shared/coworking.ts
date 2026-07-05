import type { FloorPresence, RealtimeMediaTrack, RealtimeRoom } from './types.js';

export type CoWorkingZoneKind = 'lounge' | 'project';
export type CoWorkingJoinState = 'not_joined' | 'presence_only' | 'media';
export type CoWorkingRecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'finalized' | 'failed';

export interface CoWorkingFocusedZone {
  kind: CoWorkingZoneKind;
  room: RealtimeRoom | null;
  projectId: string | null;
  projectName: string;
  joinState: CoWorkingJoinState;
  members: FloorPresence[];
  screenTracks: RealtimeMediaTrack[];
  pinnedTrackId: string | null;
  recordingState: CoWorkingRecordingState;
}

export interface CoWorkingRecordingManifest {
  id: string;
  workspaceId: string;
  projectId: string;
  roomId: string;
  callSessionId: string;
  startedAt: string;
  endedAt: string | null;
  r2Prefix: string;
  rawTracks: CoWorkingRecordingTrackRef[];
  composedPlaybackRef: string | null;
  consent: CoWorkingRecordingConsent[];
}

export interface CoWorkingRecordingTrackRef {
  trackId: string;
  participantId: string;
  kind: 'audio' | 'camera' | 'screen';
  objectKey: string;
  startedAt: string;
  endedAt: string | null;
}

export interface CoWorkingRecordingConsent {
  participantId: string;
  displayName: string;
  consentedAt: string;
  revokedAt: string | null;
}
