import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('coworking regression pack gate', () => {
  it('keeps coworking model, UI, media, privacy, and transport checks under test:coworking', () => {
    const pkg = JSON.parse(source('package.json')) as { scripts: Record<string, string> };

    expect(pkg.scripts['test:coworking']).toBe('vitest run test/coworking');
    expect(pkg.scripts['test:all']).toContain('npm run test:coworking');
    expect(pkg.scripts['verify:all']).toContain('npm run test:all');

    const expectedFiles = [
      'test/coworking/focused-zone.test.ts',
      'test/coworking/screen-wall-model.test.ts',
      'test/coworking/stage-fullscreen.test.ts',
      'test/coworking/project-focus-behavior.test.ts',
      'test/coworking/project-join-presence-only.test.ts',
      'test/coworking/project-media-controls.test.ts',
      'test/coworking/recording-consent-shell.test.ts',
      'test/coworking/degraded-state-model.test.ts',
      'test/coworking/sfu-live-transport-acceptance.test.ts',
    ];

    for (const file of expectedFiles) {
      expect(source(file).length).toBeGreaterThan(120);
    }
  });
});
