import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadTemperanceSkillLabels } from '../../src/main/temperance-skill-index';

const temporaryDirectories: string[] = [];

async function fixture(value: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'plexus-skill-index-'));
  temporaryDirectories.push(directory);
  const target = path.join(directory, 'skill-index.json');
  await writeFile(target, value, 'utf8');
  return target;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('Temperance skill index resolution', () => {
  it('returns normalized names without exposing indexed paths', async () => {
    const target = await fixture(JSON.stringify({ skills: {
      'zeta-skill': { path: '/secret/zeta' },
      'engineering:code-review': { path: '/secret/review' },
      '../unsafe': { path: '/secret/unsafe' },
    } }));
    await expect(loadTemperanceSkillLabels({ path: target })).resolves.toEqual({
      'engineering:code-review': 'Engineering Code Review',
      'zeta-skill': 'Zeta Skill',
    });
  });

  it('fails closed for malformed, oversized, or crowded indexes', async () => {
    const malformed = await fixture('{');
    const oversized = await fixture(JSON.stringify({ skills: { safe: {} }, padding: 'x'.repeat(256) }));
    const crowded = await fixture(JSON.stringify({ skills: { one: {}, two: {} } }));
    await expect(loadTemperanceSkillLabels({ path: malformed })).resolves.toEqual({});
    await expect(loadTemperanceSkillLabels({ path: oversized, maxBytes: 64 })).resolves.toEqual({});
    await expect(loadTemperanceSkillLabels({ path: crowded, maxEntries: 1 })).resolves.toEqual({});
  });
});
