import type {
  CoWorkingDegradedStateLevel,
  CoWorkingDegradedStateSignal,
  CoWorkingFocusedZone,
  CoWorkingIndependentDegradedStates,
  CoWorkingMediaTransportState,
  CoWorkingMediaProviderHealth,
  CoWorkingMeetingMemoryPolicy,
  CoWorkingPresenceMap,
  CoWorkingPrivacyPermissionAudit,
  CoWorkingProofCloseoutLink,
  CoWorkingProjectMediaHonesty,
  CoWorkingRemoteTrackSubscriptionPlan,
  CoWorkingRecordingConsentShell,
  CoWorkingRoomAuditEventPlan,
  CoWorkingRecordingState,
  CoWorkingSfuLiveTransportAcceptance,
  CoWorkingLiveScreenWallProof,
  CoWorkingStageParticipant,
  CoWorkingTranscriptionBoundary,
  CoWorkingTwoParticipantSimulation,
  CoWorkingRoomCloseoutProofFixture,
} from '../../shared/coworking';
import type {
  FloorPresence,
  RealtimeJoinInput,
  RealtimeJoinResponse,
  MediaCaptureKind,
  MediaCaptureStatus,
  MediaPermissionState,
  RealtimeMediaTrack,
  RealtimeParticipant,
  RealtimeRoom,
} from '../../shared/types';

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export interface CoWorkingProjectRoomOption {
  roomId: string;
  projectId: string | null;
  label: string;
  activeMemberCount: number;
  screenShareCount: number;
  room: RealtimeRoom;
}

export interface DeriveFocusedZoneInput {
  selectedRoom?: RealtimeRoom | null;
  activeRoomId?: string | null;
  floor?: FloorPresence[];
  participants?: RealtimeParticipant[];
  tracks?: RealtimeMediaTrack[];
  pinnedTrackId?: string | null;
  recordingState?: CoWorkingRecordingState;
}

export interface CoWorkingLoungeLayer {
  room: RealtimeRoom | null;
  members: FloorPresence[];
  visible: boolean;
  miniControlVisible: boolean;
  audioPriority: 'lounge' | 'project';
}

export interface DeriveLoungeLayerInput {
  loungeRoom?: RealtimeRoom | null;
  floor?: FloorPresence[];
  projectZoneActive?: boolean;
}

export interface DeriveProjectMediaHonestyInput {
  activeProjectJoin?: boolean;
  transportReady?: boolean;
  transportState?: CoWorkingMediaTransportState;
  transportError?: string | null;
}

export interface DeriveRecordingConsentShellInput {
  focusedZone: CoWorkingFocusedZone;
  activeProjectJoin?: boolean;
  recordingRoutesReady?: boolean;
}

export interface DeriveCoWorkingDegradedStatesInput {
  floorError?: string | null;
  roomsError?: string | null;
  roomDetailError?: string | null;
  deviceError?: string | null;
  loungeError?: string | null;
  transportState?: CoWorkingMediaTransportState;
}

export interface DeriveSfuLiveTransportAcceptanceInput {
  transportState?: CoWorkingMediaTransportState;
  liveProofVerified?: boolean;
}

export interface DeriveCoWorkingProofCloseoutInput {
  focusedZone: CoWorkingFocusedZone;
  activeProjectJoin?: boolean;
  closeoutAvailable?: boolean;
}

export interface DeriveCoWorkingRoomAuditEventPlanInput {
  focusedZone: CoWorkingFocusedZone;
  activeProjectJoin?: boolean;
  transportState?: CoWorkingMediaTransportState;
  recordingConsentRequired?: boolean;
}

export interface DeriveCoWorkingMeetingMemoryPolicyInput {
  focusedZone: CoWorkingFocusedZone;
}

export interface DeriveCoWorkingTwoParticipantSimulationInput {
  focusedZone: CoWorkingFocusedZone;
}

export interface DeriveCoWorkingPrivacyPermissionAuditInput {
  status?: MediaCaptureStatus | null;
  deviceError?: string | null;
  closeoutAvailable?: boolean;
}

export interface CoWorkingObservedRemoteStream {
  participantId: string;
  trackId: string;
  trackKind: RealtimeMediaTrack['trackKind'];
}

export interface DeriveCoWorkingRemoteTrackSubscriptionPlanInput {
  focusedZone: CoWorkingFocusedZone;
  localParticipantId?: string | null;
  providerConfigured?: boolean;
  remoteStreams?: CoWorkingObservedRemoteStream[];
}

export interface DeriveCoWorkingMediaProviderHealthInput {
  activeJoin?: RealtimeJoinResponse | null;
  connectionState?: string | null;
  remoteTrackPlan: CoWorkingRemoteTrackSubscriptionPlan;
  remoteStreams?: CoWorkingObservedRemoteStream[];
}

