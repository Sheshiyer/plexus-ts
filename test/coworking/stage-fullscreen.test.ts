import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking stage fullscreen accessibility', () => {
  const panel = source('src/renderer/components/CoWorkingPanel.tsx');

  it('closes the fullscreen stage on Escape', () => {
    expect(panel).toContain("event.key === 'Escape'");
    expect(panel).toContain("addEventListener('keydown'");
    expect(panel).toContain("removeEventListener('keydown'");
  });

  it('restores focus to the fullscreen trigger on exit', () => {
    expect(panel).toContain('stageFullscreenReturnRef');
    expect(panel).toContain('document.activeElement');
    expect(panel).toMatch(/trigger\.focus\(\)/);
  });

  it('routes the fullscreen toggle through the focus-preserving handler', () => {
    expect(panel).toContain('toggleStageFullscreen');
    expect(panel).toContain('onToggleFullscreen={toggleStageFullscreen}');
  });
});
