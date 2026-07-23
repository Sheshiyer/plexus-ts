import React, { useEffect, useState } from 'react';
import { Button } from '../ui';
import { IconCamera, IconClose, IconMic, IconPaperclip, IconScreen, IconSettings } from '../Icons';
import type { DockState } from '../../lib/dock-model';

const TRANSPORT_HINT = 'Realtime media transport is not configured for this workspace yet.';

function useElapsed(sinceIso: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  if (!sinceIso) return '';
  const total = Math.max(0, Math.floor((now - new Date(sinceIso).getTime()) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * The one place that answers "am I live, and where are my controls?" —
 * identical for lounge and project-room joins. Renders only while a join
 * owns the shared RealtimeSession.
 */
export default function MediaDock({
  dock, micActive, cameraActive, screenActive, participants, deviceControls,
  onToggleMic, onToggleCamera, onToggleScreen, onCloseout, onLeave, leaving, message,
}: {
  dock: DockState;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
  participants: { id: string; initials: string }[];
  deviceControls: React.ReactNode;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onCloseout: () => void;
  onLeave: () => void;
  leaving: boolean;
  message: string | null;
}) {
  const [devicesOpen, setDevicesOpen] = useState(false);
  const elapsed = useElapsed(dock.joinedAt);
  if (!dock.visible) return null;
  const mediaHint = !dock.transportReady ? TRANSPORT_HINT : undefined;
  return (
    <div className="px-media-dock" role="region" aria-label="Live session controls">
      <div className="px-dock-context">
        <span className="px-dock-live" aria-hidden="true" />
        <strong>{dock.contextLabel}</strong>
        <span className="px-dock-elapsed">{elapsed}</span>
      </div>

      <div className="px-dock-controls">
        <button
          type="button"
          className={`px-dock-ctl${micActive ? ' on' : ''}`}
          onClick={onToggleMic}
          disabled={!dock.transportReady || dock.micDisabled}
          title={mediaHint ?? (micActive ? 'Mute microphone' : 'Unmute microphone')}
          aria-pressed={micActive}
          aria-label="Microphone"
        >
          <IconMic s={15} />
        </button>
        <button
          type="button"
          className={`px-dock-ctl${cameraActive ? ' on' : ''}`}
          onClick={onToggleCamera}
          disabled={!dock.transportReady || dock.cameraDisabled}
          title={mediaHint ?? (cameraActive ? 'Turn camera off' : 'Turn camera on')}
          aria-pressed={cameraActive}
          aria-label="Camera"
        >
          <IconCamera s={15} />
        </button>
        <button
          type="button"
          className={`px-dock-ctl${screenActive ? ' on' : ''}`}
          onClick={onToggleScreen}
          disabled={!dock.transportReady || dock.screenDisabled}
          title={mediaHint ?? (screenActive ? 'Stop sharing screen' : 'Share screen')}
          aria-pressed={screenActive}
          aria-label="Screen share"
        >
          <IconScreen s={15} />
        </button>
        <div className="px-dock-devices">
          <button
            type="button"
            className="px-dock-ctl"
            onClick={() => setDevicesOpen((v) => !v)}
            aria-expanded={devicesOpen}
            aria-label="Device settings"
            title="Microphone, speaker & camera devices"
          >
            <IconSettings s={15} />
          </button>
          {devicesOpen && <div className="px-dock-devices-pop">{deviceControls}</div>}
        </div>
      </div>

      <div className="px-dock-right">
        {message && <span className="px-dock-msg">{message}</span>}
        <div className="px-dock-people" aria-label={`${dock.participantCount} participants`}>
          {participants.slice(0, 4).map((person) => (
            <span key={person.id} className="px-mini-avatar"><span className="px-mini-initials">{person.initials}</span></span>
          ))}
          {dock.participantCount > 4 && <span className="px-dock-more">+{dock.participantCount - 4}</span>}
        </div>
        <Button variant="ghost" onClick={onCloseout}><IconPaperclip s={12} /> Closeout</Button>
        <Button variant="stop" onClick={onLeave} disabled={leaving}>
          <IconClose s={12} /> {leaving ? 'Leaving' : 'Leave'}
        </Button>
      </div>
    </div>
  );
}