export interface DeriveCoWorkingLiveScreenWallProofInput {
  wall: CoWorkingScreenWall;
  fullscreen?: boolean;
}

export interface DeriveCoWorkingRoomCloseoutProofFixtureInput {
  focusedZone: CoWorkingFocusedZone;
  activeJoin?: RealtimeJoinResponse | null;
}

export interface CoWorkingScreenWallTile {
  trackId: string;
  participantId: string;
  label: string;
  pinned: boolean;
  track: RealtimeMediaTrack;
}

export interface CoWorkingScreenWall {
  mode: 'wall' | 'pinned';
  pinnedTrackId: string | null;
  tiles: CoWorkingScreenWallTile[];
}

function isLivePublishedScreenTrack(track: RealtimeMediaTrack): boolean {
  return track.trackKind === 'screen' && track.direction === 'publish' && track.state === 'live';
}

function compareLabels(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function initialsForName(name: string): string {
  const initials = name
    .split(/\s+/)
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 3)
    .join('');
  return (initials || name.slice(0, 2)).toUpperCase();
}

function toStageParticipant(presence: FloorPresence): CoWorkingStageParticipant {
  return {
    participantId: presence.participantId,
    displayName: presence.displayName,
    initials: presence.initials,
    roomId: presence.roomId,
    roomName: presence.roomName,
    projectTag: presence.projectTag,
    ringState: presence.ringState,
    isSpeaking: presence.isSpeaking,
    stageRole: presence.isSpeaking ? 'speaker' : 'participant',
  };
}

function toStageParticipantFromRealtimeParticipant(
  participant: RealtimeParticipant,
  room: RealtimeRoom,
  tracks: RealtimeMediaTrack[] = [],
): CoWorkingStageParticipant {
  const isSpeaking = tracks.some((track) => (
    track.participantId === participant.id
    && track.trackKind === 'audio'
    && track.state === 'live'
  ));
  const ringState: FloorPresence['ringState'] = room.roomType === 'workspace_lobby'
    ? 'lounge'
    : room.activeCallId
      ? 'timing'
      : 'online';
  return {
    participantId: participant.id,
    displayName: participant.displayName,
    initials: initialsForName(participant.displayName || participant.id),
    roomId: room.id,
    roomName: room.name,
    projectTag: room.projectName ? room.projectName.toUpperCase() : room.name.toUpperCase(),
    ringState,
    isSpeaking,
    stageRole: isSpeaking ? 'speaker' : 'participant',
  };
}

export function derivePresenceMap(floor: FloorPresence[] = []): CoWorkingPresenceMap {
  const zoneLabels: Record<FloorPresence['ringState'], string> = {
    timing: 'In voice',
    online: 'On the floor',
    lounge: 'Ambient lounge',
    idle: 'Away',
  };
  const order: FloorPresence['ringState'][] = ['timing', 'online', 'lounge', 'idle'];
  const activeRoomIds = Array.from(new Set(
    floor
      .map((presence) => presence.roomId)
      .filter((roomId): roomId is string => Boolean(roomId)),
  )).sort(compareLabels);

  return {
    zones: order.map((key) => {
      const participants = floor
        .filter((presence) => presence.ringState === key)
        .map(toStageParticipant)
        .sort((left, right) => compareLabels(left.displayName, right.displayName));
      return {
        key,
        label: zoneLabels[key],
        participants,
        activeRoomIds: Array.from(new Set(
          participants
            .map((participant) => participant.roomId)
            .filter((roomId): roomId is string => Boolean(roomId)),
        )).sort(compareLabels),
      };
    }),
    totalPresent: floor.filter((presence) => presence.ringState !== 'idle').length,
    activeRoomIds,
    focusOnly: true,
  };
}

export function listProjectRoomOptions(
  rooms: RealtimeRoom[],
  floor: FloorPresence[] = [],
  tracks: RealtimeMediaTrack[] = [],
): CoWorkingProjectRoomOption[] {
  return rooms
    .filter((room) => room.roomType === 'project_room')
    .map((room): CoWorkingProjectRoomOption => {
      const activeMemberCount = floor.filter((presence) => presence.roomId === room.id).length;
      const screenShareCount = tracks.filter((track) => (
        track.roomId === room.id && isLivePublishedScreenTrack(track)
      )).length;
      return {
        roomId: room.id,
        projectId: room.projectId,
        label: room.projectName ?? room.name,
        activeMemberCount,
        screenShareCount,
        room,
      };
    })
    .sort((left, right) => (
      right.activeMemberCount - left.activeMemberCount
      || right.screenShareCount - left.screenShareCount
      || compareLabels(left.label, right.label)
      || compareLabels(left.roomId, right.roomId)
    ));
}

