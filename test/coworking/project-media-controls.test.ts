import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('media dock integration', () => {
  const panel = () => source('src/renderer/components/CoWorkingPanel.tsx');

  it('derives dock state from joins and renders MediaDock', () => {
    expect(panel()).toContain("from '../lib/dock-model'");
    expect(panel()).toContain('deriveDockState');
    expect(panel()).toContain('<MediaDock');
    expect(panel()).toContain('wiringEnabled: PROJECT_MEDIA_WIRING_ENABLED');
  });

  it('stamps joinedAt on active joins', () => {
    // Moved to useRealtimeMedia.ts with the join logic (Task 6 decomposition).
    const hook = source('src/renderer/lib/useRealtimeMedia.ts');
    expect(hook).toContain('joinedAt: new Date().toISOString()');
  });

  it('stage no longer hosts media buttons', () => {
    expect(panel()).not.toContain('ProjectMediaControls');
  });

  it('uses Join/Leave verbs on the stage', () => {
    // Moved into coworking/StudioStage.tsx (Task 6 decomposition).
    const stage = source('src/renderer/components/coworking/StudioStage.tsx');
    expect(stage).toMatch(/'Joining' : 'Join'/);
    expect(panel()).not.toContain("'Drop in'");
  });
});
