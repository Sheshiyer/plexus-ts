import { describe, expect, it } from 'vitest';
import '../../src/shared/coworking';
import type {
  CoWorkingIndependentDegradedStates,
  CoWorkingFocusedZone,
  CoWorkingProjectMediaHonesty,
  CoWorkingPresenceMap,
  CoWorkingRecordingConsentShell,
  CoWorkingRecordingManifest,
  CoWorkingSfuLiveTransportAcceptance,
} from '../../src/shared/coworking';

describe('coworking shared contract types', () => {
  it('supports a presence-only focused project zone', () => {
    const zone: CoWorkingFocusedZone = {
      kind: 'project',
      room: null,
      projectId: 'project_ambient_floor',
      projectName: 'Ambient floor',
      joinState: 'presence_only',
      selectionIntent: 'joined',
      stageMode: 'meet_like_focus',
      members: [
        {
          participantId: 'participant_shesh',
          displayName: 'Shesh',
          initials: 'SI',
          ringState: 'online',
          roomId: 'room_project_ambient_floor',
          roomName: 'Ambient floor',
          projectTag: 'AMBIENT FLOOR - 12m',
          isSpeaking: false,
        },
      ],
      participants: [
        {
          participantId: 'participant_shesh',
          displayName: 'Shesh',
          initials: 'SI',
          ringState: 'online',
          roomId: 'room_project_ambient_floor',
          roomName: 'Ambient floor',
          projectTag: 'AMBIENT FLOOR - 12m',
          isSpeaking: false,
          stageRole: 'participant',
        },
      ],
      screenTracks: [],
      pinnedTrackId: null,
      recordingState: 'idle',
      presenceSummary: {
        memberCount: 1,
        speakingCount: 0,
        screenShareCount: 0,
      },
    };

    expect(zone.joinState).toBe('presence_only');
    expect(zone.members[0]?.projectTag).toContain('AMBIENT FLOOR');
    expect(zone.selectionIntent).toBe('joined');
    expect(zone.participants[0]?.stageRole).toBe('participant');
  });

  it('supports a focus-only presence map contract', () => {
    const map: CoWorkingPresenceMap = {
      zones: [
        {
          key: 'online',
          label: 'On the floor',
          participants: [],
          activeRoomIds: [],
        },
      ],
      totalPresent: 0,
      activeRoomIds: [],
      focusOnly: true,
    };

    expect(map.focusOnly).toBe(true);
  });

  it('supports a manifest-first recording description', () => {
    const manifest: CoWorkingRecordingManifest = {
      id: 'recording_manifest_1',
      workspaceId: 'workspace_1',
      projectId: 'project_ambient_floor',
      roomId: 'room_project_ambient_floor',
      callSessionId: 'call_session_1',
      startedAt: '2026-07-05T10:00:00.000Z',
      endedAt: null,
      r2Prefix: 'coworking/workspace_1/project_ambient_floor/call_session_1',
      rawTracks: [
        {
          trackId: 'track_screen_1',
          participantId: 'participant_shesh',
          kind: 'screen',
          objectKey: 'coworking/workspace_1/project_ambient_floor/call_session_1/raw/track_screen_1.webm',
          startedAt: '2026-07-05T10:00:03.000Z',
          endedAt: null,
        },
      ],
      composedPlaybackRef: null,
      consent: [
        {
          participantId: 'participant_shesh',
          displayName: 'Shesh',
          consentedAt: '2026-07-05T09:59:58.000Z',
          revokedAt: null,
        },
      ],
    };

    expect(manifest.rawTracks[0]?.kind).toBe('screen');
    expect(manifest.consent[0]?.revokedAt).toBeNull();
  });

  it('supports media honesty, consent, degraded, and SFU acceptance contracts', () => {
    const media: CoWorkingProjectMediaHonesty = {
      controlsVisible: true,
      activeProjectJoin: true,
      transportState: 'deferred',
      gated: true,
      audioEnabled: false,
      cameraEnabled: false,
      screenEnabled: false,
      primaryCopy: 'Project mic, camera & screen ship with realtime media transport.',
      gateCopy: 'Controls gated; no hidden publish until live SFU transport is connected.',
      proofCopy: 'SFU live proof pending; local visual fallback is not live proof.',
      signals: ['controls visible', 'transport deferred', 'controls gated', 'no hidden publish'],
    };
    const consent: CoWorkingRecordingConsentShell = {
      visible: true,
      scope: 'focused_project_zone',
      loungeDefault: false,
      projectScoped: true,
      requiresConsent: true,
      canRequestConsent: false,
      startEnabled: false,
      participantCount: 2,
      captureKinds: ['audio', 'screen'],
      title: 'Recording consent',
      body: 'Recording requires project consent before any focused project-zone capture.',
      disabledReason: 'Start disabled until every visible participant consents and recording routes are ready.',
      chips: ['focused project zone only', 'project scoped', 'consent required', 'lounge is not recorded', 'no hidden capture'],
    };
    const degraded: CoWorkingIndependentDegradedStates = {
      title: 'Independent degraded states',
      activeIssueCount: 1,
      signals: [
        {
          kind: 'transport',
          label: 'Transport',
          level: 'deferred',
          message: 'Project media transport deferred; controls stay gated.',
        },
      ],
    };
    const sfu: CoWorkingSfuLiveTransportAcceptance = {
      liveProofRequired: true,
      liveProofVerified: false,
      localFallbackAccepted: true,
      status: 'pending_live_proof',
      proofBoundary: 'True live SFU proof requires configured Cloudflare, connected peer connection, remote stream receipt, and clean leave.',
      fallbackBoundary: 'Presence and track metadata recorded; live SFU media is not connected.',
      acceptanceCopy: 'True live SFU proof required before enabling project media; local visual fallback is not live proof.',
    };

    expect(media.gated).toBe(true);
    expect(consent.loungeDefault).toBe(false);
    expect(degraded.signals[0]?.kind).toBe('transport');
    expect(sfu.status).toBe('pending_live_proof');
  });
});
