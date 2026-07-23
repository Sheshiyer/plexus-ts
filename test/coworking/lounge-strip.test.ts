import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n');

describe('LoungeStrip', () => {
  it('is a compact strip: presence, unrecorded note, one Join action, no media controls', () => {
    const strip = source('src/renderer/components/coworking/LoungeStrip.tsx');
    expect(strip).toContain('unrecorded');
    expect(strip).toContain('onClick={onJoin}');
    expect(strip).not.toContain('IconMic');
    expect(strip).not.toContain('IconCamera');
    expect(strip).not.toContain('getUserMedia');
  });

  it('gates the Join button on an available prop in addition to busy', () => {
    const strip = source('src/renderer/components/coworking/LoungeStrip.tsx');
    expect(strip).toContain('available: boolean');
    expect(strip).toContain('disabled={busy || !available}');

    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain('available={Boolean(loungeRoom)}');
  });

  it('replaces the full lounge section in the panel', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).not.toContain('px-lounge-controls');
  });

  it('the dock leave path sets busy before awaiting the leave, and catches leave failures onto the dock', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain("setBusy(activeMediaEntry.scope === 'lounge' ? 'lounge_leave' : 'room_leave')");
    // Finding 1 (final review): a failed leaveActiveJoin must not be silently
    // swallowed while the dock still shows LIVE — it is caught and routed to
    // dockMessage, which the dock renders via its `message` prop.
    expect(panel).toContain('} catch (err: any) {\n            setDockMessage(err?.message ?? String(err));');
    expect(panel).toContain('message={dockMessage ?? deviceError ?? loungeError}');
  });
});
