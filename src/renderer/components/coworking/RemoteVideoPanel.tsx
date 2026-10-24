import React, { useEffect, useRef, useState } from 'react';
import type { RemoteStream } from '../../lib/RealtimeSession';
import { attachRemoteVideo } from '../../lib/remoteVideoBinding';
import './RemoteVideoPanel.css';

export function RemoteVideoTile({ remote, label }: { remote: RemoteStream; label: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bindingRef = useRef<ReturnType<typeof attachRemoteVideo> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  useEffect(() => {
    if (!videoRef.current) return;
    setError(null);
    setStarted(false);
    const binding = attachRemoteVideo(videoRef.current, remote.stream, setError, () => { setStarted(true); setError(null); });
    bindingRef.current = binding;
    return () => {
      binding.dispose();
      if (bindingRef.current === binding) bindingRef.current = null;
    };
  }, [remote.stream]);
  return (
    <figure className={`px-remote-video-tile ${remote.trackKind === 'screen' ? 'screen' : 'camera'}`}>
      <video ref={videoRef} autoPlay playsInline muted aria-label={label} onError={() => setError('The received video could not be decoded. Retry playback or rejoin the room.')} />
      <figcaption>{label}</figcaption>
      {error ? <div className="px-remote-video-status" role="alert">
        <span>{error}</span>
        <button type="button" onClick={() => { void bindingRef.current?.retry(); }}>Retry video playback</button>
      </div> : !started && <div className="px-remote-video-status" role="status">Starting received video…</div>}
    </figure>
  );
}

export default function RemoteVideoPanel({ streams, roomName, participants = [] }: {
  streams: RemoteStream[];
  roomName: string;
  participants?: { id: string; displayName: string }[];
}) {
  const videos = streams.filter((remote) => remote.trackKind === 'camera' || remote.trackKind === 'screen');
  if (!videos.length) return null;
  const label = (remote: RemoteStream) => `${participants.find((participant) => participant.id === remote.participantId)?.displayName ?? 'Participant'} · ${remote.trackKind === 'screen' ? 'screen share' : 'camera'}`;
  return <section className="px-remote-video-panel" aria-label={`Received video in ${roomName}`}>
    <header><h3>{roomName} · received video</h3><p>Audio plays through the room speakers. Video tiles are muted.</p></header>
    {(['screen', 'camera'] as const).map((kind) => {
      const matching = videos.filter((remote) => remote.trackKind === kind);
      return matching.length ? <div key={kind} className={`px-remote-video-grid ${kind}`} aria-label={kind === 'screen' ? 'Shared screens' : 'Participant cameras'}>
        {matching.map((remote) => <RemoteVideoTile key={remote.trackId} remote={remote} label={label(remote)} />)}
      </div> : null;
    })}
  </section>;
}
