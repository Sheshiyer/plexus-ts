import type { CSSProperties } from 'react';
import { Button } from '../ui';
import {
  IconClose,
  IconPaperclip,
  IconScreen,
  IconUsers,
} from '../Icons';
import { DegradedStatePanel, StatusChip } from '../PlexusUI';
import { defaultAvatarDataUri } from '../../lib/defaultAvatar';
import type { CoWorkingFocusedZone, CoWorkingPresenceMap } from '../../../shared/coworking';
import type {
  FloorPresence,
  RealtimeJoinResponse,
  RealtimeRoom,
  RealtimeRoomType,
} from '../../../shared/types';
import type { CoWorkingProjectRoomOption, CoWorkingScreenWall } from '../../lib/coworkingModel';
import { ProjectMediaControls } from './ProjectMediaControls';

export type CoWorkingActiveJoinScope = 'lounge' | 'project_room';

export type CoWorkingActiveJoin = {
  scope: CoWorkingActiveJoinScope;
  roomId: string;
  roomName: string;
  roomType: RealtimeRoomType;
  joined: RealtimeJoinResponse;
  hasSession: boolean;
};

export type CoWorkingActiveJoinMap = Record<string, CoWorkingActiveJoin>;

export function MiniAvatarCluster({
  members,
  cap = 3,
}: {
  members: FloorPresence[];
  cap?: number;
}) {
  const visible = members.slice(0, cap);
  const overflow = Math.max(0, members.length - visible.length);
  if (!visible.length) {
    return <span className="px-mini-cluster empty" />;
  }
  return (
    <span className="px-mini-cluster" aria-hidden="true">
      {visible.map((member, idx) => (
        <span
          key={member.participantId}
          className={`px-mini-avatar ${member.ringState}`}
          style={{ zIndex: visible.length - idx } as CSSProperties}
        >
          <span className="px-mini-initials">{member.initials}</span>
          <img className="px-avatar-photo" src={defaultAvatarDataUri(member.participantId)} alt="" aria-hidden="true" />
        </span>
      ))}
      {overflow > 0 && <span className="px-mini-avatar overflow">+{overflow}</span>}
    </span>
  );
}