export function buildProjectRoomJoinRequest(
  room: RealtimeRoom,
  clientInstanceId: string,
): RealtimeJoinInput {
  // Product rule: joining a project room is ALWAYS presence-only. Media (mic/camera/
  // screen) is a separate, explicit post-join action, so `room.activeCallId` is
  // intentionally ignored here — the presence-only contract holds for every room.
  void room.id;
  return {
    clientInstanceId,
    intent: 'presence_only',
    media: { audio: false, video: false, screen: false },
  };
}

export function deriveFocusedZone(input: DeriveFocusedZoneInput = {}): CoWorkingFocusedZone {
  const selectedRoom = input.selectedRoom ?? null;
  const mediaTracks = selectedRoom
    ? (input.tracks ?? []).filter((track) => (
      track.roomId === selectedRoom.id
      && track.direction === 'publish'
      && track.state === 'live'
    ))
    : [];
  const screenTracks = selectedRoom
    ? mediaTracks.filter(isLivePublishedScreenTrack)
    : [];
  const pinnedTrackId = screenTracks.some((track) => track.id === input.pinnedTrackId)
    ? input.pinnedTrackId ?? null
    : null;
  const members = selectedRoom ? (input.floor ?? []).filter((presence) => presence.roomId === selectedRoom.id) : [];
  const joinState = selectedRoom && input.activeRoomId === selectedRoom.id ? 'presence_only' : 'not_joined';
  const participantMap = new Map<string, CoWorkingStageParticipant>(
    members.map((member) => [member.participantId, toStageParticipant(member)]),
  );
  if (selectedRoom) {
    for (const participant of input.participants ?? []) {
      if (participant.roomId !== selectedRoom.id || participant.state !== 'joined') continue;
      if (!participantMap.has(participant.id)) {
        participantMap.set(participant.id, toStageParticipantFromRealtimeParticipant(participant, selectedRoom, input.tracks));
      }
    }
  }
  const participants = Array.from(participantMap.values()).sort((left, right) => compareLabels(left.displayName, right.displayName));

  return {
    kind: selectedRoom?.roomType === 'project_room' ? 'project' : 'lounge',
    room: selectedRoom,
    projectId: selectedRoom?.projectId ?? null,
    projectName: selectedRoom?.projectName ?? selectedRoom?.name ?? '',
    joinState,
    selectionIntent: joinState === 'not_joined' ? 'focus_only' : 'joined',
    stageMode: 'meet_like_focus',
    members,
    participants,
    mediaTracks,
    screenTracks,
    pinnedTrackId,
    recordingState: input.recordingState ?? 'idle',
    presenceSummary: {
      memberCount: participants.length,
      speakingCount: participants.filter((participant) => participant.isSpeaking).length,
      screenShareCount: screenTracks.length,
    },
  };
}

export function deriveLoungeLayer(input: DeriveLoungeLayerInput = {}): CoWorkingLoungeLayer {
  const loungeRoom = input.loungeRoom ?? null;
  return {
    room: loungeRoom,
    members: (input.floor ?? []).filter((presence) => (
      presence.ringState === 'lounge' || Boolean(loungeRoom && presence.roomId === loungeRoom.id)
    )),
    visible: true,
    miniControlVisible: Boolean(input.projectZoneActive),
    audioPriority: input.projectZoneActive ? 'project' : 'lounge',
  };
}

export function deriveProjectMediaHonesty(
  input: DeriveProjectMediaHonestyInput = {},
): CoWorkingProjectMediaHonesty {
  const activeProjectJoin = Boolean(input.activeProjectJoin);
  const transportState: CoWorkingMediaTransportState = input.transportState
    ?? (input.transportReady
      ? 'ready'
      : input.transportError
        ? 'unavailable'
        : 'deferred');
  const mediaEnabled = activeProjectJoin && transportState === 'ready';
  const primaryCopy = !activeProjectJoin
    ? 'Drop in to enable project media.'
    : transportState === 'ready'
      ? 'Project media ready.'
      : transportState === 'degraded'
        ? 'Live SFU transport unavailable; presence and metadata are still available.'
        : transportState === 'unavailable'
          ? 'Presence and track metadata recorded; live SFU media is not connected.'
          : transportState === 'simulated'
            ? 'Simulated media provider active; live SFU proof is still pending.'
            : 'Project mic, camera & screen ship with realtime media transport.';

  return {
    controlsVisible: true,
    activeProjectJoin,
    transportState,
    gated: !mediaEnabled,
    audioEnabled: mediaEnabled,
    cameraEnabled: mediaEnabled,
    screenEnabled: mediaEnabled,
    primaryCopy,
    gateCopy: mediaEnabled
      ? 'Project mic, camera, and screen can publish through live transport.'
      : 'Controls gated; no hidden publish until live SFU transport is connected.',
    proofCopy: mediaEnabled
      ? 'True live SFU proof verified for project media.'
      : 'SFU live proof pending; local visual fallback is not live proof.',
    signals: [
      'controls visible',
      transportState === 'ready' ? 'transport ready' : `transport ${transportState}`,
      mediaEnabled ? 'controls enabled' : 'controls gated',
      'no hidden publish',
    ],
  };
}

