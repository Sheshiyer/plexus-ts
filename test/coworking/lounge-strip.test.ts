import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('LoungeStrip', () => {
  it('is a compact strip: presence, unrecorded note, one Join action, no media controls', () => {
    const strip = source('src/renderer/components/coworking/LoungeStrip.tsx');
    expect(strip).toContain('unrecorded');
    expect(strip).toContain('onClick={onJoin}');
    expect(strip).not.toContain('IconMic');
    expect(strip).not.toContain('IconCamera');
    expect(strip).not.toContain('getUserMedia');
  });

  it('replaces the full lounge section in the panel', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).not.toContain('px-lounge-controls');
  });

  it('the dock leave path sets busy before awaiting the leave', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain("setBusy(activeMediaEntry.scope === 'lounge' ? 'lounge_leave' : 'room_leave')");
  });
});
