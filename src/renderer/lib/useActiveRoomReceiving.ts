import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { RealtimeMediaTrack, RealtimeRoomDetail } from '../../shared/types';
import { startRealtimeRoomPolling, type RealtimeRoomScope } from './realtimeRoomPolling';

/** Receiving follows the active join, independently of the room being previewed. */
export function useActiveRoomReceiving({ entry, subscribe, setDetails, setError, intervalMs }: {
  entry: { roomId: string; joined: { call: { id: string }; participant: { id: string } } } | null;
  subscribe: (tracks: RealtimeMediaTrack[], scope: RealtimeRoomScope) => Promise<void>;
  setDetails: Dispatch<SetStateAction<Record<string, RealtimeRoomDetail>>>;
  setError: Dispatch<SetStateAction<string | null>>;
  intervalMs: number;
}) {
  useEffect(() => {
    if (!entry) return;
    const scope = { roomId: entry.roomId, callId: entry.joined.call.id, participantId: entry.joined.participant.id };
    return startRealtimeRoomPolling({
      scope,
      fetchDetail: (roomId) => window.plexus.realtimeRoomDetail(roomId),
      onDetail: (detail) => {
        setDetails((current) => ({ ...current, [scope.roomId]: detail }));
        setError(null);
      },
      onTracks: subscribe,
      onError: setError,
      intervalMs,
    });
  }, [entry, subscribe, setDetails, setError, intervalMs]);
}
