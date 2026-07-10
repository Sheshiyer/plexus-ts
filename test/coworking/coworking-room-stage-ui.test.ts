import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking room stage UI', () => {
  it('wires the renderer model into the visible coworking page', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');
    const mediaControls = source('src/renderer/components/coworking/ProjectMediaControls.tsx');
    const css = source('src/renderer/theme.css');

    expect(panel).toContain('listProjectRoomOptions');
    expect(panel).toContain('deriveFocusedZone');
    expect(panel).toContain('derivePresenceMap');
    expect(panel).toContain('deriveScreenWall');
    expect(panel).toContain('participants: selectedRoomDetail?.participants ?? []');
    expect(panel).toContain('const loungeMembers = loungeLayer.members');
    expect(panel).toContain('<PresenceMap');
    expect(panel).toContain('<ProjectRoomRail');
    expect(panel).toContain('<FocusedRoomStage');

    expect(stage).toContain('Project stage');
    expect(stage).toContain('Screen wall');
    expect(panel).toContain('Focus stage');
    expect(stage).toContain('Meet-like focused project stage');
    expect(stage).toContain('Focus-only project selection');
    expect(stage).toContain('Fullscreen stage shell');
    expect(stage).toContain('Stage participants');
    expect(stage).toContain('Independent degraded states');
    expect(stage).toContain('Recording consent shell');
    expect(stage).toContain('Focused project zone only');
    expect(stage).toContain('Proof closeout');
    expect(stage).toContain('Create co-working proof closeout draft');
    expect(stage).toContain('Meeting memory');
    expect(stage).toContain('Room audit');
    expect(stage).toContain('Local simulation');
    expect(stage).toContain('Permission audit');
    expect(mediaControls).toContain('True live SFU proof');
    expect(css).toContain('.px-presence-map');
    expect(css).toContain('.px-meet-stage');
    expect(css).toContain('.px-stage-fullscreen-shell');
    expect(css).toContain('.px-project-media-signals');
    expect(css).toContain('.px-recording-consent-shell');
    expect(css).toContain('.px-proof-closeout-link');
    expect(css).toContain('.px-independent-degraded');
    expect(css).toContain('.px-persistent-lounge-layer');
    expect(css).toContain('.px-persistent-lounge-layer{position:relative;bottom:auto;z-index:auto}');
  });
});
