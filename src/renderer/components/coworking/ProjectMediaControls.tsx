import { Button } from '../ui';
import { IconCamera, IconMic, IconScreen } from '../Icons';

/**
 * Presentational project-room media controls (mic / camera / screen).
 *
 * This is intentionally a UI shell: project-room media *transport* is a later
 * phase (it needs a project-scoped RealtimeSession plus configured SFU
 * credentials). Until `transportReady` is true the controls render disabled
 * with an honest hint, so the affordance is visible without pretending to
 * publish. Leave / fullscreen / closeout live on the stage header and stay
 * functional; this component owns only the deferred media buttons.
 */
export function ProjectMediaControls({
  activeProjectJoin,
  transportReady,
}: {
  activeProjectJoin: boolean;
  transportReady: boolean;
}) {
  const mediaDisabled = !activeProjectJoin || !transportReady;
  const hint = !activeProjectJoin
    ? 'Drop in to enable project media.'
    : !transportReady
      ? 'Project mic, camera & screen ship with realtime media transport.'
      : 'Project media ready.';

  return (
    <div className="px-project-media-controls" aria-label="Project media controls">
      <span className="px-lbl">Project media</span>
      <div className="px-project-media-buttons">
        <Button variant="ghost" disabled={mediaDisabled} title={hint} aria-label="Project mic">
          <IconMic s={13} /> Mic
        </Button>
        <Button variant="ghost" disabled={mediaDisabled} title={hint} aria-label="Project camera">
          <IconCamera s={13} /> Camera
        </Button>
        <Button variant="ghost" disabled={mediaDisabled} title={hint} aria-label="Project screen">
          <IconScreen s={13} /> Screen
        </Button>
      </div>
      <p className="px-project-media-hint">{hint}</p>
    </div>
  );
}

export default ProjectMediaControls;
