import type {
  RealtimeCloudflareSession,
  RealtimeJoinResponse,
  RealtimeMediaTrack,
  RealtimeTrackKind,
} from '../../shared/types';

export type RemoteStream = {
  participantId: string;
  trackId: string;
  trackKind: 'audio' | 'camera' | 'screen';
  stream: MediaStream;
};

export type RemoteSubscriptionResult = {
  plannedCount: number;
  subscribedTargetCount: number;
  missingProviderTrackCount: number;
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
  private localTrackSenders = new Map<string, RTCRtpSender[]>();
  private localPublishedTrackIds = new Map<string, string>();
  private remoteStreams = new Map<string, RemoteStream>();
  private remoteTrackByMid = new Map<string, RealtimeMediaTrack>();
  private subscribedTrackIds = new Set<string>();
  private closed = false;
  private negotiationQueue: Promise<unknown> = Promise.resolve();

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const pending = this.negotiationQueue.then(operation);
    this.negotiationQueue = pending.catch(() => undefined);
    return pending;
  }

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
    if (this.closed) throw new Error('Realtime session is closed.');
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
      const mappedTrack = mid ? this.remoteTrackByMid.get(mid) : undefined;
      const remote: RemoteStream = {
        participantId: mappedTrack?.participantId ?? '',
        trackId: mappedTrack?.id ?? mid ?? event.track.id,
        trackKind: mappedTrack?.trackKind ?? (event.track.kind === 'audio' ? 'audio' : 'camera'),
        stream,
      };
      this.remoteStreams.set(remote.trackId, remote);
      this.events.onRemoteTrack(remote);

      event.track.onended = () => {
        if (this.closed) return;
        this.remoteStreams.delete(remote.trackId);
        this.subscribedTrackIds.delete(remote.trackId);
        if (mid) this.remoteTrackByMid.delete(mid);
        this.events.onRemoteTrackEnded(remote.trackId);
      };
      // A muted receiver may resume; only ended removes the stream mapping.

    };
  }

  async publishLocal(
    localId: string,
    stream: MediaStream,
    trackKind: 'audio' | 'camera' | 'screen',
    label: string,
  ): Promise<string | undefined> {
    return this.serialize(() => this.publishLocalNow(localId, stream, trackKind, label));
  }

  private async publishLocalNow(
    localId: string,
    stream: MediaStream,
    trackKind: 'audio' | 'camera' | 'screen',
    label: string,
  ): Promise<string | undefined> {
    if (this.closed || !this.pc || !this.cloudflare.configured || !this.cloudflare.sessionId) {
      this.events.onError('Media transport is unavailable.');
      return undefined;
    }
    if (this.localPublishedTrackIds.has(localId)) return this.localPublishedTrackIds.get(localId);
    const pc = this.pc;
    const matchingTracks = stream.getTracks().filter((track) => track.kind === (trackKind === 'audio' ? 'audio' : 'video'));
    if (matchingTracks.length !== 1) {
      this.events.onError('Publish one matching media track at a time.');
      return undefined;
    }
    const senders = matchingTracks.map((track) => pc.addTrack(track, stream));
    this.localTrackSenders.set(localId, senders);
    let publishedId: string | undefined;
    try {
      if (!senders.length) throw new Error('No local media tracks to publish.');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const sessionDescription = await this.gatheredDescription(pc);
      const mid = pc.getTransceivers().find((item) => item.sender === senders[0])?.mid;
      if (!mid) throw new Error('Local media track has no negotiated mid.');
      const result = await window.plexus.realtimePublishTrack(this.callId, {
        participantId: this.participantId,
        trackKind,
        direction: 'publish',
        label,
        sourceId: localId,
        sessionDescription,
        mid,
        metadata: { trackLabel: stream.getTracks()[0]?.label ?? label },
      });
      publishedId = result.track?.id;
      if (!result.ok || !result.track) throw new Error(result.message ?? `Could not publish ${trackKind} track.`);
      await this.applyAnswer(pc, result.cloudflare?.sessionDescription, result.cloudflare?.negotiation);
      if (!result.track.cloudflareTrackId) throw new Error('Provider track is missing; media publication is incomplete.');
      this.localPublishedTrackIds.set(localId, result.track.id);
      return result.track.id;
    } catch (error) {
      for (const sender of senders) if (pc.signalingState !== 'closed') pc.removeTrack(sender);
      this.localTrackSenders.delete(localId);
      await this.rollback(pc);
      if (publishedId) {
        try { await window.plexus.realtimeCloseTrack(this.callId, publishedId); } catch { /* Preserve original negotiation error. */ }
      }
      this.events.onError(error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  private async applyAnswer(pc: RTCPeerConnection, description: unknown, negotiation?: string): Promise<void> {
    if (this.closed) throw new Error('Realtime session is closed.');
    if (negotiation === 'negotiation_needed') throw new Error('Provider renegotiation is required; media is not connected.');
    const sdp = typeof description === 'string' ? description
      : description && typeof description === 'object' && 'sdp' in description
        && 'type' in description && description.type === 'answer' && typeof description.sdp === 'string'
        ? description.sdp : null;
    if (!sdp?.trim()) throw new Error('Provider SDP answer is missing; metadata alone cannot connect media.');
    await pc.setRemoteDescription({ type: 'answer' as RTCSdpType, sdp });
    if (this.closed) throw new Error('Realtime session is closed.');
  }

  private async gatheredDescription(pc: RTCPeerConnection): Promise<RTCSessionDescriptionInit> {
    if (pc.iceGatheringState !== 'complete') {
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          if (pc.iceGatheringState === 'complete') { cleanup(); resolve(); }
          else if (this.closed || pc.signalingState === 'closed') { cleanup(); reject(new Error('Realtime session is closed.')); }
        };
        const cleanup = () => {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', finish);
          pc.removeEventListener('signalingstatechange', finish);
        };
        const timeout = setTimeout(() => { cleanup(); reject(new Error('ICE gathering timed out.')); }, 10_000);
        pc.addEventListener('icegatheringstatechange', finish);
        pc.addEventListener('signalingstatechange', finish);
        finish();
      });
    }
    if (this.closed || !pc.localDescription?.sdp) throw new Error('Local SDP is unavailable.');
    return { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
  }

  private async rollback(pc: RTCPeerConnection): Promise<void> {
    if (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer') {
      try { await pc.setLocalDescription({ type: 'rollback' }); } catch { /* Caller reports the negotiation failure. */ }
    }
  }

  async subscribeRemote(tracks: RealtimeMediaTrack[]): Promise<RemoteSubscriptionResult> {
    return this.serialize(() => this.subscribeRemoteNow(tracks));
  }

  private async subscribeRemoteNow(tracks: RealtimeMediaTrack[]): Promise<RemoteSubscriptionResult> {
    if (this.closed || !this.pc || !this.cloudflare.configured || !this.cloudflare.sessionId) {
      return { plannedCount: 0, subscribedTargetCount: 0, missingProviderTrackCount: 0 };
    }

    const remoteTracks = tracks.filter(
      (t) => t.state === 'live' && t.participantId !== this.participantId && t.direction === 'publish',
    );
    if (!remoteTracks.length) {
      return { plannedCount: 0, subscribedTargetCount: 0, missingProviderTrackCount: 0 };
    }
    const subscriptionTargets = remoteTracks.filter((track) => Boolean(track.cloudflareTrackId));
    if (!subscriptionTargets.length) {
      return {
        plannedCount: remoteTracks.length,
        subscribedTargetCount: 0,
        missingProviderTrackCount: remoteTracks.length,
      };
    }

    const pending = subscriptionTargets.filter((track) => !this.subscribedTrackIds.has(track.id));
    for (const target of pending) {
      if (this.closed) break;
      const pc = this.pc;
      const mappedMids: string[] = [];
      try {
        const workerTrackKind: RealtimeTrackKind = target.trackKind;
        const result = await window.plexus.realtimePublishTrack(this.callId, {
          participantId: this.participantId,
          trackKind: workerTrackKind,
          direction: 'subscribe',
          targetTrackIds: [target.id],
        });
        if (!result.ok) throw new Error(result.message ?? 'Could not subscribe to remote tracks.');
        const description = result.cloudflare?.sessionDescription;
        if (!description || typeof description !== 'object' || !('type' in description)
          || description.type !== 'offer' || !('sdp' in description) || typeof description.sdp !== 'string' || !description.sdp.trim()) {
          throw new Error('Provider subscription SDP offer is missing.');
        }
        {
          const track = target;
          const mapping = result.cloudflare?.tracks?.find((item) => item.trackId === track.id);
          if (!mapping?.mid) throw new Error('Provider subscription mid mapping is missing.');
          this.remoteTrackByMid.set(mapping.mid, track);
          mappedMids.push(mapping.mid);
        }
        if (this.closed) throw new Error('Realtime session is closed.');
        await pc.setRemoteDescription({ type: 'offer', sdp: description.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const sessionDescription = await this.gatheredDescription(pc);
        const completed = await window.plexus.realtimeRenegotiate(this.callId, {
          participantId: this.participantId,
          sessionDescription,
        });
        if (!completed.ok) throw new Error(completed.message ?? 'Provider subscription renegotiation failed.');
        if (this.closed) throw new Error('Realtime session is closed.');
        this.subscribedTrackIds.add(target.id);
      } catch (error) {
        for (const mid of mappedMids) {
          const mapped = this.remoteTrackByMid.get(mid);
          if (mapped && this.remoteStreams.delete(mapped.id)) this.events.onRemoteTrackEnded(mapped.id);
          this.remoteTrackByMid.delete(mid);
        }
        await this.rollback(pc);
        this.events.onError(error instanceof Error ? error.message : String(error));
      }
    }
    return {
      plannedCount: remoteTracks.length,
      subscribedTargetCount: subscriptionTargets.filter((track) => this.subscribedTrackIds.has(track.id)).length,
      missingProviderTrackCount: remoteTracks.length - subscriptionTargets.length,
    };
  }

  async unpublishLocal(localId: string): Promise<void> {
    return this.serialize(() => this.unpublishLocalNow(localId));
  }

  private async unpublishLocalNow(localId: string): Promise<void> {
    const senders = this.localTrackSenders.get(localId);
    if (senders && this.pc) {
      for (const sender of senders) this.pc.removeTrack(sender);
      this.localTrackSenders.delete(localId);
    }
    const trackId = this.localPublishedTrackIds.get(localId);
    if (trackId) {
      try {
        const result = await window.plexus.realtimeCloseTrack(this.callId, trackId);
        if (!result.ok) throw new Error(result.message ?? 'Could not close media track.');
        this.localPublishedTrackIds.delete(localId);
      } catch (err: any) {
        this.events.onError(err?.message ?? String(err));
      }
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const [, senders] of this.localTrackSenders) {
      if (this.pc) for (const sender of senders) this.pc.removeTrack(sender);
    }
    this.localTrackSenders.clear();
    this.localPublishedTrackIds.clear();
    this.remoteStreams.clear();
    this.subscribedTrackIds.clear();
    this.remoteTrackByMid.clear();
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }

  getRemoteStreams(): RemoteStream[] {
    return Array.from(this.remoteStreams.values());
  }
}
