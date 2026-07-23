import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('MediaDock', () => {
  const dock = () => source('src/renderer/components/coworking/MediaDock.tsx');

  it('renders nothing unless the dock state is visible', () => {
    expect(dock()).toContain('if (!dock.visible) return null;');
  });

  it('has mic, camera, screen toggles gated on transport readiness', () => {
    expect(dock()).toContain('onClick={onToggleMic}');
    expect(dock()).toContain('onClick={onToggleCamera}');
    expect(dock()).toContain('onClick={onToggleScreen}');
    expect(dock()).toContain('!dock.transportReady');
    expect(dock()).toContain('Realtime media transport is not configured');
  });

  it('has the only red Leave action plus closeout and live indicator', () => {
    expect(dock()).toContain('variant="stop"');
    expect(dock()).toContain('onClick={onLeave}');
    expect(dock()).toContain('onClick={onCloseout}');
    expect(dock()).toContain('px-dock-live');
    expect(dock()).toContain('aria-pressed={micActive}');
  });
});
