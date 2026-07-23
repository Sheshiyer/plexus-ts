import React from 'react';
import { Skeleton } from '../ui';
import { defaultAvatarDataUri } from '../../lib/defaultAvatar';
import { DegradedStatePanel, StatusChip } from '../PlexusUI';
import type { FloorPresence } from '../../../shared/types';

/* ============================================================
 * §02 · Team benches (ambient presence rail)
 * ------------------------------------------------------------
 * Extracted verbatim from CoWorkingPanel.tsx (Task 6 of the
 * co-working redesign): the `<aside className="px-studio-bench-rail">`
 * block + the TeamBench presence cell it renders.
 * ============================================================ */

// Worker-unreachable errors read "Not connected — sign in with Cloudflare
// Access first." Treat any error carrying those phrases as a connection-state
// error so the floor can collapse to a single offline chip instead of three
// redundant per-section panels.
export function isConnectionError(message: string | null): boolean {
  if (!message) return false;
  return /not connected|cloudflare access|sign in/i.test(message);
}

function TeamBench({
  presence,
  onActivate,
}: {
  presence: FloorPresence;
  onActivate?: (presence: FloorPresence) => void;
}) {
  const clickable = Boolean(presence.roomId && onActivate);
  const handleClick = () => {
    if (clickable) onActivate?.(presence);
  };
  const stateLabel = presence.ringState === 'timing'
    ? 'FOCUSED'
    : presence.ringState === 'online'
      ? 'AVAILABLE'
      : presence.ringState === 'lounge'
        ? 'IN LOUNGE'
        : 'AWAY';
  return (
    <button
      type="button"
      className={`px-bench-tile ${presence.ringState}${clickable ? '' : ' static'}`}
      onClick={handleClick}
      disabled={!clickable}
      aria-label={`${presence.displayName} — ${presence.ringState}${presence.roomName ? ` in ${presence.roomName}` : ''}`}
    >
      <span className="px-bench-monogram">
        <span>{presence.initials}</span>
        <img className="px-bench-photo" src={defaultAvatarDataUri(presence.participantId)} alt="" aria-hidden="true" />
      </span>
      <span className="px-bench-copy">
        <span className="px-bench-name">{presence.displayName}</span>
        <span className="px-bench-project">{presence.projectTag ?? presence.roomName ?? 'Unassigned'}</span>
      </span>
      <span className="px-bench-state">
        <span>{presence.isSpeaking ? 'SPEAKING' : stateLabel}</span>
        <span className="px-bench-signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      </span>
    </button>
  );
}

export default function TeamBenchRail({
  floor,
  floorError,
  floorLoading,
  floorOffline,
  onlineCount,
  floorSubtitle,
  onActivate,
}: {
  floor: FloorPresence[];
  floorError: string | null;
  floorLoading: boolean;
  floorOffline: boolean;
  onlineCount: number;
  floorSubtitle: string;
  onActivate?: (presence: FloorPresence) => void;
}) {
  const visibleBenchMembers = floor.slice(0, 6);
  const hiddenBenchCount = Math.max(0, floor.length - visibleBenchMembers.length);

  return (
    <aside className="px-studio-bench-rail" aria-label="Team benches">
      <header className="px-studio-workbench-head">
        <div>
          <span className="px-lbl">Team benches</span>
          <h2>Present now</h2>
          <p>{floorSubtitle}</p>
        </div>
        <StatusChip tone={onlineCount ? 'accent' : 'idle'}>{onlineCount} live</StatusChip>
      </header>

      {floorError && !isConnectionError(floorError) && (
        <DegradedStatePanel title="Floor offline" message={floorError} tone="error" />
      )}

      {floorLoading && !floor.length && !floorError && (
        <Skeleton lines={3} widths={['80%', '65%', '90%']} />
      )}

      {(floorOffline || (!floorLoading && !floor.length && !floorError)) && (
        <div className="px-bench-placeholder">
          {[0, 1, 2].map((i) => <div key={i} className="px-bench-ghost" />)}
          <p>{floorOffline ? 'Team benches appear when the floor connects.' : 'No one is on the floor yet.'}</p>
        </div>
      )}

      {!floorOffline && visibleBenchMembers.length > 0 && (
        <div className="px-studio-bench-list">
          {visibleBenchMembers.map((presence) => (
            <TeamBench
              key={presence.participantId}
              presence={presence}
              onActivate={onActivate}
            />
          ))}
        </div>
      )}

      {!floorOffline && hiddenBenchCount > 0 && (
        <div className="px-coworking-info">{hiddenBenchCount} more present · use project focus to narrow context</div>
      )}
    </aside>
  );
}