function AvatarTile({
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
  return (
    <button
      type="button"
      className={`px-avatar-tile ${presence.ringState}${clickable ? '' : ' static'}`}
      onClick={handleClick}
      disabled={!clickable}
      aria-label={`${presence.displayName} - ${presence.ringState}${presence.roomName ? ` in ${presence.roomName}` : ''}`}
    >
      <span className="px-avatar-circle">
        <span className="px-avatar-initials">{presence.initials}</span>
        <img className="px-avatar-photo" src={defaultAvatarDataUri(presence.participantId)} alt="" aria-hidden="true" />
        {presence.isSpeaking && <span className="px-avatar-mic" aria-hidden="true" />}
      </span>
      <span className="px-avatar-name">{presence.displayName}</span>
      <span className="px-avatar-tag px-lbl">{presence.projectTag ?? '-'}</span>
    </button>
  );
}

export function PresenceMap({
  floor,
  presenceMap,
  onActivate,
}: {
  floor: FloorPresence[];
  presenceMap: CoWorkingPresenceMap;
  onActivate?: (presence: FloorPresence) => void;
}) {
  return (
    <div className="px-presence-map" aria-label="Co-working presence map">
      <div className="px-presence-map-head">
        <span className="px-lbl">Presence map</span>
        <span>{presenceMap.totalPresent} present · focus-only project selection</span>
      </div>
      <div className="px-presence-map-zones" aria-label="Presence map zones">
        {presenceMap.zones.map((zone) => (
          <section key={zone.key} className={`px-presence-zone ${zone.key}`} aria-label={zone.label}>
            <div className="px-presence-zone-head">
              <strong>{zone.label}</strong>
              <span>{zone.participants.length}</span>
            </div>
            <div className="px-presence-zone-rooms">
              {zone.activeRoomIds.length ? `${zone.activeRoomIds.length} active rooms` : 'no active room'}
            </div>
          </section>
        ))}
      </div>
      <div className="px-floor-grid">
        {floor.map((presence) => (
          <AvatarTile
            key={presence.participantId}
            presence={presence}
            onActivate={onActivate}
          />
        ))}
      </div>
    </div>
  );
}

export function ProjectRoomRail({
  options,
  selectedRoomId,
  activeJoins,
  onSelect,
}: {
  options: CoWorkingProjectRoomOption[];
  selectedRoomId: string | null;
  activeJoins: CoWorkingActiveJoinMap;
  onSelect: (roomId: string) => void;
}) {
  return (
    <aside className="px-room-stage-rail" aria-label="Project room selector - focus only">
      <div className="px-room-stage-rail-head">
        <span className="px-lbl">Project rooms</span>
        <StatusChip tone={options.length ? 'accent' : 'idle'}>{options.length} rooms</StatusChip>
      </div>
      <div className="px-room-stage-list">
        {options.map((option) => {
          const selected = option.roomId === selectedRoomId;
          const joined = Boolean(activeJoins[option.roomId]);
          return (
            <button
              key={option.roomId}
              type="button"
              className={`px-room-stage-option${selected ? ' selected' : ''}${joined ? ' joined' : ''}`}
              onClick={() => onSelect(option.roomId)}
              aria-pressed={selected}
            >
              <span className="px-room-stage-option-main">
                <strong>{option.label}</strong>
                <small>focus only · {option.activeMemberCount} present · {option.screenShareCount} screens</small>
              </span>
              <span className={`px-room-state-badge ${joined ? 'active' : option.activeMemberCount ? 'quiet' : 'empty'}`}>
                {joined ? 'IN ROOM' : option.activeMemberCount ? 'LIVE' : 'EMPTY'}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

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
        <span>When someone shares, this Meet-like stage becomes the room wall. Native screen picking stays unchanged.</span>
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

export function FocusedRoomStage({
  zone,
  wall,
  roomDetailError,
  fullscreen,
  activeJoin,
  pending,
  onDropIn,
  onLeave,
  onCloseout,
  onPin,
  onToggleFullscreen,
  mediaTransportReady,
}: {
  zone: CoWorkingFocusedZone;
  wall: CoWorkingScreenWall;
  roomDetailError: string | null;
  fullscreen: boolean;
  activeJoin?: CoWorkingActiveJoin;
  pending: boolean;
  onDropIn: (room: RealtimeRoom) => void;
  onLeave: (room: RealtimeRoom) => void;
  onCloseout: (entry: CoWorkingActiveJoin) => void;
  onPin: (trackId: string | null) => void;
  onToggleFullscreen: () => void;
  mediaTransportReady: boolean;
}) {
  const room = zone.room;
  const selectionCopy = zone.selectionIntent === 'focus_only' ? 'focus-only selection' : 'presence joined';
  return (
    <section
      className={`px-room-stage px-meet-stage${fullscreen ? ' fullscreen px-stage-fullscreen-shell' : ''}`}
      aria-label="Meet-like focused project stage"
    >
      <header className="px-room-stage-head">
        <div>
          <span className="px-lbl">Project stage</span>
          <h3>{zone.projectName || 'Select a project room'}</h3>
          <p>{selectionCopy} · {zone.presenceSummary.memberCount} people · {zone.presenceSummary.screenShareCount} screens</p>
        </div>
        <div className="px-room-stage-actions">
          <Button variant="ghost" onClick={onToggleFullscreen} disabled={!room}>
            <IconScreen s={13} /> {fullscreen ? 'Exit stage' : 'Fullscreen'}
          </Button>
          {room && activeJoin && (
            <Button variant="ghost" onClick={() => onCloseout(activeJoin)} disabled={pending}>
              <IconPaperclip s={12} /> Closeout
            </Button>
          )}
          {room && (
            <Button
              variant={activeJoin ? 'stop' : 'accent'}
              onClick={() => (activeJoin ? onLeave(room) : onDropIn(room))}
              disabled={pending}
            >
              {activeJoin ? <IconClose s={12} /> : <IconUsers s={12} />}
              {activeJoin ? (pending ? 'Leaving' : 'Leave room') : (pending ? 'Joining' : 'Drop in')}
            </Button>
          )}
        </div>
      </header>

      <div className="px-stage-contract-row" aria-label="Focused stage contracts">
        <span>Meet-like focused project stage</span>
        <span>Focus-only project selection</span>
        <span>Fullscreen stage shell</span>
      </div>

      {roomDetailError && <DegradedStatePanel title="Room detail unavailable" message={roomDetailError} tone="warning" />}

      <div className="px-room-stage-body">
        <div className="px-screen-wall">
          <div className="px-screen-wall-head">
            <span className="px-lbl">Screen wall</span>
            <StatusChip tone={wall.tiles.length ? 'accent' : 'idle'}>{wall.mode}</StatusChip>
          </div>
          <ScreenWall wall={wall} onPin={onPin} />
          <ProjectMediaControls
            activeProjectJoin={Boolean(activeJoin)}
            transportReady={mediaTransportReady}
          />
        </div>

        <aside className="px-room-member-strip" aria-label="People in focused room">
          <span className="px-lbl">Stage participants</span>
          {zone.participants.length ? (
            zone.participants.map((member) => (
              <div key={member.participantId} className="px-room-member-pill">
                <span className={`px-mini-avatar ${member.ringState}`}>
                  <span className="px-mini-initials">{member.initials}</span>
                  <img className="px-avatar-photo" src={defaultAvatarDataUri(member.participantId)} alt="" aria-hidden="true" />
                </span>
                <span>
                  <strong>{member.displayName}</strong>
                  <small>{member.stageRole === 'speaker' ? 'speaking' : member.ringState}</small>
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
