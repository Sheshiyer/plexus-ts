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
    expect(panel).toContain('<TeamBenchRail');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).toContain('aria-label="Choose focus project"');
    expect(panel).toContain('<Select');
    expect(panel).toContain('<StudioStage');
    expect(panel).toContain('Focus stage');

    // Moved into coworking/StudioStage.tsx with FocusedRoomStage + ScreenWall
    // (Task 6 decomposition, renamed export to StudioStage).
    const stage = source('src/renderer/components/coworking/StudioStage.tsx');
    expect(stage).toContain('Project stage');
    expect(stage).toContain('Screen wall');
    expect(stage).toContain('Fullscreen');

    // Moved into coworking/TeamBenchRail.tsx with the bench-rail aside
    // (Task 6 decomposition).
    const rail = source('src/renderer/components/coworking/TeamBenchRail.tsx');
    expect(rail).toContain('Team benches');
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
