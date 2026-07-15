import React from 'react';
import type { FloorPresence, TimerState } from '../../../shared/types';
import { fmtHMS } from '../ui';
import {
  IconCamera,
  IconChevronRight,
  IconClose,
  IconKeyboard,
  IconMic,
  IconScreen,
} from '../Icons';
import { MiniAvatarCluster } from './CoWorkingStage';

export interface CoWorkingCompanionProps {
  title: string;
  context: string;
  participants: FloorPresence[];
  participantCount: number;
  timerState: TimerState;
  joined: boolean;
  mediaEnabled: boolean;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
  captionsOn: boolean;
  busy: boolean;
  error?: string | null;
  onToggleMic(): void;
  onToggleCamera(): void;
  onToggleScreen(): void;
  onToggleCaptions(): void;
  onLeave(): void;
  onExpand(): void;
}

function controlClass(active: boolean, danger = false): string {
  return `px-companion-control${active ? ' on' : ''}${danger ? ' danger' : ''}`;
}

export function CoWorkingCompanion({
  title,
  context,
  participants,
  participantCount,
  timerState,
  joined,
  mediaEnabled,
  micActive,
  cameraActive,
  screenActive,
  captionsOn,
  busy,
  error,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  onToggleCaptions,
  onLeave,
  onExpand,
}: CoWorkingCompanionProps) {
  const elapsed = timerState.activeSeconds ?? 0;
  const timerLabel = timerState.running
    ? `${timerState.paused ? 'Paused' : 'Tracking'} ${fmtHMS(elapsed)}`
    : 'Timer standby';

  return (
    <section className="px-coworking-companion" data-window-mode="compact" aria-label="Co-working compact controls">
      <header className="px-companion-titlebar">
        <div className="px-companion-titlecopy">
          <span className={`px-dot${joined ? ' pulse' : ' idle'}`} aria-hidden="true" />
          <strong title={title}>{title}</strong>
          {screenActive && <span className="px-companion-sharing">SHARING</span>}
        </div>
        <button type="button" className="px-companion-expand" onClick={onExpand} aria-label="Exit compact mode" title="Return Plexus to the full window">
          <IconChevronRight s={15} /> <span>EXPAND</span>
        </button>
      </header>

      <div className="px-companion-summary">
        <MiniAvatarCluster members={participants} cap={5} />
        <div className="px-companion-context">
          <span>{context}</span>
          <strong aria-label={`${participantCount} ${participantCount === 1 ? 'participant' : 'participants'}`}>
            {participantCount} {participantCount === 1 ? 'person' : 'people'} · {timerLabel}
          </strong>
        </div>
      </div>

      {error && <div className="px-companion-alert" role="alert">{error}</div>}

      <div className="px-companion-controls" aria-label="Live co-working controls">
        <button
          type="button"
          className={controlClass(micActive)}
          onClick={onToggleMic}
          disabled={!mediaEnabled || busy}
          aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={micActive}
          title={mediaEnabled ? 'Toggle microphone' : 'Join the lounge to use microphone controls'}
        >
          <IconMic s={17} />
        </button>
        <button
          type="button"
          className={controlClass(cameraActive)}
          onClick={onToggleCamera}
          disabled={!mediaEnabled || busy}
          aria-label={cameraActive ? 'Disable camera' : 'Enable camera'}
          aria-pressed={cameraActive}
          title={mediaEnabled ? 'Toggle camera' : 'Join the lounge to use camera controls'}
        >
          <IconCamera s={17} />
        </button>
        <button
          type="button"
          className={controlClass(screenActive, screenActive)}
          onClick={onToggleScreen}
          disabled={!mediaEnabled || busy}
          aria-label={screenActive ? 'Stop screen sharing' : 'Share screen'}
          aria-pressed={screenActive}
          title={mediaEnabled ? (screenActive ? 'Stop sharing immediately' : 'Open the native screen picker') : 'Join the lounge to share'}
        >
          <IconScreen s={17} />
          {screenActive && <span>STOP</span>}
        </button>
        <button
          type="button"
          className={controlClass(captionsOn)}
          onClick={onToggleCaptions}
          disabled={!joined || busy}
          aria-label={captionsOn ? 'Hide captions' : 'Show captions'}
          aria-pressed={captionsOn}
          title="Captions preview only; no transcription is saved"
        >
          <IconKeyboard s={17} />
        </button>
        <button
          type="button"
          className={controlClass(false, true)}
          onClick={onLeave}
          disabled={!joined || busy}
          aria-label="Leave co-working room"
          title="Leave the current co-working room"
        >
          <IconClose s={17} /> <span>LEAVE</span>
        </button>
      </div>

      <p className="px-companion-capture-note">Visible in whole-display sharing · use window sharing or another display for private controls.</p>
    </section>
  );
}