export function deriveRecordingConsentShell(
  input: DeriveRecordingConsentShellInput,
): CoWorkingRecordingConsentShell {
  const visible = input.focusedZone.kind === 'project' && Boolean(input.focusedZone.room);
  const activeProjectJoin = Boolean(input.activeProjectJoin);
  const canRequestConsent = visible && activeProjectJoin && input.focusedZone.participants.length > 0;

  return {
    visible,
    scope: 'focused_project_zone',
    loungeDefault: false,
    projectScoped: true,
    requiresConsent: true,
    canRequestConsent,
    startEnabled: false,
    participantCount: input.focusedZone.participants.length,
    captureKinds: ['audio', 'screen'],
    title: 'Recording consent',
    body: activeProjectJoin
      ? 'Recording requires project consent before any focused project-zone capture.'
      : 'Drop in before requesting project recording consent.',
    disabledReason: input.recordingRoutesReady
      ? 'Start disabled until every visible participant consents.'
      : 'Start disabled until every visible participant consents and recording routes are ready.',
    chips: [
      'focused project zone only',
      'project scoped',
      'consent required',
      'lounge is not recorded',
      'no hidden capture',
    ],
  };
}

function degradedSignal(
  kind: CoWorkingDegradedStateSignal['kind'],
  label: string,
  level: CoWorkingDegradedStateLevel,
  message: string,
): CoWorkingDegradedStateSignal {
  return { kind, label, level, message };
}

function permissionLabel(kind: MediaCaptureKind): string {
  if (kind === 'microphone') return 'Microphone';
  if (kind === 'camera') return 'Camera';
  return 'Screen recording';
}

function permissionMessage(kind: MediaCaptureKind, state: MediaPermissionState): string {
  if (state === 'granted') return `${permissionLabel(kind)} permission granted.`;
  if (state === 'not-determined') return `${permissionLabel(kind)} permission has not been requested yet.`;
  if (state === 'denied') return `${permissionLabel(kind)} permission denied; leave and closeout remain available.`;
  if (state === 'restricted') return `${permissionLabel(kind)} permission restricted by the operating system.`;
  return `${permissionLabel(kind)} permission status unknown; media stays gated.`;
}

function permissionState(status: MediaCaptureStatus | null | undefined, kind: MediaCaptureKind): MediaPermissionState {
  return status?.permissions?.[kind] ?? 'unknown';
}

export function deriveCoWorkingPrivacyPermissionAudit(
  input: DeriveCoWorkingPrivacyPermissionAuditInput = {},
): CoWorkingPrivacyPermissionAudit {
  const status = input.status ?? null;
  const permissionKinds: MediaCaptureKind[] = ['microphone', 'camera', 'screen'];
  const signals = permissionKinds.map((kind) => {
    const state = permissionState(status, kind);
    const systemSettingsOnly = kind === 'screen';
    const ok = state === 'granted';
    const blocked = state === 'denied' || state === 'restricted';
    const recoveryActions = ok
      ? ['refresh_status' as const]
      : [
        ...(kind === 'microphone' ? ['request_microphone' as const] : []),
        ...(kind === 'camera' ? ['request_camera' as const] : []),
        ...(systemSettingsOnly || blocked ? ['open_system_settings' as const] : []),
        'continue_without_media' as const,
      ];
    return {
      kind,
      label: permissionLabel(kind),
      state,
      level: ok ? 'ok' as const : blocked ? 'blocked' as const : 'recoverable' as const,
      recoverable: !ok,
      systemSettingsOnly,
      message: permissionMessage(kind, state),
      recoveryActions,
    };
  });

  return {
    visible: true,
    checkedAt: status?.checkedAt ?? null,
    sourceStatus: status,
    deviceError: input.deviceError ?? null,
    signals,
    blockedCount: signals.filter((signal) => signal.level === 'blocked').length,
    recoverableCount: signals.filter((signal) => signal.recoverable).length,
    leaveAvailable: true,
    closeoutAvailable: input.closeoutAvailable !== false,
    copy: input.deviceError
      ? 'Media permission/device errors are recoverable; leave and proof closeout remain available.'
      : 'Media permissions are audited separately from room membership, closeout, and meeting memory.',
    chips: [
      'permissions audit',
      'leave stays available',
      'closeout stays available',
      'screen is system settings only',
    ],
  };
}

