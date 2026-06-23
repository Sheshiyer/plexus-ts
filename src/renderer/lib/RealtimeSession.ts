import type {
  RealtimeCloudflareSession,
  RealtimeJoinResponse,
  RealtimeMediaTrack,
} from '../../shared/types';

export type RemoteStream = {
  participantId: string;
  trackId: string;
  trackKind: 'audio' | 'camera' | 'screen';
  stream: MediaStream;
};

export type SessionEvents = {
  onRemoteTrack: (remote: RemoteStream) => void;
  onRemoteTrackEnded: (trackId: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onError: (message: string) => void;
};

export class RealtimeSession {
  private pc: RTCPeerConnection | null = null;
  private callId: string;
  private participantId: string;
  private cloudflare: RealtimeCloudflareSession;
  private events: SessionEvents;
  private localTrackSenders = new Map<string, RTCRtpSender>();
  private localPublishedTrackIds = new Map<string, string>();
  private remoteStreams = new Map<string, RemoteStream>();
  private closed = false;

  constructor(
    joinResponse: RealtimeJoinResponse,
    events: SessionEvents,
  ) {
    this.callId = joinResponse.call.id;
    this.participantId = joinResponse.participant.id;
    this.cloudflare = joinResponse.cloudflare;
    this.events = events;
  }

  get configured(): boolean {
    return this.cloudflare.configured;
  }

  get connectionState(): RTCPeerConnectionState | 'not-started' {
    return this.pc?.connectionState ?? 'not-started';
  }

  async init(): Promise<void> {
    if (!this.cloudflare.configured) return;
    if (this.pc) return;

    const config: RTCConfiguration = {
      iceServers: this.cloudflare.stunUrls.map((url) => ({ urls: url })),
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    this.pc = new RTCPeerConnection(config);

    this.pc.onconnectionstatechange = () => {
      if (this.closed || !this.pc) return;
      this.events.onConnectionStateChange(this.pc.connectionState);
    };

    this.pc.ontrack = (event) => {
      if (this.closed) return;
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      const mid = event.transceiver.mid;
      const remote: RemoteStream = {
        participantId: '',
        trackId: mid ?? event.track.id,
        trackKind: event.track.kind === 'audio' ? 'audio' : 'camera',
        stream,
      };
      this.remoteStreams.set(remote.trackId, remote);
      this.events.onRemoteTrack(remote);

      event.track.onended = () => {
        this.remoteStreams.delete(remote.trackId);
        this.events.onRemoteTrackEnded(remote.trackId);
      };
      event.track.onmute = () => {
        this.remoteStreams.delete(remote.trackId);
        this.events.onRemoteTrackEnded(remote.trackId);
      };
    };
  }

  async publishLocal(
    localId: string,
    stream: MediaStream,
    trackKind: 'audio' | 'camera' | 'screen',
    label: string,
  ): Promise<string | undefined> {
    if (!this.pc || !this.cloudflare.configured) {
      return this.publishMetadataOnly(trackKind, label, localId);
    }

    for (const mediaTrack of stream.getTracks()) {
      const sender = this.pc.addTrack(mediaTrack, stream);
      this.localTrackSenders.set(localId, sender);
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const result = await window.plexus.realtimePublishTrack(this.callId, {
      participantId: this.participantId,
      trackKind,
      direction: 'publish',
      label,
      sourceId: localId,
      sdp: offer.sdp,
      cloudflareSessionId: this.cloudflare.sessionId,
      metadata: { trackLabel: stream.getTracks()[0]?.label ?? label },
    });

    if (!result.ok || !result.track) {
      this.events.onError(result.message ?? `Could not publish ${trackKind} track.`);
      return undefined;
    }
    this.localPublishedTrackIds.set(localId, result.track.id);

    if (result.cloudflare?.negotiation === 'session_created' || result.cloudflare?.negotiation === 'track_metadata_recorded') {
      // The Worker accepted track intent but did not return an SDP answer yet.
    }

    return result.track.id;
  }

  private async publishMetadataOnly(
    trackKind: 'audio' | 'camera' | 'screen',
    label: string,
    sourceId: string,
  ): Promise<string | undefined> {
    const result = await window.plexus.realtimePublishTrack(this.callId, {
      participantId: this.participantId,
      trackKind,
      direction: 'publish',
      label,
      sourceId,
      cloudflareSessionId: this.cloudflare.sessionId,
      metadata: { localOnly: true, trackLabel: label },
    });
    if (!result.ok || !result.track) {
      this.events.onError(result.message ?? `Could not publish ${trackKind} track.`);
      return undefined;
    }
    this.localPublishedTrackIds.set(sourceId, result.track.id);
    return result.track.id;
  }

  async subscribeRemote(tracks: RealtimeMediaTrack[]): Promise<void> {
    if (!this.pc || !this.cloudflare.configured) return;

    const remoteTracks = tracks.filter(
      (t) => t.state === 'live' && t.participantId !== this.participantId && t.direction === 'publish',
    );
    if (!remoteTracks.length) return;

    for (const track of remoteTracks) {
      if (this.remoteStreams.has(track.id)) continue;

      this.pc.addTransceiver(track.trackKind === 'audio' ? 'audio' : 'video', {
        direction: 'recvonly',
      });
    }

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const result = await window.plexus.realtimePublishTrack(this.callId, {
      participantId: this.participantId,
      trackKind: 'audio',
      direction: 'subscribe',
      sdp: offer.sdp,
      cloudflareSessionId: this.cloudflare.sessionId,
      targetTrackIds: remoteTracks.map((t) => t.cloudflareTrackId).filter(Boolean) as string[],
    });

    if (result.ok && result.track) {
      // Subscription registered
    }
  }

  async unpublishLocal(localId: string): Promise<void> {
    const sender = this.localTrackSenders.get(localId);
    if (sender && this.pc) {
      this.pc.removeTrack(sender);
      this.localTrackSenders.delete(localId);
    }
    const trackId = this.localPublishedTrackIds.get(localId);
    if (trackId) {
      this.localPublishedTrackIds.delete(localId);
      try {
        await window.plexus.realtimeCloseTrack(this.callId, trackId);
      } catch (err: any) {
        this.events.onError(err?.message ?? String(err));
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const [, sender] of this.localTrackSenders) {
      if (this.pc) this.pc.removeTrack(sender);
    }
    this.localTrackSenders.clear();
    this.localPublishedTrackIds.clear();
    this.remoteStreams.clear();
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  getRemoteStreams(): RemoteStream[] {
    return Array.from(this.remoteStreams.values());
  }
}
