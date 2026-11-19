import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  GrowthCellStatus,
  GrowthCellSummary,
  GrowthOrgan,
  GrowthOverview,
  GrowthOverviewSourceState,
  GrowthPublicGate,
  GrowthRole,
} from '../shared/types.js';
import { resolveFounderVaultRoot } from './vault-projects.js';

const GROWTH_STATUSES = [
  'empty', 'inbox', 'draft', 'graded', 'approved', 'published', 'held', 'stale', 'pointer',
] as const satisfies readonly GrowthCellStatus[];
const GROWTH_ROLES = [
  'head-of-marketing', 'copywriter', 'creative-strategist', 'launch-lead', 'seo-lead', 'analyst',
] as const satisfies readonly GrowthRole[];
const GROWTH_ORGANS = ['genesis', 'taste', 'hands', 'will', 'cortex'] as const satisfies readonly GrowthOrgan[];
const PUBLIC_GATES = ['never', 'after-approve'] as const satisfies readonly GrowthPublicGate[];
const MAX_DOCUMENT_BYTES = 96 * 1024;
const MAX_CELL_COUNT = 48;

function emptyCounts(): Record<GrowthCellStatus, number> {
  return Object.fromEntries(GROWTH_STATUSES.map((status) => [status, 0])) as Record<GrowthCellStatus, number>;
}

function unavailable(
  state: Exclude<GrowthOverviewSourceState, 'ready'>,
  message: string,
  checkedAt = new Date().toISOString(),
): GrowthOverview {
  return {
    source: { state, checkedAt, message, syncStatus: null },
    pack: null,
    cells: [],
    counts: emptyCounts(),
    founderReviewCount: 0,
  };
}

function isOneOf<T extends readonly string[]>(value: string | null, values: T): value is T[number] {
  return value !== null && (values as readonly string[]).includes(value);
}

function isRegularFile(filePath: string): boolean {
  try {
    return lstatSync(filePath).isFile();
  } catch {
    return false;
  }
}

function readDocument(filePath: string): string {
  if (!isRegularFile(filePath)) throw new Error('not a regular file');
  const size = lstatSync(filePath).size;
  if (size > MAX_DOCUMENT_BYTES) throw new Error('document exceeds the metadata reader limit');
  return readFileSync(filePath, 'utf8');
}

function frontmatter(document: string): string | null {
  const match = document.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match?.[1] ?? null;
}

function hasControlCharacters(value: string): boolean {
  return Array.from(value).some((character) => character.charCodeAt(0) < 32);
}

