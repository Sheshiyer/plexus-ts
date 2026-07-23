import React from 'react';
import { Select } from '../ui';
import { IconSpeaker, IconSync } from '../Icons';
import { SYSTEM_DEVICE_ID } from '../../lib/useRealtimeMedia';

export interface DeviceChoiceOption {
  id: string;
  label: string;
}

export interface DeviceControlsProps {
  micActive: boolean;
  cameraActive: boolean;
  busy: string | null;
  audioInputs: DeviceChoiceOption[];
  audioOutputs: DeviceChoiceOption[];
  videoInputs: DeviceChoiceOption[];
  selectedMicId: string;
  selectedSpeakerId: string;
  selectedCameraId: string;
  onSelectMic(deviceId: string): void;
  onSelectSpeaker(deviceId: string): void;
  onSelectCamera(deviceId: string): void;
  onRefreshDevices(): void;
}

/**
 * System media device pickers (mic / speaker / camera) for the MediaDock's
 * device popover. Pure presentation: all state and side effects stay with
 * the useRealtimeMedia hook in the panel.
 */
export default function DeviceControls({
  micActive,
  cameraActive,
  busy,
  audioInputs,
  audioOutputs,
  videoInputs,
  selectedMicId,
  selectedSpeakerId,
  selectedCameraId,
  onSelectMic,
  onSelectSpeaker,
  onSelectCamera,
  onRefreshDevices,
}: DeviceControlsProps) {
  return (
    <div className="px-lounge-devices" aria-label="System media device choices">
      <label>
        <span>mic</span>
        <Select
          value={selectedMicId}
          onChange={(event) => onSelectMic(event.target.value)}
          disabled={micActive || busy === 'mic'}
          aria-label="Choose microphone"
          title={micActive ? 'Turn the microphone off before changing input.' : 'Choose the system microphone for this lounge.'}
        >
          <option value={SYSTEM_DEVICE_ID}>System microphone</option>
          {audioInputs.map((device) => (
            <option key={device.id} value={device.id}>{device.label}</option>
          ))}
        </Select>
      </label>
      <label>
        <span><IconSpeaker s={9} /> speaker</span>
        <Select
          value={selectedSpeakerId}
          onChange={(event) => onSelectSpeaker(event.target.value)}
          aria-label="Choose speaker"
          title="Choose the system speaker for lounge audio."
        >
          <option value={SYSTEM_DEVICE_ID}>System speaker</option>
          {audioOutputs.map((device) => (
            <option key={device.id} value={device.id}>{device.label}</option>
          ))}
        </Select>
      </label>
      <label>
        <span>camera</span>
        <Select
          value={selectedCameraId}
          onChange={(event) => onSelectCamera(event.target.value)}
          disabled={cameraActive || busy === 'camera'}
          aria-label="Choose camera"
          title={cameraActive ? 'Turn the camera off before changing input.' : 'Choose the system camera for this lounge.'}
        >
          <option value={SYSTEM_DEVICE_ID}>System camera</option>
          {videoInputs.map((device) => (
            <option key={device.id} value={device.id}>{device.label}</option>
          ))}
        </Select>
      </label>
      <button
        type="button"
        className="px-lounge-device-refresh"
        onClick={onRefreshDevices}
        aria-label="Refresh media devices"
        title="Refresh microphone, speaker, and camera choices from the operating system"
      >
        <IconSync s={12} />
      </button>
    </div>
  );
}
