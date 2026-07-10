import type { CoWorkingRingState, FloorPresence, RealtimeMediaTrack, RealtimeRoom } from './types.js';

export type CoWorkingZoneKind = 'lounge' | 'project';
export type CoWorkingJoinState = 'not_joined' | 'presence_only' | 'media';
export type CoWorkingRecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'finalized' | 'failed';
export type CoWorkingStageSelectionIntent = 'focus_only' | 'joined';
export type CoWorkingStageMode = 'meet_like_focus';

export interface CoWorkingStageParticipant {
  participantId: string;
  displayName: string;
  initials: string;
  roomId: string | null;
  roomName: string | null;
  projectTag: string | null;
  ringState: CoWorkingRingState;
  isSpeaking: boolean;
  stageRole: 'speaker' | 'participant';
}

export interface CoWorkingFocusedZoneSummary {
  memberCount: number;
  speakingCount: number;
  screenShareCount: number;
}

export interface CoWorkingFocusedZone {
  kind: CoWorkingZoneKind;
  room: RealtimeRoom | null;
  projectId: string | null;
  projectName: string;
  joinState: CoWorkingJoinState;
  selectionIntent: CoWorkingStageSelectionIntent;
  stageMode: CoWorkingStageMode;
  members: FloorPresence[];
  participants: CoWorkingStageParticipant[];
  screenTracks: RealtimeMediaTrack[];
  pinnedTrackId: string | null;
  recordingState: CoWorkingRecordingState;
  presenceSummary: CoWorkingFocusedZoneSummary;
}

export interface CoWorkingPresenceMapZone {
  key: CoWorkingRingState;
  label: string;
  participants: CoWorkingStageParticipant[];
  activeRoomIds: string[];
}

export interface CoWorkingPresenceMap {
  zones: CoWorkingPresenceMapZone[];
  totalPresent: number;
  activeRoomIds: string[];
  focusOnly: true;
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