function scalar(metadata: string, key: string): string | null {
  const match = metadata.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  if (!match) return null;
  const value = match[1].trim().replace(/^['"]|['"]$/g, '').trim();
  if (!value || value.length > 160 || hasControlCharacters(value)) return null;
  return value;
}

function list(metadata: string, key: string): string[] {
  const value = scalar(metadata, key);
  if (!value || !value.startsWith('[') || !value.endsWith(']')) return [];
  return value.slice(1, -1)
    .split(',')
    .map((item) => item.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
    .filter((item) => item.length > 0 && item.length <= 40 && /^[a-z0-9-]+$/.test(item));
}

function heading(document: string): string | null {
  const body = document.replace(/^---[\s\S]*?---(?:\r?\n|$)/, '');
  const match = body.match(/^#\s+(.+?)\s*$/m);
  const value = match?.[1]?.trim() ?? '';
  if (!value || value.length > 120 || hasControlCharacters(value)) return null;
  return value;
}

function visibleCellId(role: GrowthRole, cell: string | null): string | null {
  if (!cell || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(cell)) return null;
  return `${role}/${cell}`;
}

function parseCell(filePath: string): GrowthCellSummary {
  const document = readDocument(filePath);
  const metadata = frontmatter(document);
  if (!metadata || scalar(metadata, 'type') !== 'growth-cell' || scalar(metadata, 'source_of_truth') !== 'vault') {
    throw new Error('cell metadata is not a typed vault growth cell');
  }

  const status = scalar(metadata, 'status');
  const role = scalar(metadata, 'role');
  const organ = scalar(metadata, 'organ');
  const publicGate = scalar(metadata, 'public');
  const id = isOneOf(role, GROWTH_ROLES) ? visibleCellId(role, scalar(metadata, 'cell')) : null;
  const title = heading(document);

  if (!isOneOf(status, GROWTH_STATUSES) || !isOneOf(role, GROWTH_ROLES) || !isOneOf(organ, GROWTH_ORGANS)
    || !isOneOf(publicGate, PUBLIC_GATES) || !id || !title) {
    throw new Error('cell metadata is incomplete or outside the Growth schema');
  }

  const willDesk = scalar(metadata, 'will_desk');
  const pack = scalar(metadata, 'pack');
  return {
    id,
    title,
    status,
    role,
    organ,
    willDesk: willDesk ?? null,
    publicGate,
    pack: pack ?? null,
  };
}

function cellReadmes(departmentRoot: string): string[] {
  const files: string[] = [];
  for (const roleEntry of readdirSync(departmentRoot, { withFileTypes: true })) {
    if (!roleEntry.isDirectory() || roleEntry.isSymbolicLink() || roleEntry.name.startsWith('_')) continue;
    const roleRoot = path.join(departmentRoot, roleEntry.name);
    for (const cellEntry of readdirSync(roleRoot, { withFileTypes: true })) {
      if (!cellEntry.isDirectory() || cellEntry.isSymbolicLink() || cellEntry.name.startsWith('_')) continue;
      const readme = path.join(roleRoot, cellEntry.name, 'README.md');
      if (isRegularFile(readme)) files.push(readme);
    }
  }
  return files.sort();
}

function parsePack(packPath: string): GrowthOverview['pack'] {
  const metadata = frontmatter(readDocument(packPath));
  if (!metadata || scalar(metadata, 'source_of_truth') !== 'vault' || scalar(metadata, 'sync_status') !== 'local-only') {
    throw new Error('Growth pack metadata is unavailable');
  }
  const slug = scalar(metadata, 'slug');
  const platforms = list(metadata, 'platforms');
  if (!slug || !/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug) || platforms.length === 0) {
    throw new Error('Growth pack metadata is incomplete');
  }
  return { slug, platforms };
}

/**
 * Builds a deliberately narrow, read-only projection of the Growth vault.
 * The caller never receives a filesystem path or source document body.
 */
export function readGrowthOverviewFromVault(vaultRoot: string): GrowthOverview {
  const checkedAt = new Date().toISOString();
  const growthRoot = path.join(vaultRoot, '20-operations', 'growth');
  const departmentRoot = path.join(growthRoot, 'department');
  const requiredDocuments = [
    path.join(growthRoot, 'README.md'),
    path.join(departmentRoot, '_schema.md'),
    path.join(departmentRoot, 'execution-map.md'),
    path.join(departmentRoot, 'organ-map.md'),
    path.join(growthRoot, 'packs', 'thoughtseed-cambium', 'pack.md'),
  ];

  if (!existsSync(growthRoot)) {
    return unavailable('unavailable', 'The local founder vault has no Growth source. No records were loaded.', checkedAt);
  }
  if (!requiredDocuments.every(isRegularFile)) {
    return unavailable('invalid', 'The local Growth source is incomplete. No partial records were loaded.', checkedAt);
  }

  try {
    const pack = parsePack(path.join(growthRoot, 'packs', 'thoughtseed-cambium', 'pack.md'));
    const readmes = cellReadmes(departmentRoot);
    if (readmes.length === 0 || readmes.length > MAX_CELL_COUNT) {
      return unavailable('invalid', 'The typed Growth cell index is unavailable. No partial records were loaded.', checkedAt);
    }
    const cells = readmes.map(parseCell).sort((a, b) => a.id.localeCompare(b.id));
    const counts = emptyCounts();
    for (const cell of cells) counts[cell.status] += 1;
    return {
      source: {
        state: 'ready',
        checkedAt,
        message: 'Typed Growth metadata was read from the local-only founder vault.',
        syncStatus: 'local-only',
      },
      pack,
      cells,
      counts,
      founderReviewCount: cells.filter((cell) => cell.status === 'graded' && cell.publicGate === 'after-approve').length,
    };
  } catch {
    return unavailable('invalid', 'The local Growth source could not be verified. No partial records were loaded.', checkedAt);
  }
}

export async function getGrowthOverview(): Promise<GrowthOverview> {
  try {
    const vaultRoot = await resolveFounderVaultRoot();
    if (!vaultRoot) {
      return unavailable('unavailable', 'A local founder vault is not configured on this Mac. No records were loaded.');
    }
    return readGrowthOverviewFromVault(vaultRoot);
  } catch {
    return unavailable('unavailable', 'The local founder vault could not be resolved. No records were loaded.');
  }
}