export function deriveCoWorkingDegradedStates(
  input: DeriveCoWorkingDegradedStatesInput = {},
): CoWorkingIndependentDegradedStates {
  const transportState = input.transportState ?? 'deferred';
  const transportSignal = transportState === 'ready'
    ? degradedSignal('transport', 'Transport', 'ok', 'Live SFU transport connected for project media.')
    : transportState === 'degraded'
      ? degradedSignal('transport', 'Transport', 'blocked', 'Live SFU transport unavailable; presence and metadata are still available.')
      : transportState === 'unavailable'
        ? degradedSignal('transport', 'Transport', 'blocked', 'Presence and track metadata recorded; live SFU media is not connected.')
        : transportState === 'simulated'
          ? degradedSignal('transport', 'Transport', 'deferred', 'Simulated media provider active; live SFU proof is still pending.')
          : degradedSignal('transport', 'Transport', 'deferred', 'Project media transport deferred; controls stay gated.');
  const signals: CoWorkingDegradedStateSignal[] = [
    degradedSignal(
      'floor',
      'Floor',
      input.floorError ? 'blocked' : 'ok',
      input.floorError
        ? 'Floor presence is unavailable; room controls remain available below.'
        : 'Floor presence online.',
    ),
    degradedSignal(
      'rooms',
      'Rooms',
      input.roomsError ? 'blocked' : 'ok',
      input.roomsError
        ? 'Project rooms are unavailable; lounge remains available.'
        : 'Project rooms online.',
    ),
    degradedSignal(
      'room_detail',
      'Room detail',
      input.roomDetailError ? 'blocked' : 'ok',
      input.roomDetailError
        ? 'Focused room detail unavailable; room rail and lounge remain available.'
        : 'Focused room detail online.',
    ),
    degradedSignal(
      'devices',
      'Devices',
      input.deviceError ? 'blocked' : 'ok',
      input.deviceError
        ? 'Media device error; you can still leave or save closeout.'
        : 'Media devices available.',
    ),
    degradedSignal(
      'lounge',
      'Lounge',
      input.loungeError ? 'blocked' : 'ok',
      input.loungeError
        ? 'Lounge unavailable; project stage remains available.'
        : 'Lounge available.',
    ),
    transportSignal,
  ];

  return {
    title: 'Independent degraded states',
    signals,
    activeIssueCount: signals.filter((signal) => signal.level !== 'ok').length,
  };
}

export function deriveSfuLiveTransportAcceptance(
  input: DeriveSfuLiveTransportAcceptanceInput = {},
): CoWorkingSfuLiveTransportAcceptance {
  const liveProofVerified = Boolean(input.liveProofVerified && input.transportState === 'ready');
  const status = liveProofVerified
    ? 'verified'
    : input.transportState === 'degraded' || input.transportState === 'unavailable' || input.transportState === 'simulated'
      ? 'degraded_fallback'
      : 'pending_live_proof';

  return {
    liveProofRequired: true,
    liveProofVerified,
    localFallbackAccepted: true,
    status,
    proofBoundary: 'True live SFU proof requires configured Cloudflare, connected peer connection, remote stream receipt, and clean leave.',
    fallbackBoundary: 'Presence and track metadata recorded; live SFU media is not connected.',
    acceptanceCopy: liveProofVerified
      ? 'True live SFU transport proof is verified.'
      : 'True live SFU proof required before enabling project media; local visual fallback is not live proof.',
  };
}

function participantLabelFor(focusedZone: CoWorkingFocusedZone, participantId: string): string {
  return focusedZone.participants.find((participant) => participant.participantId === participantId)?.displayName
    ?? focusedZone.members.find((member) => member.participantId === participantId)?.displayName
    ?? participantId;
}

function remoteStreamKey(stream: CoWorkingObservedRemoteStream): string {
  return stream.trackId;
}

