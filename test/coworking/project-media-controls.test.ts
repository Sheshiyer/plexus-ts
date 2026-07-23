import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('project media controls (wired, runtime-gated)', () => {
  it('renders mic, camera, and screen buttons with real toggle handlers', () => {
    const controls = source('src/renderer/components/coworking/ProjectMediaControls.tsx');

    expect(controls).toContain('Mic');
    expect(controls).toContain('Camera');
    expect(controls).toContain('Screen');

    // Buttons are wired, not inert shells.
    expect(controls).toContain('onClick={onToggleMic}');
    expect(controls).toContain('onClick={onToggleCamera}');
    expect(controls).toContain('onClick={onToggleScreen}');
    expect(controls).toContain('aria-pressed={micActive}');

    // Still gated on an active project join and live transport readiness.
    expect(controls).toContain('activeProjectJoin');
    expect(controls).toContain('transportReady');
    expect(controls).toMatch(/const mediaDisabled = !activeProjectJoin \|\| !transportReady;/);

    // Honest hint for the credentials-missing state.
    expect(controls).toContain('Realtime media transport is not configured');
  });

  it('derives transport readiness from the live cloudflare.configured signal', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain("from './coworking/ProjectMediaControls'");
    expect(panel).toContain('<ProjectMediaControls');
    // Kill switch stays on; actual readiness comes from the join response.
    expect(panel).toMatch(/PROJECT_MEDIA_WIRING_ENABLED\s*=\s*true/);
    expect(panel).toContain('PROJECT_MEDIA_WIRING_ENABLED && Boolean(activeProjectJoin?.joined.cloudflare.configured)');
  });

  it('constructs a RealtimeSession when dropping into a project room', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const dropIn = panel.slice(
      panel.indexOf('const dropInToRoom'),
      panel.indexOf('const leaveProjectRoom'),
    );

    expect(dropIn).toContain('new RealtimeSession(result.joined');
    expect(dropIn).toContain('await session.init()');
    expect(dropIn).toContain('sessionRef.current = session');
    expect(dropIn).toContain('hasSession: true');
  });

  it('generalizes media toggles to whichever join owns the session', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain('const activeMediaEntry = activeJoinList.find((entry) => entry.hasSession)');
    // Toggles guard on the active media join, not the lounge specifically.
    const toggles = panel.slice(panel.indexOf('const toggleMic'), panel.indexOf('/* ---------------- room actions'));
    expect(toggles).not.toContain('if (!loungeJoin) return;');
    expect(toggles.match(/if \(!activeMediaJoin\) return;/g)?.length).toBe(3);
  });
});
