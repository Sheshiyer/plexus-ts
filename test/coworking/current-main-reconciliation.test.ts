import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('current-main coworking supersession', () => {
  it('keeps the studio surface on extracted component owners', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/CoWorkingStage.tsx');

    expect(panel).toContain("from './coworking/CoWorkingStage'");
    expect(panel).toContain('TeamBenchRail');
    expect(panel).toContain('CoWorkingLoungeSection');
    expect(stage).toContain('<ProjectMediaControls');
    expect(stage).toContain("from './ProjectMediaControls'");
  });

  it('preserves the 0.5.2 media-visibility fix without enabling transport', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const css = source('src/renderer/theme.css');

    expect(css).toContain('grid-template-rows:auto minmax(8rem,1fr) auto');
    expect(panel).toMatch(/PROJECT_MEDIA_TRANSPORT_READY\s*=\s*false/);
    expect(panel).toMatch(/PROJECT_SFU_LIVE_PROOF_VERIFIED\s*=\s*false/);
  });
});
