import React, { useEffect, useRef, useState } from 'react';
import type { FloorPresence } from '../../../shared/types';
import type { RemoteStream } from '../../lib/RealtimeSession';
import {
  IconCamera,
  IconCheck,
  IconClose,
  IconKeyboard,
  IconMic,
  IconPaperclip,
  IconScreen,
  IconSpeaker,
  IconSync,
} from '../Icons';
import { DegradedStatePanel, StatusChip } from '../PlexusUI';
import { Select } from '../ui';
import { MiniAvatarCluster } from './CoWorkingStage';

export type DeviceChoice = {
  id: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
};

export const SYSTEM_DEVICE_ID = 'system-default';

type AudioSinkElement = HTMLAudioElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

const WAVEFORM_BARS = 24;

function LoungeWaveform({ active }: { active: boolean }) {
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: WAVEFORM_BARS }, () => 0.2));
  useEffect(() => {
    if (!active) {
      setBars(Array.from({ length: WAVEFORM_BARS }, () => 0.18));
      return;
    }
    const id = window.setInterval(() => {
      setBars((current) => current.map((_, index) => {
        const base = 0.22 + Math.random() * 0.7;
        return Math.min(1, index % 5 === 0 ? base * 0.5 : base);
      }));
    }, 220);
    return () => window.clearInterval(id);
  }, [active]);
  return (
    <svg className={`px-waveform${active ? ' live' : ''}`} viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
      {bars.map((amplitude, index) => {
        const width = 120 / WAVEFORM_BARS;
        const height = Math.max(2, amplitude * 28);
        return <rect key={index} x={index * width + 1} y={(32 - height) / 2} width={width - 2} height={height} rx={1} />;
      })}
    </svg>
  );
}

function RemoteAudioSink({
  remote,
  outputDeviceId,
  onError,
}: {
  remote: RemoteStream;
  outputDeviceId: string;
  onError(message: string): void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.srcObject = remote.stream;
    void audio.play().catch((error: any) => onError(`Remote lounge audio could not start: ${error?.message ?? String(error)}`));
    return () => {
      if (audio.srcObject === remote.stream) audio.srcObject = null;
    };
  }, [onError, remote.stream]);
  useEffect(() => {
    const audio = audioRef.current as AudioSinkElement | null;
    if (!audio) return;
    const sinkId = outputDeviceId === SYSTEM_DEVICE_ID ? '' : outputDeviceId;
    if (!audio.setSinkId) {
      if (sinkId) onError('Speaker output selection is not supported in this renderer.');
      return;
    }
    void audio.setSinkId(sinkId).catch((error: any) => onError(`Could not route lounge audio to the selected speaker: ${error?.message ?? String(error)}`));
  }, [onError, outputDeviceId]);
  return <audio ref={audioRef} className="px-remote-audio" autoPlay aria-hidden="true" />;
}

export function RemoteAudioSinks({
  streams,
  outputDeviceId,
  onError,
}: {
  streams: RemoteStream[];
  outputDeviceId: string;
  onError(message: string): void;
}) {
  return (
    <div className="px-lounge-remote-audio" aria-hidden="true">
      {streams.map((remote) => (
        <RemoteAudioSink key={remote.trackId} remote={remote} outputDeviceId={outputDeviceId} onError={onError} />
      ))}
    </div>
  );
}

export interface CoWorkingLoungeSectionProps {
  strapline: string;
  audioPriority: 'lounge' | 'project';
  members: FloorPresence[];
  inLounge: boolean;
  error: string | null;
  deviceError: string | null;
  busy: string | null;
  closeoutBusy: boolean;
  micActive: boolean;
  cameraActive: boolean;
  screenActive: boolean;
  captionsOn: boolean;
  localScreenPublisher: string | null;
  audioInputs: DeviceChoice[];
  audioOutputs: DeviceChoice[];
  videoInputs: DeviceChoice[];
  selectedMicId: string;
  selectedSpeakerId: string;
  selectedCameraId: string;
  onLeave(): void;
  onToggleMic(): void;
  onToggleCamera(): void;
  onToggleScreen(): void;
  onToggleCaptions(): void;
  onCloseout(): void;
  onRefreshDevices(): void;
  onSelectedMicChange(value: string): void;
  onSelectedSpeakerChange(value: string): void;
  onSelectedCameraChange(value: string): void;
}

