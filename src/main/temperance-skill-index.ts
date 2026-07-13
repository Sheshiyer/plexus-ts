import { readFile, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_SKILL_INDEX_PATH = path.join(os.homedir(), '.agents', 'skill-clusters', 'skill-index.json');
const MAX_SKILL_INDEX_BYTES = 1_048_576;
const MAX_SKILL_INDEX_ENTRIES = 2_048;

export interface TemperanceSkillIndexReaderOptions {
  path?: string;
  maxBytes?: number;
  maxEntries?: number;
}

function validSkillName(value: string): boolean {
  return /^[a-z0-9][a-z0-9:_-]{1,79}$/.test(value);
}

function skillLabel(name: string): string {
  return name.split(/[:_-]+/).filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ');
}

/** Read only names from the canonical index; operator paths never leave main. */
export async function loadTemperanceSkillLabels(
  options: TemperanceSkillIndexReaderOptions = {},
): Promise<Record<string, string>> {
  const indexPath = options.path ?? DEFAULT_SKILL_INDEX_PATH;
  const maxBytes = Math.min(options.maxBytes ?? MAX_SKILL_INDEX_BYTES, MAX_SKILL_INDEX_BYTES);
  const maxEntries = Math.min(options.maxEntries ?? MAX_SKILL_INDEX_ENTRIES, MAX_SKILL_INDEX_ENTRIES);
  try {
    const metadata = await stat(indexPath);
    if (!metadata.isFile() || metadata.size < 2 || metadata.size > maxBytes) return {};
    const parsed = JSON.parse(await readFile(indexPath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const skills = (parsed as Record<string, unknown>).skills;
    if (!skills || typeof skills !== 'object' || Array.isArray(skills)) return {};
    const names = Object.keys(skills as Record<string, unknown>);
    if (names.length > maxEntries) return {};
    return Object.fromEntries(names.map((name) => name.trim().toLowerCase())
      .filter(validSkillName).sort((left, right) => left.localeCompare(right))
      .map((name) => [name, skillLabel(name)]));
  } catch {
    return {};
  }
}
