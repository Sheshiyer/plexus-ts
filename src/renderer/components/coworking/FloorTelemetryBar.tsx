import React from 'react';
import { Button } from '../ui';
import { IconClose, IconMic } from '../Icons';
import type { CoWorkingRingState, RealtimeRoom } from '../../../shared/types';
import type { CoWorkingBusyKey } from '../../lib/useRealtimeMedia';

/* ============================================================
 * Coworking telemetry bar
 * ------------------------------------------------------------
 * Extracted verbatim from CoWorkingPanel.tsx (Task 6 of the
 * co-working redesign): the online/focused/lounge counts, floor
 * state, private-rhythm indicator, offline chip, and the
 * join/leave lounge button.
 * ============================================================ */

export default function FloorTelemetryBar({
  onlineCount,
  floorCounts,
  floorState,
  rhythmLabel,
  floorOffline,
  onOpenSettings,
  inLounge,
  busy,
  loungeRoom,
  leaveLounge,
  joinLounge,
}: {
  onlineCount: number;
  floorCounts: Record<CoWorkingRingState, number>;
  floorState: string;
  rhythmLabel: string;
  floorOffline: boolean;
  onOpenSettings?: () => void;
  inLounge: boolean;
  busy: CoWorkingBusyKey;
  loungeRoom: RealtimeRoom | null;
  leaveLounge: () => void;
  joinLounge: () => void;
}) {
  return (
    <section className="px-coworking-telemetry" aria-label="Coworking telemetry">
      <div className="px-studio-telemetry-cell">
        <strong className="px-studio-telemetry-main">{onlineCount}</strong>
        <span className="px-studio-telemetry-sub">ONLINE</span>
      </div>
      <div className="px-studio-telemetry-cell">
        <strong className="px-studio-telemetry-main">{floorCounts.timing}</strong>
        <span className="px-studio-telemetry-sub">FOCUSED</span>
      </div>
      <div className="px-studio-telemetry-cell">
        <strong className="px-studio-telemetry-main">{floorCounts.lounge}</strong>
        <span className="px-studio-telemetry-sub">IN LOUNGE</span>
      </div>
      <div className="px-studio-telemetry-cell">
        <strong className="px-studio-telemetry-main">FLOOR</strong>
        <span className="px-studio-telemetry-sub">{floorState}</span>
      </div>
      <div className="px-studio-telemetry-cell px-studio-telemetry-rhythm">
        <span>
          <strong className="px-studio-telemetry-main">{rhythmLabel}</strong>
          <span className="px-studio-telemetry-sub">LOCAL · PRIVATE</span>
        </span>
        <span className="px-studio-rhythm-trace" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </span>
      </div>
      {floorOffline && (
        <div className="px-studio-telemetry-cell">
          <button
            type="button"
            className="px-floor-offline-chip"
            onClick={onOpenSettings}
            title="Sign in with Cloudflare Access to bring the floor online"
          >
            ● OFFLINE — Sign in with Cloudflare Access
          </button>
        </div>
      )}
      <div className="px-studio-telemetry-cell">
        {inLounge ? (
          <Button variant="stop" onClick={leaveLounge} disabled={busy === 'lounge_leave'}>
            <IconClose s={14} /> {busy === 'lounge_leave' ? 'LEAVING' : 'LEAVE LOUNGE'}
          </Button>
        ) : (
          <Button variant="accent" onClick={joinLounge} disabled={!loungeRoom || busy === 'lounge_join'}>
            <IconMic s={14} /> {busy === 'lounge_join' ? 'JOINING' : 'JOIN LOUNGE'}
          </Button>
        )}
      </div>
    </section>
  );
}