export function CoWorkingLoungeSection(props: CoWorkingLoungeSectionProps) {
  return (
    <section className="px-studio-lounge" aria-label="Ambient lounge">
      <header className="px-studio-lounge-head">
        <div>
          <span className="px-lbl">Ambient lounge</span>
          <strong>{props.members.length} in lounge</strong>
          <small>{props.strapline} · project audio priority: {props.audioPriority}</small>
        </div>
        {props.inLounge ? (
          <span className="px-lounge-pill live">IN LOUNGE</span>
        ) : (
          <StatusChip tone={props.members.length ? 'accent' : 'idle'}>{props.members.length ? `${props.members.length} ambient` : 'calm'}</StatusChip>
        )}
      </header>
      {props.error && <DegradedStatePanel variant="offline" title="Lounge offline" message={props.error} />}
      {!props.inLounge && (
        <div className="px-lounge-idle">
          <div className="px-lounge-idle-copy"><span className="px-lbl">drop in for ambient co-presence — open mic, no agenda.</span></div>
        </div>
      )}
      {props.inLounge && (
        <div className="px-lounge-active">
          <div className="px-lounge-left"><MiniAvatarCluster members={props.members} cap={5} /></div>
          <div className="px-lounge-center">
            <LoungeWaveform active={props.members.some((member) => member.isSpeaking)} />
            <div className="px-lounge-center-copy">
              <span className="px-lbl px-lounge-strapline">{props.strapline}</span>
              <div className="px-lounge-signal-row" aria-label="Lounge privacy and media state">
                <span className="px-lounge-live-chip"><IconCheck s={10} /> AUDIT</span>
                <span className="px-lounge-live-chip muted">NO REC</span>
                <span className="px-lounge-live-chip muted">NO TRANSCRIPT</span>
                {props.localScreenPublisher && <span className="px-lounge-live-chip screen"><IconScreen s={10} /> {props.localScreenPublisher}</span>}
              </div>
            </div>
          </div>
          <div className="px-lounge-devices" aria-label="System media device choices">
            <label><span>mic</span><Select value={props.selectedMicId} onChange={(event) => props.onSelectedMicChange(event.target.value)} disabled={props.micActive || props.busy === 'mic'} aria-label="Choose microphone" title={props.micActive ? 'Turn the microphone off before changing input.' : 'Choose the system microphone for this lounge.'}>
              <option value={SYSTEM_DEVICE_ID}>System microphone</option>{props.audioInputs.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}
            </Select></label>
            <label><span><IconSpeaker s={9} /> speaker</span><Select value={props.selectedSpeakerId} onChange={(event) => props.onSelectedSpeakerChange(event.target.value)} aria-label="Choose speaker" title="Choose the system speaker for lounge audio.">
              <option value={SYSTEM_DEVICE_ID}>System speaker</option>{props.audioOutputs.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}
            </Select></label>
            <label><span>camera</span><Select value={props.selectedCameraId} onChange={(event) => props.onSelectedCameraChange(event.target.value)} disabled={props.cameraActive || props.busy === 'camera'} aria-label="Choose camera" title={props.cameraActive ? 'Turn the camera off before changing input.' : 'Choose the system camera for this lounge.'}>
              <option value={SYSTEM_DEVICE_ID}>System camera</option>{props.videoInputs.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}
            </Select></label>
            <button type="button" className="px-lounge-device-refresh" onClick={props.onRefreshDevices} aria-label="Refresh media devices" title="Refresh microphone, speaker, and camera choices from the operating system"><IconSync s={12} /></button>
          </div>
          <div className="px-lounge-controls">
            <button type="button" className={`px-lounge-ctl${props.micActive ? ' on' : ''}`} onClick={props.onToggleMic} disabled={props.busy === 'mic'} aria-label={props.micActive ? 'Mute microphone' : 'Unmute microphone'} aria-pressed={props.micActive}><IconMic s={14} /></button>
            <button type="button" className={`px-lounge-ctl${props.cameraActive ? ' on' : ''}`} onClick={props.onToggleCamera} disabled={props.busy === 'camera'} aria-label={props.cameraActive ? 'Disable camera' : 'Enable camera'} aria-pressed={props.cameraActive}><IconCamera s={14} /></button>
            <button type="button" className={`px-lounge-ctl${props.screenActive ? ' on' : ''}`} onClick={props.onToggleScreen} disabled={props.busy === 'screen'} aria-label={props.screenActive ? 'Stop screen sharing' : 'Share screen'} aria-pressed={props.screenActive} title="Open the native screen picker"><IconScreen s={14} /></button>
            <button type="button" className={`px-lounge-ctl${props.captionsOn ? ' on' : ''}`} onClick={props.onToggleCaptions} aria-label={props.captionsOn ? 'Hide captions' : 'Show captions'} aria-pressed={props.captionsOn} title="Captions preview only; no transcription is saved"><IconKeyboard s={14} /></button>
            <button type="button" className="px-lounge-ctl closeout" onClick={props.onCloseout} disabled={props.closeoutBusy} aria-label="Save lounge closeout" title="Save meeting memory"><IconPaperclip s={14} /></button>
            <button type="button" className="px-lounge-ctl danger" onClick={props.onLeave} disabled={props.busy === 'lounge_leave'} aria-label="Leave lounge"><IconClose s={14} /></button>
          </div>
          {props.deviceError && <div className="px-lounge-device-error" role="alert">{props.deviceError}</div>}
        </div>
      )}
    </section>
  );
}
