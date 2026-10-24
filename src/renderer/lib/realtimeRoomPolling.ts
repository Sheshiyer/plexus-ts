import type { RealtimeMediaTrack, RealtimeRoomDetail } from '../../shared/types';

export type RealtimeRoomScope = { roomId: string; callId: string; participantId: string };

/** Poll only the joined call; a selected room preview never authorizes media. */
export function startRealtimeRoomPolling(input: {
  scope: RealtimeRoomScope;
  fetchDetail: (roomId: string) => Promise<{ ok: boolean; detail?: RealtimeRoomDetail; message?: string }>;
  onDetail: (detail: RealtimeRoomDetail) => void;
  onTracks: (tracks: RealtimeMediaTrack[], scope: RealtimeRoomScope) => Promise<void>;
  onError: (message: string) => void;
  intervalMs: number;
}): () => void {
  let disposed = false;
  let pending = false;
  const refresh = async () => {
    if (disposed || pending) return;
    pending = true;
    try {
      const result = await input.fetchDetail(input.scope.roomId);
      if (disposed) return;
      if (!result.ok || !result.detail) throw new Error(result.message ?? 'Active room detail unavailable.');
      const detail = result.detail;
      if (detail.room.id !== input.scope.roomId || detail.call?.id !== input.scope.callId) return;
      input.onDetail(detail);
      const tracks = detail.tracks.filter((track) => track.roomId === input.scope.roomId
        && track.callSessionId === input.scope.callId
        && track.participantId !== input.scope.participantId
        && track.direction === 'publish' && track.state === 'live' && Boolean(track.cloudflareTrackId));
      if (!disposed) await input.onTracks(tracks, input.scope);
    } catch (error) {
      if (!disposed) input.onError(error instanceof Error ? error.message : String(error));
    } finally {
      pending = false;
    }
  };
  void refresh();
  const timer = setInterval(() => { void refresh(); }, input.intervalMs);
  return () => { disposed = true; clearInterval(timer); };
}
