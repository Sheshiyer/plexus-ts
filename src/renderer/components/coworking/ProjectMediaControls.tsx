import { Button } from '../ui';
import { IconCamera, IconMic, IconScreen } from '../Icons';

/**
 * Project-room media controls (mic / camera / screen).
 *
 * Publishing is wired through the shared RealtimeSession (same path the
 * Ambient Lounge uses). `transportReady` reflects the live join response's
 * `cloudflare.configured` flag — until the workspace Worker has SFU
 * credentials the buttons stay disabled with an honest hint, and activate
 * automatically once the join reports a configured realtime provider.
 */
export function ProjectMediaControls({
  activeProjectJoin,
  transportReady,
  micActive,
  cameraActive,
  screenActive,
  busy,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
}: {
  activeProjectJoin: boolean;
  transportReady: boolean;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
  busy: string | null;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
}) {
  const mediaDisabled = !activeProjectJoin || !transportReady;
  const hint = !activeProjectJoin
    ? 'Drop in to enable project media.'
    : !transportReady
      ? 'Realtime media transport is not configured for this workspace yet.'
      : 'Project media ready.';

  return (
    <div className="px-project-media-controls" aria-label="Project media controls">
      <span className="px-lbl">Project media</span>
      <div className="px-project-media-buttons">
        <Button
          variant="ghost"
          disabled={mediaDisabled || busy === 'mic'}
          title={hint}
          aria-label="Project mic"
          aria-pressed={micActive}
          className={micActive ? 'on' : undefined}
          onClick={onToggleMic}
        >
          <IconMic s={13} /> Mic
        </Button>
        <Button
          variant="ghost"
          disabled={mediaDisabled || busy === 'camera'}
          title={hint}
          aria-label="Project camera"
          aria-pressed={cameraActive}
          className={cameraActive ? 'on' : undefined}
          onClick={onToggleCamera}
        >
          <IconCamera s={13} /> Camera
        </Button>
        <Button
          variant="ghost"
          disabled={mediaDisabled || busy === 'screen'}
          title={hint}
          aria-label="Project screen"
          aria-pressed={screenActive}
          className={screenActive ? 'on' : undefined}
          onClick={onToggleScreen}
        >
          <IconScreen s={13} /> Screen
        </Button>
      </div>
      <p className="px-project-media-hint">{hint}</p>
    </div>
  );
}

export default ProjectMediaControls;
