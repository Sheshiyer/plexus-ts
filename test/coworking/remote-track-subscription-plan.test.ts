import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deriveCoWorkingMediaProviderHealth,
  deriveCoWorkingRemoteTrackSubscriptionPlan,
  deriveFocusedZone,
} from '../../src/renderer/lib/coworkingModel';
import type {
  RealtimeJoinResponse,
  RealtimeMediaTrack,
  RealtimeParticipant,
  RealtimeRoom,
} from '../../src/shared/types';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

const startedAt = '2026-07-10T10:00:00.000Z';

function room(): RealtimeRoom {
  return {
    id: 'room_project_live_boundary',
    workspaceId: 'workspace_1',
    projectId: 'project_live_boundary',
    projectName: 'Live boundary',
    name: 'Live boundary room',
    slug: 'live-boundary',
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_live_boundary',
    activeCall: null,
    presence: { participants: 3, screenShares: 1 },
    metadata: {},
    lastActivityAt: startedAt,
    createdAt: startedAt,
    updatedAt: startedAt,
  };
}

function participant(id: string, displayName: string): RealtimeParticipant {
  return {
    id,
    workspaceId: 'workspace_1',
    roomId: 'room_project_live_boundary',
    callSessionId: 'call_live_boundary',
    identityId: `identity_${id}`,
    employeeId: null,
    displayName,
    role: 'participant',
    state: 'joined',
    cloudflareSessionId: `cf_session_${id}`,
    media: { audio: true, video: true, screen: id === 'participant_maya' },
    joinedAt: startedAt,
    leftAt: null,
    lastSeenAt: startedAt,
    metadata: {},
  };
}

function track(input: {
  id: string;
  participantId: string;
  trackKind: RealtimeMediaTrack['trackKind'];
  label: string;
  cloudflareTrackId?: string | null;
}): RealtimeMediaTrack {
  return {
    id: input.id,
    workspaceId: 'workspace_1',
    roomId: 'room_project_live_boundary',
    callSessionId: 'call_live_boundary',
    participantId: input.participantId,
    identityId: `identity_${input.participantId}`,
    trackKind: input.trackKind,
    direction: 'publish',
    state: 'live',
    label: input.label,
    sourceId: null,
    cloudflareSessionId: `cf_session_${input.participantId}`,
    cloudflareTrackId: input.cloudflareTrackId ?? null,
    targetTrackIds: [],
    metadata: {},
    startedAt,
    endedAt: null,
    updatedAt: startedAt,
  };
}

function activeJoin(): RealtimeJoinResponse {
  const selectedRoom = room();
  return {
    room: selectedRoom,
    call: {
      id: 'call_live_boundary',
      workspaceId: selectedRoom.workspaceId,
      roomId: selectedRoom.id,
      projectId: selectedRoom.projectId,
      state: 'live',
      createdByIdentityId: 'identity_participant_local',
      meetingRecordId: null,
      provider: 'cloudflare',
      metadata: {},
      startedAt,
      endedAt: null,
      createdAt: startedAt,
      updatedAt: startedAt,
    },
    participant: participant('participant_local', 'Shesh Iyer'),
    cloudflare: {
      configured: true,
      appId: 'cf_app_1',
      sessionId: 'cf_session_local',
      sessionDescription: null,
      stunUrls: ['stun:stun.cloudflare.com:3478'],
      negotiation: 'session_created',
    },
  };
}