export function deriveCoWorkingRemoteTrackSubscriptionPlan(
  input: DeriveCoWorkingRemoteTrackSubscriptionPlanInput,
): CoWorkingRemoteTrackSubscriptionPlan {
  const roomId = input.focusedZone.room?.id ?? null;
  const observedRemoteTrackIds = new Set((input.remoteStreams ?? []).map(remoteStreamKey));
  const trackItems = (input.focusedZone.room ? input.focusedZone.mediaTracks : [])
    .filter((track) => track.state === 'live' && track.direction === 'publish')
    .filter((track) => !input.localParticipantId || track.participantId !== input.localParticipantId)
    .map((track) => {
      const hasProviderTrack = Boolean(track.cloudflareTrackId);
      const subscribed = observedRemoteTrackIds.has(track.id);
      return {
        trackId: track.id,
        participantId: track.participantId,
        participantLabel: participantLabelFor(input.focusedZone, track.participantId),
        trackKind: track.trackKind,
        label: track.label ?? `${participantLabelFor(input.focusedZone, track.participantId)} ${track.trackKind}`,
        cloudflareTrackId: track.cloudflareTrackId,
        state: subscribed ? 'subscribed' as const : hasProviderTrack ? 'mapped' as const : 'missing_provider_track' as const,
        mapsToScreenWall: track.trackKind === 'screen',
      };
    });
  const subscribeTargetTrackIds = trackItems
    .map((track) => track.cloudflareTrackId)
    .filter((trackId): trackId is string => Boolean(trackId));
  const missingProviderTrackIds = trackItems
    .filter((track) => !track.cloudflareTrackId)
    .map((track) => track.trackId);
  const screenWallTrackIds = trackItems
    .filter((track) => track.mapsToScreenWall)
    .map((track) => track.trackId);
  const canSubscribe = Boolean(input.providerConfigured && subscribeTargetTrackIds.length > 0);

  return {
    visible: true,
    roomId,
    localParticipantId: input.localParticipantId ?? null,
    providerConfigured: Boolean(input.providerConfigured),
    items: trackItems,
    subscribeTargetTrackIds,
    missingProviderTrackIds,
    screenWallTrackIds,
    canSubscribe,
    copy: canSubscribe
      ? 'Remote screen tracks are mapped to room participants and ready for SFU subscription.'
      : trackItems.length
        ? 'Remote track metadata is mapped locally; live SFU subscription still needs provider track IDs and configured transport.'
        : 'No remote room tracks are available to subscribe yet.',
    proofBoundary: 'A subscription plan is not live proof until a configured peer connection receives remote MediaStreams.',
    chips: [
      'remote track map',
      countLabel(trackItems.length, 'track'),
      countLabel(screenWallTrackIds.length, 'screen'),
      canSubscribe ? 'subscribe targets ready' : 'subscription not live proof',
    ],
  };
}

export function deriveCoWorkingMediaProviderHealth(
  input: DeriveCoWorkingMediaProviderHealthInput,
): CoWorkingMediaProviderHealth {
  const cloudflare = input.activeJoin?.cloudflare ?? null;
  const providerConfigured = Boolean(cloudflare?.configured);
  const connectionState = input.connectionState ?? 'not-started';
  const remoteStreams = input.remoteStreams ?? [];
  const subscribedRemoteStreamCount = remoteStreams.length;
  const subscribedScreenStreamCount = remoteStreams.filter((stream) => stream.trackKind === 'screen').length;
  const remoteTrackCount = input.remoteTrackPlan.items.length;
  const missingRemoteStreamCount = Math.max(0, input.remoteTrackPlan.subscribeTargetTrackIds.length - subscribedRemoteStreamCount);
  const connected = connectionState === 'connected' || connectionState === 'completed';
  const failed = connectionState === 'failed' || connectionState === 'disconnected' || connectionState === 'closed';
  const liveProofVerified = Boolean(providerConfigured && connected && remoteTrackCount > 0 && missingRemoteStreamCount === 0);
  const state: CoWorkingMediaProviderHealth['state'] = liveProofVerified
    ? 'connected'
    : !input.activeJoin
      ? 'deferred'
      : !providerConfigured
        ? 'unavailable'
        : failed
          ? 'degraded'
          : input.remoteTrackPlan.items.length
            ? 'simulated'
            : 'deferred';
  const transportState: CoWorkingMediaTransportState = state === 'connected'
    ? 'ready'
    : state === 'unavailable'
      ? 'unavailable'
      : state === 'simulated'
        ? 'simulated'
        : state === 'degraded'
          ? 'degraded'
          : 'deferred';

  return {
    visible: true,
    state,
    transportState,
    providerConfigured,
    negotiation: cloudflare?.negotiation ?? 'not_joined',
    connectionState,
    remoteTrackCount,
    subscribedRemoteStreamCount,
    subscribedScreenStreamCount,
    missingRemoteStreamCount,
    liveProofVerified,
    copy: liveProofVerified
      ? 'Live SFU provider connected and all planned remote streams were received.'
      : providerConfigured
        ? 'Provider metadata is configured, but live remote stream receipt is still unproven.'
        : 'Provider unavailable; room presence and track metadata remain visible without live media.',
    proofBoundary: 'Live proof requires configured provider, connected peer connection, remote stream receipt, and clean leave.',
    chips: [
      providerConfigured ? 'provider configured' : 'provider unavailable',
      `connection ${connectionState}`,
      countLabel(remoteTrackCount, 'remote track'),
      countLabel(subscribedRemoteStreamCount, 'remote stream'),
    ],
  };
}

