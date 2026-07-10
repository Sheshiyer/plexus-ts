import type { CoWorkingRingState, FloorPresence, RealtimeMediaTrack, RealtimeRoom } from './types.js';

export type CoWorkingZoneKind = 'lounge' | 'project';
export type CoWorkingJoinState = 'not_joined' | 'presence_only' | 'media';
export type CoWorkingRecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'finalized' | 'failed';
export type CoWorkingStageSelectionIntent = 'focus_only' | 'joined';
export type CoWorkingStageMode = 'meet_like_focus';
export type CoWorkingMediaTransportState = 'deferred' | 'ready' | 'degraded' | 'simulated' | 'unavailable';
export type CoWorkingDegradedStateKind = 'floor' | 'rooms' | 'room_detail' | 'devices' | 'lounge' | 'transport';
export type CoWorkingDegradedStateLevel = 'ok' | 'deferred' | 'blocked';
export type CoWorkingSfuAcceptanceStatus = 'pending_live_proof' | 'verified' | 'degraded_fallback';

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

export interface CoWorkingProjectMediaHonesty {
  controlsVisible: true;
  activeProjectJoin: boolean;
  transportState: CoWorkingMediaTransportState;
  gated: boolean;
  audioEnabled: boolean;
  cameraEnabled: boolean;
  screenEnabled: boolean;
  primaryCopy: string;
  gateCopy: string;
  proofCopy: string;
  signals: string[];
}

export interface CoWorkingRecordingConsentShell {
  visible: boolean;
  scope: 'focused_project_zone';
  loungeDefault: false;
  projectScoped: true;
  requiresConsent: true;
  canRequestConsent: boolean;
  startEnabled: false;
  participantCount: number;
  captureKinds: Array<'audio' | 'camera' | 'screen'>;
  title: string;
  body: string;
  disabledReason: string;
  chips: string[];
}

export interface CoWorkingDegradedStateSignal {
  kind: CoWorkingDegradedStateKind;
  label: string;
  level: CoWorkingDegradedStateLevel;
  message: string;
}

export interface CoWorkingIndependentDegradedStates {
  title: 'Independent degraded states';
  signals: CoWorkingDegradedStateSignal[];
  activeIssueCount: number;
}

export interface CoWorkingSfuLiveTransportAcceptance {
  liveProofRequired: true;
  liveProofVerified: boolean;
  localFallbackAccepted: true;
  status: CoWorkingSfuAcceptanceStatus;
  proofBoundary: string;
  fallbackBoundary: string;
  acceptanceCopy: string;
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