describe('coworking remote track subscription plan', () => {
  it('maps remote audio, camera, and screen tracks without calling the plan live proof', () => {
    const selectedRoom = room();
    const focusedZone = deriveFocusedZone({
      selectedRoom,
      activeRoomId: selectedRoom.id,
      participants: [
        participant('participant_local', 'Shesh Iyer'),
        participant('participant_maya', 'Maya Patel'),
        participant('participant_ravi', 'Ravi Menon'),
      ],
      tracks: [
        track({
          id: 'track_audio_maya',
          participantId: 'participant_maya',
          trackKind: 'audio',
          label: 'Maya audio',
          cloudflareTrackId: 'cf_track_audio_maya',
        }),
        track({
          id: 'track_camera_ravi',
          participantId: 'participant_ravi',
          trackKind: 'camera',
          label: 'Ravi camera',
          cloudflareTrackId: 'cf_track_camera_ravi',
        }),
        track({
          id: 'track_screen_maya',
          participantId: 'participant_maya',
          trackKind: 'screen',
          label: 'Maya screen',
          cloudflareTrackId: 'cf_track_screen_maya',
        }),
        track({
          id: 'track_audio_missing',
          participantId: 'participant_ravi',
          trackKind: 'audio',
          label: 'Ravi metadata only audio',
          cloudflareTrackId: null,
        }),
        track({
          id: 'track_audio_local',
          participantId: 'participant_local',
          trackKind: 'audio',
          label: 'Local audio',
          cloudflareTrackId: 'cf_track_audio_local',
        }),
      ],
    });

    const plan = deriveCoWorkingRemoteTrackSubscriptionPlan({
      focusedZone,
      localParticipantId: 'participant_local',
      providerConfigured: true,
      remoteStreams: [{ participantId: 'participant_maya', trackId: 'track_screen_maya', trackKind: 'screen' }],
    });

    expect(plan).toMatchObject({
      visible: true,
      roomId: selectedRoom.id,
      localParticipantId: 'participant_local',
      providerConfigured: true,
      subscribeTargetTrackIds: ['cf_track_audio_maya', 'cf_track_camera_ravi', 'cf_track_screen_maya'],
      missingProviderTrackIds: ['track_audio_missing'],
      screenWallTrackIds: ['track_screen_maya'],
      canSubscribe: true,
    });
    expect(plan.items.map((item) => ({
      trackId: item.trackId,
      participantLabel: item.participantLabel,
      trackKind: item.trackKind,
      state: item.state,
      mapsToScreenWall: item.mapsToScreenWall,
    }))).toEqual([
      {
        trackId: 'track_audio_maya',
        participantLabel: 'Maya Patel',
        trackKind: 'audio',
        state: 'mapped',
        mapsToScreenWall: false,
      },
      {
        trackId: 'track_camera_ravi',
        participantLabel: 'Ravi Menon',
        trackKind: 'camera',
        state: 'mapped',
        mapsToScreenWall: false,
      },
      {
        trackId: 'track_screen_maya',
        participantLabel: 'Maya Patel',
        trackKind: 'screen',
        state: 'subscribed',
        mapsToScreenWall: true,
      },
      {
        trackId: 'track_audio_missing',
        participantLabel: 'Ravi Menon',
        trackKind: 'audio',
        state: 'missing_provider_track',
        mapsToScreenWall: false,
      },
    ]);
    expect(plan.copy).toContain('ready for SFU subscription');
    expect(plan.proofBoundary).toContain('not live proof');
  });

  it('keeps provider health simulated until remote MediaStreams are actually received', () => {
    const selectedRoom = room();
    const focusedZone = deriveFocusedZone({
      selectedRoom,
      activeRoomId: selectedRoom.id,
      participants: [
        participant('participant_local', 'Shesh Iyer'),
        participant('participant_maya', 'Maya Patel'),
      ],
      tracks: [
        track({
          id: 'track_screen_maya',
          participantId: 'participant_maya',
          trackKind: 'screen',
          label: 'Maya screen',
          cloudflareTrackId: 'cf_track_screen_maya',
        }),
      ],
    });
    const plan = deriveCoWorkingRemoteTrackSubscriptionPlan({
      focusedZone,
      localParticipantId: 'participant_local',
      providerConfigured: true,
    });

    expect(deriveCoWorkingMediaProviderHealth({
      activeJoin: activeJoin(),
      connectionState: 'not-started',
      remoteTrackPlan: plan,
      remoteStreams: [],
    })).toMatchObject({
      state: 'simulated',
      transportState: 'simulated',
      remoteTrackCount: 1,
      subscribedRemoteStreamCount: 0,
      missingRemoteStreamCount: 1,
      liveProofVerified: false,
    });

    expect(deriveCoWorkingMediaProviderHealth({
      activeJoin: activeJoin(),
      connectionState: 'connected',
      remoteTrackPlan: plan,
      remoteStreams: [{ participantId: 'participant_maya', trackId: 'track_screen_maya', trackKind: 'screen' }],
    })).toMatchObject({
      state: 'connected',
      transportState: 'ready',
      subscribedRemoteStreamCount: 1,
      subscribedScreenStreamCount: 1,
      missingRemoteStreamCount: 0,
      liveProofVerified: true,
    });
  });

  it('keeps the RealtimeSession subscription path mapped by transceiver mid', () => {
    const session = source('src/renderer/lib/RealtimeSession.ts');

    expect(session).toContain('remoteTrackByMid');
    expect(session).toContain('participantId: mappedTrack?.participantId');
    expect(session).toContain('trackKind: mappedTrack?.trackKind');
    expect(session).toContain("direction: 'subscribe'");
    expect(session).toContain('targetTrackIds: subscriptionTargets.map');
  });
});
