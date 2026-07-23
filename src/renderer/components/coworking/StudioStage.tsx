import React from 'react';
import { Button } from '../ui';
import { IconScreen, IconUsers } from '../Icons';
import { defaultAvatarDataUri } from '../../lib/defaultAvatar';
import { DegradedStatePanel, StatusChip } from '../PlexusUI';
import type { RealtimeRoom } from '../../../shared/types';
import type { deriveFocusedZone, CoWorkingScreenWall } from '../../lib/coworkingModel';
import type { ActiveJoin } from '../../lib/useRealtimeMedia';

/* ============================================================
 * §01 · Focused room and media shell
 * ------------------------------------------------------------
 * Extracted verbatim from CoWorkingPanel.tsx (Task 6 of the
 * co-working redesign): the FocusedRoomStage + ScreenWall pair,
 * exported as StudioStage.
 * ============================================================ */

function ScreenWall({
  wall,
  onPin,
}: {
  wall: CoWorkingScreenWall;
  onPin: (trackId: string | null) => void;
}) {
  if (!wall.tiles.length) {
    return (
      <div className="px-screen-wall-empty">
        <IconScreen s={30} />
        <strong>No screen shares in this project room</strong>
        <span>When someone shares, this stage becomes the room wall. Native screen picking stays unchanged.</span>
      </div>
    );
  }

  return (
    <div className={`px-screen-wall-grid ${wall.mode}`}>
      {wall.tiles.map((tile) => (
        <button
          key={tile.trackId}
          type="button"
          className={`px-screen-wall-tile${tile.pinned ? ' pinned' : ''}`}
          onClick={() => onPin(tile.pinned ? null : tile.trackId)}
          aria-pressed={tile.pinned}
        >
          <span className="px-screen-wall-preview">
            <IconScreen s={34} />
          </span>
          <span className="px-screen-wall-meta">
            <strong>{tile.label}</strong>
            <small>{tile.pinned ? 'Pinned screen' : 'Click to pin'}</small>
          </span>
        </button>
      ))}
    </div>
  );
}

export default function StudioStage({
  zone,
  wall,
  roomDetailError,
  fullscreen,
  activeJoin,
  pending,
  onDropIn,
  onPin,
  onToggleFullscreen,
}: {
  zone: ReturnType<typeof deriveFocusedZone>;
  wall: CoWorkingScreenWall;
  roomDetailError: string | null;
  fullscreen: boolean;
  activeJoin?: ActiveJoin;
  pending: boolean;
  onDropIn: (room: RealtimeRoom) => void;
  onPin: (trackId: string | null) => void;
  onToggleFullscreen: () => void;
}) {
  const room = zone.room;
  return (
    <section className={`px-room-stage${fullscreen ? ' fullscreen' : ''}`} aria-label="Project stage · My bench">
      <header className="px-room-stage-head">
        <div>
          <span className="px-lbl">My bench</span>
          <h3>{zone.projectName || 'Select a project room'}</h3>
          <p>
            {zone.joinState === 'presence_only' ? 'presence-only room' : 'not joined'} · {zone.members.length} people · {wall.tiles.length} screens
            {!activeJoin && ' · drop in — presence-only until you enable media'}
          </p>
        </div>
        <div className="px-room-stage-actions">
          <Button variant="ghost" onClick={onToggleFullscreen} disabled={!room}>
            <IconScreen s={13} /> {fullscreen ? 'Exit stage' : 'Fullscreen'}
          </Button>
          {room && !activeJoin && (
            <Button variant="accent" onClick={() => onDropIn(room)} disabled={pending}>
              <IconUsers s={12} /> {pending ? 'Joining' : 'Join'}
            </Button>
          )}
          {room && activeJoin && (
            <span className="px-stage-joined-chip"><span className="px-dot pulse" /> Joined · controls in the dock below</span>
          )}
        </div>
      </header>

      {roomDetailError && <DegradedStatePanel title="Room detail unavailable" message={roomDetailError} tone="warning" />}

      <div className="px-room-stage-body">
        <div className="px-screen-wall">
          <div className="px-screen-wall-head" aria-label="Screen wall">
            <span className="px-lbl">Current focus</span>
            <StatusChip tone={wall.tiles.length ? 'accent' : 'idle'}>{wall.mode}</StatusChip>
          </div>
          <ScreenWall wall={wall} onPin={onPin} />
        </div>

        <aside className="px-room-member-strip" aria-label="People in focused room">
          <span className="px-lbl">People</span>
          {zone.members.length ? (
            zone.members.map((member) => (
              <div key={member.participantId} className="px-room-member-pill">
                <span className="px-mini-avatar">
                  <span className="px-mini-initials">{member.initials}</span>
                  <img className="px-avatar-photo" src={defaultAvatarDataUri(member.participantId)} alt="" aria-hidden="true" />
                </span>
                <span>
                  <strong>{member.displayName}</strong>
                  <small>{member.isSpeaking ? 'speaking' : member.ringState}</small>
                </span>
              </div>
            ))
          ) : (
            <div className="px-room-member-empty">No one is present in this room yet.</div>
          )}
        </aside>
      </div>
    </section>
  );
}
