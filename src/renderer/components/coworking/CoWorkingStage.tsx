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
import type {
  CoWorkingFocusedZone,
  CoWorkingIndependentDegradedStates,
  CoWorkingLiveScreenWallProof,
  CoWorkingMediaProviderHealth,
  CoWorkingMeetingMemoryPolicy,
  CoWorkingPresenceMap,
  CoWorkingPrivacyPermissionAudit,
  CoWorkingProofCloseoutLink,
  CoWorkingProjectMediaHonesty,
  CoWorkingRemoteTrackSubscriptionPlan,
  CoWorkingRoomCloseoutProofFixture,
  CoWorkingRecordingConsentShell,
  CoWorkingRoomAuditEventPlan,
  CoWorkingSfuLiveTransportAcceptance,
  CoWorkingTranscriptionBoundary,
  CoWorkingTwoParticipantSimulation,
} from '../../../shared/coworking';
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

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

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
        <img className="px-avatar-photo" src={defaultAvatarDataUri(presence.identityId)} alt="" aria-hidden="true" />
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
            key={presence.identityId}
            presence={presence}
            onActivate={onActivate}
          />
        ))}
      </div>
    </div>
  );
}

function TeamBench({
  presence,
  onActivate,
}: {
  presence: FloorPresence;
  onActivate?: (presence: FloorPresence) => void;
}) {
  const clickable = Boolean(presence.roomId && onActivate);
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
      onClick={() => { if (clickable) onActivate?.(presence); }}
      disabled={!clickable}
      aria-label={`${presence.displayName} - ${stateLabel}${presence.roomName ? ` in ${presence.roomName}` : ''}`}
    >
      <span className="px-bench-monogram">
        <span>{presence.initials}</span>
        <img className="px-bench-photo" src={defaultAvatarDataUri(presence.identityId)} alt="" aria-hidden="true" />
      </span>
      <span className="px-bench-copy">
        <span className="px-bench-name">{presence.displayName}</span>
        <span className="px-bench-project">{presence.projectTag ?? presence.roomName ?? 'Unassigned'}</span>
      </span>
      <span className="px-bench-state">
        <span>{presence.isSpeaking ? 'SPEAKING' : stateLabel}</span>
        <span className="px-bench-signal" aria-hidden="true"><i /><i /><i /><i /></span>
      </span>
    </button>
  );
}