export function deriveCoWorkingLiveScreenWallProof(
  input: DeriveCoWorkingLiveScreenWallProofInput,
): CoWorkingLiveScreenWallProof {
  const allTilesLive = input.wall.tiles.every((tile) => (
    tile.track.trackKind === 'screen'
    && tile.track.direction === 'publish'
    && tile.track.state === 'live'
  ));
  const pinnedTrackVisible = input.wall.pinnedTrackId
    ? input.wall.tiles.some((tile) => tile.trackId === input.wall.pinnedTrackId && tile.pinned)
    : true;

  return {
    visible: true,
    liveTrackCount: input.wall.tiles.length,
    pinnedTrackId: input.wall.pinnedTrackId,
    fullscreen: Boolean(input.fullscreen),
    allTilesLive,
    pinnedTrackVisible,
    copy: input.wall.tiles.length
      ? 'Live screen metadata drives wall, pin, unpin, and fullscreen state without fabricating media pixels.'
      : 'Screen wall waits for live published screen tracks before showing tiles.',
    chips: [
      countLabel(input.wall.tiles.length, 'live screen'),
      input.wall.pinnedTrackId ? 'pinned track visible' : 'no pinned track',
      input.fullscreen ? 'fullscreen shell' : 'inline wall',
      allTilesLive ? 'live metadata only' : 'non-live tracks ignored',
    ],
  };
}

export function deriveCoWorkingRoomCloseoutProofFixture(
  input: DeriveCoWorkingRoomCloseoutProofFixtureInput,
): CoWorkingRoomCloseoutProofFixture {
  const room = input.focusedZone.room;
  const activeJoin = input.activeJoin ?? null;
  const ready = Boolean(room && activeJoin);

  return {
    visible: true,
    roomId: room?.id ?? null,
    callSessionId: activeJoin?.call.id ?? null,
    projectId: room?.projectId ?? null,
    manualNotesRequired: true,
    reportEvidenceStatus: ready ? 'draft_ready' : 'blocked_until_closeout',
    transcriptRef: null,
    recordingRef: null,
    paperclipStatus: 'explicit_optional',
    proofChain: [
      'focused room work',
      'manual closeout fields',
      'meeting memory record',
      'report/evidence draft status',
    ],
    copy: ready
      ? 'Room work can produce a manual report/evidence draft after closeout, without hidden transcript or recording refs.'
      : 'Drop in and save manual closeout fields before report/evidence draft proof is available.',
    chips: ['room work', 'manual closeout', 'draft evidence', 'transcript ref null', 'recording ref null'],
  };
}

export function deriveCoWorkingProofCloseout(
  input: DeriveCoWorkingProofCloseoutInput,
): CoWorkingProofCloseoutLink {
  const room = input.focusedZone.room;
  const activeProjectJoin = Boolean(input.activeProjectJoin);
  const closeoutAvailable = input.closeoutAvailable !== false;
  const visible = input.focusedZone.kind === 'project' && Boolean(room);
  const enabled = visible && activeProjectJoin && closeoutAvailable;
  const disabledReason = enabled
    ? ''
    : !visible
      ? 'Select a project room before saving proof closeout.'
      : !activeProjectJoin
        ? 'Drop in and add notes, decisions, or action items before creating a proof draft.'
        : 'Closeout route unavailable; keep notes local until worker closeout returns.';

  return {
    visible,
    enabled,
    route: 'realtime:closeout',
    targetRoomId: room?.id ?? null,
    targetLabel: input.focusedZone.projectName || room?.name || 'Focused project room',
    title: 'Proof closeout',
    body: 'Creates a report/evidence draft from manual closeout fields only. No recording, transcript, or Paperclip handoff unless selected.',
    disabledReason,
    checklist: [
      'manual notes, decisions, or actions required',
      'optional Paperclip handoff',
      'no hidden transcript',
      'no hidden recording',
    ],
    chips: [
      'manual closeout',
      'report draft',
      'no hidden transcript',
      'no hidden recording',
    ],
  };
}

