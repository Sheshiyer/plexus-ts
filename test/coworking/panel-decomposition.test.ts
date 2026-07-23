import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking decomposition', () => {
  it('useRealtimeMedia is the sole RealtimeSession owner', () => {
    const hook = source('src/renderer/lib/useRealtimeMedia.ts');
    expect(hook).toContain('new RealtimeSession(');
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).not.toContain('new RealtimeSession(');
    expect(panel).toContain('useRealtimeMedia(');
  });

  it('panel composes the extracted components', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    expect(panel).toContain('<FloorTelemetryBar');
    expect(panel).toContain('<StudioStage');
    expect(panel).toContain('<TeamBenchRail');
    expect(panel).toContain('<LoungeStrip');
    expect(panel).toContain('<MediaDock');
  });

  it('panel stays an orchestrator (< 700 lines)', () => {
    const lines = source('src/renderer/components/CoWorkingPanel.tsx').split('\n').length;
    expect(lines).toBeLessThan(700);
  });
});
