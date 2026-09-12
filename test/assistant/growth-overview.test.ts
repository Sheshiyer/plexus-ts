import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGrowthOverviewFromVault } from '../../src/main/growth-overview';

type CellFixture = {
  role?: string;
  cell?: string;
  status?: string;
  organ?: string;
  publicGate?: string;
  title?: string;
};

function seedVault(root: string, fixture: CellFixture = {}): void {
  mkdirSync(path.join(root, '.obsidian'), { recursive: true });
  mkdirSync(path.join(root, '50-team'), { recursive: true });
  mkdirSync(path.join(root, '60-client-ecosystem'), { recursive: true });
  const growth = path.join(root, '20-operations', 'growth');
  const department = path.join(growth, 'department');
  const roleDirectory = path.join(department, '02-copywriter');
  const cellDirectory = path.join(roleDirectory, fixture.cell ?? 'social-posts');
  mkdirSync(cellDirectory, { recursive: true });
  mkdirSync(path.join(growth, 'packs', 'thoughtseed-cambium'), { recursive: true });

  writeFileSync(path.join(growth, 'README.md'), '# Growth\n');
  writeFileSync(path.join(department, '_schema.md'), '# Growth schema\n');
  writeFileSync(path.join(department, 'execution-map.md'), '# Execution map\n');
  writeFileSync(path.join(department, 'organ-map.md'), '# Organ map\n');
  writeFileSync(path.join(growth, 'packs', 'thoughtseed-cambium', 'pack.md'), [
    '---',
    'slug: thoughtseed-cambium',
    'platforms: [x, linkedin]',
    'source_of_truth: vault',
    'sync_status: local-only',
    '---',
    '',
    '# Pack',
  ].join('\n'));
  writeFileSync(path.join(cellDirectory, 'README.md'), [
    '---',
    'type: growth-cell',
    'source_of_truth: vault',
    `status: ${fixture.status ?? 'graded'}`,
    `role: ${fixture.role ?? 'copywriter'}`,
    `cell: ${fixture.cell ?? 'social-posts'}`,
    `organ: ${fixture.organ ?? 'hands'}`,
    'will_desk: dispatch',
    `public: ${fixture.publicGate ?? 'after-approve'}`,
    'pack: thoughtseed-cambium',
    '---',
    '',
    `# ${fixture.title ?? 'Social posts'}`,
  ].join('\n'));
}

describe('Growth overview projection', () => {
  it('projects only typed metadata from a complete local Growth source', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'plexus-growth-'));
    try {
      seedVault(root);
      const overview = readGrowthOverviewFromVault(root);

      expect(overview).toMatchObject({
        source: { state: 'ready', syncStatus: 'local-only' },
        pack: { slug: 'thoughtseed-cambium', platforms: ['x', 'linkedin'] },
        founderReviewCount: 1,
        counts: { graded: 1 },
        cells: [{
          id: 'copywriter/social-posts',
          title: 'Social posts',
          status: 'graded',
          role: 'copywriter',
          organ: 'hands',
          publicGate: 'after-approve',
        }],
      });
      expect(JSON.stringify(overview)).not.toContain(root);
      expect(JSON.stringify(overview)).not.toContain('README.md');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a typed cell is outside the Growth schema', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'plexus-growth-'));
    try {
      seedVault(root, { status: 'live' });
      const overview = readGrowthOverviewFromVault(root);

      expect(overview).toMatchObject({
        source: { state: 'invalid' },
        pack: null,
        cells: [],
        founderReviewCount: 0,
      });
      expect(JSON.stringify(overview)).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reports an unavailable source without inventing Growth state', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'plexus-growth-'));
    try {
      const overview = readGrowthOverviewFromVault(root);

      expect(overview).toMatchObject({
        source: { state: 'unavailable' },
        pack: null,
        cells: [],
        founderReviewCount: 0,
      });
      expect(JSON.stringify(overview)).not.toContain(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