export function deriveCoWorkingRoomAuditEventPlan(
  input: DeriveCoWorkingRoomAuditEventPlanInput,
): CoWorkingRoomAuditEventPlan {
  const joined = Boolean(input.activeProjectJoin);
  const events: CoWorkingRoomAuditEventPlan['events'] = [
    {
      kind: joined ? 'presence_leave' : 'presence_join',
      label: joined ? 'Leave writes participant-left audit' : 'Drop in writes participant-joined audit',
      required: true,
    },
    {
      kind: 'media_state',
      label: `Media transport state recorded as ${input.transportState ?? 'deferred'}`,
      required: true,
    },
    {
      kind: 'recording_consent',
      label: input.recordingConsentRequired
        ? 'Recording consent must be visible before capture'
        : 'Recording consent remains unavailable until routes exist',
      required: true,
    },
    {
      kind: 'recording_blocked',
      label: 'Blocked recording state is explicit and audit-visible',
      required: true,
    },
    {
      kind: 'closeout_saved',
      label: 'Closeout save writes manual meeting memory',
      required: true,
    },
    {
      kind: 'paperclip_handoff_requested',
      label: 'Paperclip handoff is optional and explicit',
      required: false,
    },
  ];

  return {
    visible: true,
    appendOnly: true,
    destination: 'worker_realtime_audit_events',
    roomId: input.focusedZone.room?.id ?? null,
    events,
    hiddenSideEffectsForbidden: [
      'hidden transcription',
      'hidden recording',
      'hidden Paperclip write',
      'hidden time-entry creation',
    ],
    copy: 'Room actions should leave append-only audit rows without creating hidden artifacts.',
    chips: ['append-only audit', 'explicit side effects', 'worker-owned'],
  };
}

export function deriveCoWorkingMeetingMemoryPolicy(
  input: DeriveCoWorkingMeetingMemoryPolicyInput,
): CoWorkingMeetingMemoryPolicy {
  return {
    visible: true,
    mode: 'manual_closeout',
    transcriptState: 'deferred',
    transcriptRef: null,
    recordingRef: null,
    paperclipOptional: true,
    participantCount: input.focusedZone.presenceSummary.memberCount,
    screenShareCount: input.focusedZone.presenceSummary.screenShareCount,
    manualFields: ['manualNotes', 'decisions', 'actionItems'],
    title: 'Manual meeting memory',
    body: 'Meeting memory is manual closeout only: notes, decisions, actions, and optional Paperclip handoff.',
    chips: ['manual notes', 'decisions', 'actions', 'transcript ref null', 'recording ref null'],
  };
}

export function deriveCoWorkingTranscriptionBoundary(): CoWorkingTranscriptionBoundary {
  return {
    visible: true,
    state: 'deferred',
    autoTranscription: false,
    transcriptRef: null,
    recordingRef: null,
    body: 'Transcription stays deferred; closeout never generates a transcript or recording ref.',
    chips: ['transcription deferred', 'auto transcript off', 'closeout cannot capture'],
  };
}

export function deriveCoWorkingTwoParticipantSimulation(
  input: DeriveCoWorkingTwoParticipantSimulationInput,
): CoWorkingTwoParticipantSimulation {
  const participantNames = input.focusedZone.participants
    .map((participant) => participant.displayName)
    .filter(Boolean);
  const participantCount = participantNames.length;
  const minimumMet = participantCount >= 2;

  return {
    localOnly: true,
    minimumParticipants: 2,
    participantCount,
    minimumMet,
    participantNames,
    screenShareCount: input.focusedZone.presenceSummary.screenShareCount,
    copy: minimumMet
      ? 'Local simulation only; no live SFU claim. Two visible participants satisfy deterministic co-working regression proof.'
      : 'Local simulation only; no live SFU claim. Two-participant regression still needs another visible participant.',
    chips: [
      'local simulation',
      countLabel(participantCount, 'participant'),
      countLabel(input.focusedZone.presenceSummary.screenShareCount, 'screen'),
    ],
  };
}

export function deriveScreenWall(
  tracks: RealtimeMediaTrack[] = [],
  pinnedTrackId: string | null = null,
): CoWorkingScreenWall {
  const screenTracks = tracks
    .filter(isLivePublishedScreenTrack)
    .slice()
    .sort((left, right) => (
      left.startedAt.localeCompare(right.startedAt)
      || left.id.localeCompare(right.id)
    ));
  const activePinnedTrackId = screenTracks.some((track) => track.id === pinnedTrackId)
    ? pinnedTrackId
    : null;
  const tiles = screenTracks.map((track): CoWorkingScreenWallTile => ({
    trackId: track.id,
    participantId: track.participantId,
    label: track.label ?? track.participantId,
    pinned: track.id === activePinnedTrackId,
    track,
  }));

  return {
    mode: activePinnedTrackId ? 'pinned' : 'wall',
    pinnedTrackId: activePinnedTrackId,
    tiles,
  };
}
