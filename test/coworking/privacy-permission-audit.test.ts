import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deriveCoWorkingPrivacyPermissionAudit } from '../../src/renderer/lib/coworkingModel';
import type { MediaCaptureStatus } from '../../src/shared/types';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

function status(overrides: Partial<MediaCaptureStatus> = {}): MediaCaptureStatus {
  return {
    checkedAt: '2026-07-10T10:00:00.000Z',
    platform: 'darwin',
    isPackaged: false,
    permissions: {
      microphone: 'granted',
      camera: 'denied',
      screen: 'restricted',
    },
    desktopCapture: {
      available: false,
      sourceCount: 0,
      screenCount: 0,
      windowCount: 0,
      error: 'Screen Recording denied',
    },
    renderer: {
      mediaDevicesAvailable: true,
      enumerateDevicesAvailable: true,
      audioInputs: 1,
      audioOutputs: 1,
      videoInputs: 0,
    },
    notes: ['Screen Recording permission is managed in macOS System Settings.'],
    ...overrides,
  };
}

describe('coworking privacy permission audit', () => {
  it('models denied and restricted permissions without blocking leave or closeout', () => {
    const audit = deriveCoWorkingPrivacyPermissionAudit({
      status: status(),
      deviceError: 'Camera permission denied',
      closeoutAvailable: true,
    });

    expect(audit.visible).toBe(true);
    expect(audit.leaveAvailable).toBe(true);
    expect(audit.closeoutAvailable).toBe(true);
    expect(audit.blockedCount).toBe(2);
    expect(audit.recoverableCount).toBe(2);
    expect(audit.copy).toBe('Media permission/device errors are recoverable; leave and proof closeout remain available.');
    expect(audit.signals).toContainEqual(expect.objectContaining({
      kind: 'camera',
      state: 'denied',
      level: 'blocked',
      recoverable: true,
      recoveryActions: expect.arrayContaining(['request_camera', 'open_system_settings', 'continue_without_media']),
    }));
    expect(audit.signals).toContainEqual(expect.objectContaining({
      kind: 'screen',
      state: 'restricted',
      level: 'blocked',
      systemSettingsOnly: true,
      recoveryActions: expect.arrayContaining(['open_system_settings', 'continue_without_media']),
    }));
  });

  it('falls back to unknown permissions when the main-process status is unavailable', () => {
    const audit = deriveCoWorkingPrivacyPermissionAudit();

    expect(audit.checkedAt).toBeNull();
    expect(audit.sourceStatus).toBeNull();
    expect(audit.signals.map((signal) => signal.state)).toEqual(['unknown', 'unknown', 'unknown']);
    expect(audit.recoverableCount).toBe(3);
    expect(audit.chips).toContain('screen is system settings only');
  });

  it('wires permission audit into the coworking stage without replacing independent degraded states', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(panel).toContain('mediaCaptureStatus');
    expect(panel).toContain('window.plexus.mediaCaptureStatus()');
    expect(panel).toContain('deriveCoWorkingPrivacyPermissionAudit');
    expect(stage).toContain('Permission audit');
    expect(stage).toContain('leave/closeout stay available');
  });
});
