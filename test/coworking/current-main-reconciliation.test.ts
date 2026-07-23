import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('current-main coworking supersession', () => {
  it('keeps the studio surface on extracted component owners', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const stage = source('src/renderer/components/coworking/StudioStage.tsx');

    // PR #116 Studio Floor decomposition supersedes main's CoWorkingStage +
    // ProjectMediaControls: media lives in the MediaDock, and transport honesty
    // is surfaced in StudioStage's evidence drawer.
    expect(panel).toContain("from './coworking/StudioStage'");
    expect(panel).toContain('TeamBenchRail');
    expect(panel).toContain('MediaDock');
    expect(panel).not.toContain('ProjectMediaControls');
    expect(stage).toContain('StageEvidenceDrawer');
    expect(stage).toContain('px-media-transport-pill');
  });

  it('preserves the 0.5.2 media-visibility fix without enabling transport', () => {
    const panel = source('src/renderer/components/CoWorkingPanel.tsx');
    const css = source('src/renderer/theme.css');

    // Studio Floor screen wall keeps a bounded media row (minmax(0,1fr)); the
    // 0.5.2 fix — controls stay gated until live SFU transport — is preserved
    // by the deferred transport state and the runtime cloudflare.configured gate.
    expect(css).toContain('.px-screen-wall{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto');
    expect(panel).toContain('PROJECT_MEDIA_WIRING_ENABLED');
    expect(panel).toContain(": 'deferred';");
  });
});
