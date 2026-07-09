import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Today renderer contract', () => {
  it('renders the P3-W2 command center sections from the shared Today snapshot', () => {
    const timer = source('src/renderer/components/Timer.tsx');
    const theme = source('src/renderer/theme.css');

    for (const marker of [
      'px-today-proof-banner',
      'px-today-hero-grid',
      'Today hero command panel',
      'today proof ledger',
      'Clio suggestion rail',
      'px-today-suggestion-rail',
    ]) {
      expect(timer).toContain(marker);
    }

    for (const marker of [
      '.px-today-proof-banner',
      '.px-today-hero-grid',
      '.px-today-proof-ledger',
      '.px-today-suggestion-rail',
    ]) {
      expect(theme).toContain(marker);
    }

    expect(timer).toContain('snapshot.assignments.current');
    expect(timer).toContain('snapshot.rooms.current');
    expect(timer).toContain('snapshot.suggestions');
    expect(timer).toContain('snapshot.sourceHealth');
    expect(timer).toContain('snapshot.entries.slice(0, 4)');
    expect(timer).toContain('entry.evidenceStatus');
    expect(timer).toContain('snapshot.sourceHealth.fabricTasks.state');
  });

  it('keeps Today suggestions as safe route guidance, not direct skill execution', () => {
    const timer = source('src/renderer/components/Timer.tsx');

    expect(timer).toContain("navigateToRoute(suggestion.routeKey!)");
    expect(timer).not.toMatch(/skillHints|spawn_agent|execute_document_command|request_plugin_install/);
  });
});
