import type {
  CoWorkingRingState,
  FloorPresence,
  MediaCaptureKind,
  MediaCaptureStatus,
  MediaPermissionState,
  RealtimeMediaTrack,
  RealtimeRoom,
} from './types.js';

export type CoWorkingZoneKind = 'lounge' | 'project';
export type CoWorkingJoinState = 'not_joined' | 'presence_only' | 'media';
export type CoWorkingRecordingState = 'idle' | 'starting' | 'recording' | 'stopping' | 'finalized' | 'failed';
export type CoWorkingStageSelectionIntent = 'focus_only' | 'joined';
export type CoWorkingStageMode = 'meet_like_focus';
export type CoWorkingMediaTransportState = 'deferred' | 'ready' | 'degraded' | 'simulated' | 'unavailable';
export type CoWorkingDegradedStateKind = 'floor' | 'rooms' | 'room_detail' | 'devices' | 'lounge' | 'transport';
export type CoWorkingDegradedStateLevel = 'ok' | 'deferred' | 'blocked';
export type CoWorkingSfuAcceptanceStatus = 'pending_live_proof' | 'verified' | 'degraded_fallback';
export type CoWorkingAuditEventKind =
  | 'presence_join'
  | 'presence_leave'
  | 'media_state'
  | 'recording_consent'
  | 'recording_blocked'
  | 'closeout_saved'
  | 'paperclip_handoff_requested';
export type CoWorkingMeetingMemoryMode = 'manual_closeout';
export type CoWorkingTranscriptionState = 'deferred';
export type CoWorkingCloseoutRoute = 'realtime:closeout';
export type CoWorkingPermissionAuditLevel = 'ok' | 'recoverable' | 'blocked';
export type CoWorkingRemoteTrackSubscriptionState = 'mapped' | 'missing_provider_track' | 'subscribed';
export type CoWorkingMediaProviderHealthState = 'deferred' | 'connected' | 'degraded' | 'simulated' | 'unavailable';
export type CoWorkingPermissionRecoveryAction =
  | 'refresh_status'
  | 'request_microphone'
  | 'request_camera'
  | 'open_system_settings'
  | 'continue_without_media';

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
  mediaTracks: RealtimeMediaTrack[];
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

export interface CoWorkingProofCloseoutLink {
  visible: boolean;
  enabled: boolean;
  route: CoWorkingCloseoutRoute;
  targetRoomId: string | null;
  targetLabel: string;
  title: string;
  body: string;
  disabledReason: string;
  checklist: string[];
  chips: string[];
}

export interface CoWorkingRoomAuditEventPlanItem {
  kind: CoWorkingAuditEventKind;
  label: string;
  required: boolean;
}

export interface CoWorkingRoomAuditEventPlan {
  visible: true;
  appendOnly: true;
  destination: 'worker_realtime_audit_events';
  roomId: string | null;
  events: CoWorkingRoomAuditEventPlanItem[];
  hiddenSideEffectsForbidden: string[];
  copy: string;
  chips: string[];
}

export interface CoWorkingPermissionAuditSignal {
  kind: MediaCaptureKind;
  label: string;
  state: MediaPermissionState;
  level: CoWorkingPermissionAuditLevel;
  recoverable: boolean;
  systemSettingsOnly: boolean;
  message: string;
  recoveryActions: CoWorkingPermissionRecoveryAction[];
}

export interface CoWorkingPrivacyPermissionAudit {
  visible: true;
  checkedAt: string | null;
  sourceStatus: MediaCaptureStatus | null;
  deviceError: string | null;
  signals: CoWorkingPermissionAuditSignal[];
  blockedCount: number;
  recoverableCount: number;
  leaveAvailable: true;
  closeoutAvailable: boolean;
  copy: string;
  chips: string[];
}

export interface CoWorkingMeetingMemoryPolicy {
  visible: true;
  mode: CoWorkingMeetingMemoryMode;
  transcriptState: CoWorkingTranscriptionState;
  transcriptRef: null;
  recordingRef: null;
  paperclipOptional: true;
  participantCount: number;
  screenShareCount: number;
  manualFields: Array<'manualNotes' | 'decisions' | 'actionItems'>;
  title: string;
  body: string;
  chips: string[];
}

export interface CoWorkingTranscriptionBoundary {
  visible: true;
  state: CoWorkingTranscriptionState;
  autoTranscription: false;
  transcriptRef: null;
  recordingRef: null;
  body: string;
  chips: string[];
}

export interface CoWorkingTwoParticipantSimulation {
  localOnly: true;
  minimumParticipants: 2;
  participantCount: number;
  minimumMet: boolean;
  participantNames: string[];
  screenShareCount: number;
  copy: string;
  chips: string[];
}

export interface CoWorkingRemoteTrackSubscriptionItem {
  trackId: string;
  participantId: string;
  participantLabel: string;
  trackKind: RealtimeMediaTrack['trackKind'];
  label: string;
  cloudflareTrackId: string | null;
  state: CoWorkingRemoteTrackSubscriptionState;
  mapsToScreenWall: boolean;
}

export interface CoWorkingRemoteTrackSubscriptionPlan {
  visible: true;
  roomId: string | null;
  localParticipantId: string | null;
  providerConfigured: boolean;
  items: CoWorkingRemoteTrackSubscriptionItem[];
  subscribeTargetTrackIds: string[];
  missingProviderTrackIds: string[];
  screenWallTrackIds: string[];
  canSubscribe: boolean;
  copy: string;
  proofBoundary: string;
  chips: string[];
}

export interface CoWorkingMediaProviderHealth {
  visible: true;
  state: CoWorkingMediaProviderHealthState;
  transportState: CoWorkingMediaTransportState;
  providerConfigured: boolean;
  negotiation: string;
  connectionState: string;
  remoteTrackCount: number;
  subscribedRemoteStreamCount: number;
  subscribedScreenStreamCount: number;
  missingRemoteStreamCount: number;
  liveProofVerified: boolean;
  copy: string;
  proofBoundary: string;
  chips: string[];
}

export interface CoWorkingLiveScreenWallProof {
  visible: true;
  liveTrackCount: number;
  pinnedTrackId: string | null;
  fullscreen: boolean;
  allTilesLive: boolean;
  pinnedTrackVisible: boolean;
  copy: string;
  chips: string[];
}

export interface CoWorkingRoomCloseoutProofFixture {
  visible: true;
  roomId: string | null;
  callSessionId: string | null;
  projectId: string | null;
  manualNotesRequired: true;
  reportEvidenceStatus: 'draft_ready' | 'blocked_until_closeout';
  transcriptRef: null;
  recordingRef: null;
  paperclipStatus: 'not_requested' | 'explicit_optional';
  proofChain: string[];
  copy: string;
  chips: string[];
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