export function TeamBenchRail({
  floor,
  presenceMap,
  onActivate,
  cap = 6,
}: {
  floor: FloorPresence[];
  presenceMap: CoWorkingPresenceMap;
  onActivate?: (presence: FloorPresence) => void;
  cap?: number;
}) {
  const visible = floor.slice(0, cap);
  const hiddenCount = Math.max(0, floor.length - visible.length);
  return (
    <div className="px-studio-bench-list" aria-label="Team benches present now">
      {visible.map((presence) => (
        <TeamBench key={presence.identityId} presence={presence} onActivate={onActivate} />
      ))}
      {hiddenCount > 0 && (
        <div className="px-bench-overflow">{hiddenCount} more of {presenceMap.totalPresent} present</div>
      )}
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
                <small>focus only · {option.activeMemberCount} present · {countLabel(option.screenShareCount, 'screen')}</small>
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

export function IndependentDegradedStatesPanel({
  degradedStates,
}: {
  degradedStates: CoWorkingIndependentDegradedStates;
}) {
  return (
    <section className="px-independent-degraded" aria-label="Independent degraded states">
      <div className="px-independent-degraded-head">
        <span className="px-lbl">Independent degraded states</span>
        <StatusChip tone={degradedStates.activeIssueCount ? 'warning' : 'accent'}>
          {degradedStates.activeIssueCount ? `${degradedStates.activeIssueCount} isolated` : 'all clear'}
        </StatusChip>
      </div>
      <div className="px-independent-degraded-grid">
        {degradedStates.signals.map((signal) => (
          <article key={signal.kind} className={`px-degraded-signal ${signal.level}`}>
            <strong>{signal.label}</strong>
            <span>{signal.message}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecordingConsentShell({
  consent,
}: {
  consent: CoWorkingRecordingConsentShell;
}) {
  if (!consent.visible) return null;
  return (
    <section className="px-recording-consent-shell" aria-label="Recording consent shell">
      <div className="px-recording-consent-copy">
        <span className="px-lbl">{consent.title}</span>
        <strong>Focused project zone only</strong>
        <p>{consent.body}</p>
        <small>{consent.disabledReason}</small>
      </div>
      <div className="px-recording-consent-side">
        <div className="px-recording-consent-chips">
          {consent.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
        <Button variant="ghost" disabled title={consent.disabledReason}>
          Recording requires project consent
        </Button>
      </div>
    </section>
  );
}

function ProofCloseoutLink({
  proofCloseout,
  roomCloseoutProofFixture,
  auditPlan,
  meetingMemory,
  transcriptionBoundary,
  twoParticipantSimulation,
  privacyPermissionAudit,
  activeJoin,
  pending,
  onCloseout,
}: {
  proofCloseout: CoWorkingProofCloseoutLink;
  roomCloseoutProofFixture: CoWorkingRoomCloseoutProofFixture;
  auditPlan: CoWorkingRoomAuditEventPlan;
  meetingMemory: CoWorkingMeetingMemoryPolicy;
  transcriptionBoundary: CoWorkingTranscriptionBoundary;
  twoParticipantSimulation: CoWorkingTwoParticipantSimulation;
  privacyPermissionAudit: CoWorkingPrivacyPermissionAudit;
  activeJoin?: CoWorkingActiveJoin;
  pending: boolean;
  onCloseout: (entry: CoWorkingActiveJoin) => void;
}) {
  if (!proofCloseout.visible) return null;
  const blockedPermissions = privacyPermissionAudit.blockedCount > 0;
  const handleCloseout = () => {
    if (activeJoin) onCloseout(activeJoin);
  };

  return (
    <section className="px-proof-closeout-link" aria-label="Create co-working proof closeout draft">
      <div className="px-proof-closeout-head">
        <div>
          <span className="px-lbl">{proofCloseout.title}</span>
          <strong>{proofCloseout.targetLabel}</strong>
          <p>{proofCloseout.body}</p>
        </div>
        <Button
          variant={proofCloseout.enabled ? 'accent' : 'ghost'}
          disabled={!proofCloseout.enabled || pending || !activeJoin}
          title={proofCloseout.enabled ? proofCloseout.body : proofCloseout.disabledReason}
          onClick={handleCloseout}
        >
          <IconPaperclip s={12} /> Proof closeout
        </Button>
      </div>
      {!proofCloseout.enabled && (
        <small className="px-proof-closeout-disabled">{proofCloseout.disabledReason}</small>
      )}
      <div className="px-proof-closeout-grid">
        <article>
          <span className="px-lbl">Meeting memory</span>
          <p>{meetingMemory.body}</p>
          <small>{countLabel(meetingMemory.participantCount, 'participant')} · {countLabel(meetingMemory.screenShareCount, 'screen')}</small>
        </article>
        <article>
          <span className="px-lbl">Room audit</span>
          <p>{auditPlan.copy}</p>
          <small>{auditPlan.destination} · append-only</small>
        </article>
        <article>
          <span className="px-lbl">Transcription</span>
          <p>{transcriptionBoundary.body}</p>
          <small>transcriptRef null · recordingRef null</small>
        </article>
        <article>
          <span className="px-lbl">Local simulation</span>
          <p>{twoParticipantSimulation.copy}</p>
          <small>{twoParticipantSimulation.participantNames.join(' + ') || 'no visible participants'}</small>
        </article>
        <article>
          <span className="px-lbl">Permission audit</span>
          <p>{privacyPermissionAudit.copy}</p>
          <small>{blockedPermissions ? `${privacyPermissionAudit.blockedCount} blocked` : 'no blocked permissions'} · leave/closeout stay available</small>
        </article>
        <article>
          <span className="px-lbl">Evidence draft</span>
          <p>{roomCloseoutProofFixture.copy}</p>
          <small>{roomCloseoutProofFixture.reportEvidenceStatus} · transcriptRef null · recordingRef null</small>
        </article>
      </div>
      <div className="px-proof-closeout-chips">
        {[...proofCloseout.chips, ...meetingMemory.chips.slice(3), ...transcriptionBoundary.chips.slice(0, 1), 'draft evidence'].map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>
    </section>
  );
}

export function FocusedRoomStage({
  zone,
  wall,
  roomDetailError,
  mediaHonesty,
  mediaProviderHealth,
  remoteTrackPlan,
  recordingConsent,
  sfuAcceptance,
  proofCloseout,
  liveScreenWallProof,
  roomCloseoutProofFixture,
  auditPlan,
  meetingMemory,
  transcriptionBoundary,
  twoParticipantSimulation,
  privacyPermissionAudit,
  fullscreen,
  activeJoin,
  pending,
  onDropIn,
  onLeave,
  onCloseout,
  onPin,
  onToggleFullscreen,
}: {
  zone: CoWorkingFocusedZone;
  wall: CoWorkingScreenWall;
  roomDetailError: string | null;
  mediaHonesty: CoWorkingProjectMediaHonesty;
  mediaProviderHealth: CoWorkingMediaProviderHealth;
  remoteTrackPlan: CoWorkingRemoteTrackSubscriptionPlan;
  recordingConsent: CoWorkingRecordingConsentShell;
  sfuAcceptance: CoWorkingSfuLiveTransportAcceptance;
  proofCloseout: CoWorkingProofCloseoutLink;
  liveScreenWallProof: CoWorkingLiveScreenWallProof;
  roomCloseoutProofFixture: CoWorkingRoomCloseoutProofFixture;
  auditPlan: CoWorkingRoomAuditEventPlan;
  meetingMemory: CoWorkingMeetingMemoryPolicy;
  transcriptionBoundary: CoWorkingTranscriptionBoundary;
  twoParticipantSimulation: CoWorkingTwoParticipantSimulation;
  privacyPermissionAudit: CoWorkingPrivacyPermissionAudit;
  fullscreen: boolean;
  activeJoin?: CoWorkingActiveJoin;
  pending: boolean;
  onDropIn: (room: RealtimeRoom) => void;
  onLeave: (room: RealtimeRoom) => void;
  onCloseout: (entry: CoWorkingActiveJoin) => void;
  onPin: (trackId: string | null) => void;
  onToggleFullscreen: () => void;
}) {
  const room = zone.room;
  const selectionCopy = zone.selectionIntent === 'focus_only' ? 'focus-only selection' : 'presence joined';
  return (
    <section
      className={`px-room-stage px-meet-stage${fullscreen ? ' fullscreen px-stage-fullscreen-shell' : ''}`}
      aria-label="Meet-like focused project stage - My bench"
    >
      <header className="px-room-stage-head">
        <div>
          <span className="px-lbl">My bench</span>
          <h3>{zone.projectName || 'Select a project room'}</h3>
          <p>{selectionCopy} · {countLabel(zone.presenceSummary.memberCount, 'person', 'people')} · {countLabel(zone.presenceSummary.screenShareCount, 'screen')}</p>
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
          <div className="px-screen-wall-head" aria-label="Screen wall">
            <span className="px-lbl">Current focus</span>
            <StatusChip tone={wall.tiles.length ? 'accent' : 'idle'}>{wall.mode}</StatusChip>
          </div>
          <ScreenWall wall={wall} onPin={onPin} />
          <ProjectMediaControls
            honesty={mediaHonesty}
            mediaProviderHealth={mediaProviderHealth}
            remoteTrackPlan={remoteTrackPlan}
            sfuAcceptance={sfuAcceptance}
          />
          <details className="px-stage-evidence-drawer">
            <summary>Stage evidence and closeout</summary>
            <div className="px-live-wall-proof" aria-label="Live screen wall proof">
              <span className="px-lbl">Live wall proof</span>
              <p>{liveScreenWallProof.copy}</p>
              <small>{liveScreenWallProof.chips.join(' · ')}</small>
            </div>
            <RecordingConsentShell consent={recordingConsent} />
            <ProofCloseoutLink
              proofCloseout={proofCloseout}
              roomCloseoutProofFixture={roomCloseoutProofFixture}
              auditPlan={auditPlan}
              meetingMemory={meetingMemory}
              transcriptionBoundary={transcriptionBoundary}
              twoParticipantSimulation={twoParticipantSimulation}
              privacyPermissionAudit={privacyPermissionAudit}
              activeJoin={activeJoin}
              pending={pending}
              onCloseout={onCloseout}
            />
          </details>
        </div>

        <aside className="px-room-member-strip" aria-label="People in focused room">
          <span className="px-lbl">People</span>
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
