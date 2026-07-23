import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking room stage UI', () => {
  it('wires the renderer model into the focused My Studio composition', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain('listProjectRoomOptions');
    expect(panel).toContain('deriveFocusedZone');
    expect(panel).toContain('deriveScreenWall');
    expect(panel).toContain('px-coworking-studio');
    expect(panel).toContain('px-coworking-telemetry');
    expect(panel).toContain('My bench');
    expect(panel).toContain('Team benches');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).toContain('aria-label="Choose focus project"');
    expect(panel).toContain('<Select');
    expect(panel).toContain('<FocusedRoomStage');
    expect(panel).toContain('Project stage');
    expect(panel).toContain('Screen wall');
    expect(panel).toContain('Focus stage');
    expect(panel).toContain('Fullscreen');
  });

  it('derives private rhythm state from settings without fabricated metrics', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain('window.plexus.settingsGet()');
    expect(panel).toContain("settings.rhythmProfile.enabled ? 'enabled' : 'paused'");
    expect(panel).toContain("setRhythmState('unavailable')");
    expect(panel).toContain('LOCAL · PRIVATE');
    expect(panel).not.toContain('FOCUS RISE');
    expect(panel).not.toContain('72%');
  });

  it('keeps project selection compact instead of rendering the legacy room rail', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).not.toMatch(/<ProjectRoomRail\b/);
  });
});
