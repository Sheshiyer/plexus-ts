import { Button } from '../ui';
import { IconCamera, IconMic, IconScreen } from '../Icons';
import type {
  CoWorkingMediaProviderHealth,
  CoWorkingProjectMediaHonesty,
  CoWorkingRemoteTrackSubscriptionPlan,
  CoWorkingSfuLiveTransportAcceptance,
} from '../../../shared/coworking';

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
  honesty,
  mediaProviderHealth,
  remoteTrackPlan,
  sfuAcceptance,
}: {
  honesty: CoWorkingProjectMediaHonesty;
  mediaProviderHealth: CoWorkingMediaProviderHealth;
  remoteTrackPlan: CoWorkingRemoteTrackSubscriptionPlan;
  sfuAcceptance: CoWorkingSfuLiveTransportAcceptance;
}) {
  const mediaDisabled = honesty.gated;
  const hint = honesty.primaryCopy;

  return (
    <div className="px-project-media-controls" aria-label="Project media controls">
      <div className="px-project-media-head">
        <span className="px-lbl">Project media</span>
        <span className={`px-media-transport-pill ${honesty.transportState}`}>
          transport {honesty.transportState}
        </span>
      </div>
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
      <p className="px-project-media-hint">{honesty.gateCopy}</p>
      <div className="px-project-media-signals" aria-label="Project media honesty signals">
        {honesty.signals.map((signal) => (
          <span key={signal}>{signal}</span>
        ))}
      </div>
      <div className="px-sfu-acceptance" aria-label="SFU live transport acceptance">
        <span className="px-lbl">True live SFU proof</span>
        <p>{sfuAcceptance.acceptanceCopy}</p>
        <small>{sfuAcceptance.fallbackBoundary}</small>
      </div>
      <div className="px-media-provider-health" aria-label="Media provider health state">
        <span className="px-lbl">Provider health</span>
        <p>{mediaProviderHealth.copy}</p>
        <small>{mediaProviderHealth.proofBoundary}</small>
        <div className="px-project-media-signals">
          {mediaProviderHealth.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>
      <div className="px-remote-track-plan" aria-label="Remote track subscription plan">
        <span className="px-lbl">Remote track plan</span>
        <p>{remoteTrackPlan.copy}</p>
        <small>{remoteTrackPlan.proofBoundary}</small>
        <div className="px-project-media-signals">
          {remoteTrackPlan.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProjectMediaControls;
