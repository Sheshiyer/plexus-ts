import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking room stage UI', () => {
  it('wires the renderer model into the visible coworking page', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');

    expect(panel).toContain('listProjectRoomOptions');
    expect(panel).toContain('deriveFocusedZone');
    expect(panel).toContain('deriveScreenWall');
    expect(panel).toContain('Project stage');
    expect(panel).toContain('Screen wall');
    expect(panel).toContain('Focus stage');
    expect(panel).toContain('Fullscreen');
  });
});
