import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  bindVerifiedProjectRepository,
  getSetting,
  insertProject,
  listProjects,
  updateProject,
} from '../db/database.js';
import type {
  GitHubRepoOption,
  Project,
  ProjectRepoVerification,
  VaultProjectCandidate,
  VaultProjectScanResult,
} from '../shared/types.js';
import { hasVerifiedGitHubRepository } from '../shared/github-repository-authority.js';
import { serializeGitHubRepositoryBinding } from './github-repository-binding-lock.js';
import {
  matchWorkspaceRepository,
  normalizeGitHubRepositoryFullName,
  projectLinkedToGitHubRepository,
} from '../shared/github-project-linking.js';

/* ── Resolve vault repo root (previously lived in the retired fabric.ts) ── */
async function resolveRepoRoot(): Promise<string | null> {
  // 1. Provisioned repo root from Worker (Phase 7 — email-only, no device secrets)
  const provisioned = await getSetting('tf.paperclipRepoRoot');
  if (provisioned && existsSync(path.join(provisioned, 'manifest.yaml'))) return provisioned;

  // 2. Try the sibling repo layout (common in our workspace)
  const sibling = path.resolve(process.cwd(), '..', 'thoughtseed-paperclip');
  if (existsSync(path.join(sibling, 'manifest.yaml'))) return sibling;

  // 3. Try env override
  const envRoot = process.env.PAPERCLIP_REPO_ROOT;
  if (envRoot && existsSync(path.join(envRoot, 'manifest.yaml'))) return envRoot;

  // 4. Try home
  const home = process.env.HOME || process.env.USERPROFILE;
  if (home) {
    const homeCandidate = path.join(home, 'thoughtseed-paperclip');
    if (existsSync(path.join(homeCandidate, 'manifest.yaml'))) return homeCandidate;
  }
  return null;
}

const PALETTE = ['#9FBF43', '#56C8B0', '#6AA7A2', '#D7B56D', '#8EA86A', '#B9897B'];

function unquote(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '').trim();
}

function scalar(text: string, key: string): string | null {
  const match = text.match(new RegExp(`^${key}:\\s*(.+?)\\s*$`, 'm'));
  return match ? unquote(match[1]) : null;
}

function nestedScalar(text: string, section: string, key: string): string | null {
  const lines = text.split(/\r?\n/);
  let inSection = false;
  for (const raw of lines) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!raw.startsWith(' ') && raw.trim() === `${section}:`) {
      inSection = true;
      continue;
    }
    if (inSection && !raw.startsWith(' ')) return null;
    if (inSection) {
      const match = raw.match(new RegExp(`^\\s+${key}:\\s*(.+?)\\s*$`));
      if (match) return unquote(match[1]);
    }
  }
  return null;
}

function githubUrl(fullName: string | null): string | null {
  if (!fullName) return null;
  if (/^https?:\/\//i.test(fullName)) return fullName;
  return fullName.includes('/') ? `https://github.com/${fullName}` : null;
}

function normalizeStatus(status: string | null): string {
  return (status || 'active').trim().toLowerCase();
}

function readConfigCandidate(filePath: string): VaultProjectCandidate | null {
  const text = readFileSync(filePath, 'utf-8');
  const code = scalar(text, 'code') || path.basename(filePath, path.extname(filePath));
  const name = scalar(text, 'name') || code;
  const status = normalizeStatus(scalar(text, 'status'));
  const repo = nestedScalar(text, 'github', 'repo');
  const repoFullName = repo || null;
  return {
    code,
    projectId: code,
    name,
    status,
    sourcePath: filePath,
    githubRepoFullName: repoFullName,
    githubRepoUrl: githubUrl(repoFullName),
  };
}

function byCode(candidates: VaultProjectCandidate[]): VaultProjectCandidate[] {
  const merged = new Map<string, VaultProjectCandidate>();
  for (const candidate of candidates) {
    const existing = merged.get(candidate.code);
    if (!existing) {
      merged.set(candidate.code, candidate);
      continue;
    }
    const candidateHasName = candidate.name !== candidate.code;
    const existingHasName = existing.name !== existing.code;
    const candidateHasConfig = candidateHasName || Boolean(candidate.githubRepoFullName);
    merged.set(candidate.code, {
      ...existing,
      projectId: existing.projectId || candidate.projectId,
      name: candidateHasName ? candidate.name : existingHasName ? existing.name : candidate.name,
      status: candidate.status || existing.status,
      sourcePath: candidateHasConfig ? candidate.sourcePath : existing.sourcePath,
      githubRepoFullName: candidate.githubRepoFullName || existing.githubRepoFullName,
      githubRepoUrl: candidate.githubRepoUrl || existing.githubRepoUrl,
    });
  }
  return Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function scanRawVaultProjects(): Promise<{ repoRoot: string | null; candidates: VaultProjectCandidate[] }> {
  const repoRoot = await resolveRepoRoot();
  if (!repoRoot) return { repoRoot, candidates: [] };

  const found: VaultProjectCandidate[] = [];
  const configDir = path.join(repoRoot, 'config', 'projects');
  if (existsSync(configDir)) {
    for (const file of readdirSync(configDir)) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;
      const candidate = readConfigCandidate(path.join(configDir, file));
      if (candidate) found.push(candidate);
    }
  }

  const vaultDir = path.join(repoRoot, 'vault', 'projects');
  if (existsSync(vaultDir)) {
    for (const entry of readdirSync(vaultDir)) {
      if (entry.startsWith('_')) continue;
      const entryPath = path.join(vaultDir, entry);
      if (!statSync(entryPath).isDirectory()) continue;
      found.push({
        code: entry,
        projectId: entry,
        name: entry,
        status: 'active',
        sourcePath: entryPath,
      });
    }
  }

  return { repoRoot, candidates: byCode(found) };
}

function matchCachedProject(candidate: VaultProjectCandidate, projects: Project[]): Project | undefined {
  const repo = candidate.githubRepoFullName?.toLowerCase();
  return projects.find((project) => (
    project.id === candidate.projectId ||
    project.name.toLowerCase() === candidate.name.toLowerCase() ||
    (repo && project.githubRepoFullName?.toLowerCase() === repo)
  ));
}

export function vaultProjectImportPatch(
  candidate: VaultProjectCandidate,
  cached: Project | undefined,
): Partial<Project> {
  const cachedVerified = hasVerifiedGitHubRepository(cached);
  const preserveVerifiedBinding = cachedVerified && cached?.repoBindingSource !== 'vault_auto';
  const nextRepoUrl = preserveVerifiedBinding
    ? cached?.githubRepoUrl ?? null
    : candidate.githubRepoUrl || cached?.githubRepoUrl || null;
  const nextRepoFullName = preserveVerifiedBinding
    ? cached?.githubRepoFullName ?? null
    : candidate.githubRepoFullName || cached?.githubRepoFullName || null;
  const hasRepoBinding = Boolean(nextRepoUrl && nextRepoFullName);
  const repoChanged = Boolean(
    cached
    && cachedVerified
    && !preserveVerifiedBinding
    && candidate.githubRepoFullName
    && cached.githubRepoFullName
    && cached.githubRepoFullName.toLowerCase() !== candidate.githubRepoFullName.toLowerCase()
  );
  const resetVerification = !preserveVerifiedBinding && (repoChanged || !hasRepoBinding);
  return {
    name: candidate.name,
    ...(!preserveVerifiedBinding && candidate.githubRepoUrl ? { githubRepoUrl: candidate.githubRepoUrl } : {}),
    ...(!preserveVerifiedBinding && candidate.githubRepoFullName ? { githubRepoFullName: candidate.githubRepoFullName } : {}),
    ...(resetVerification ? {
      githubInstallationId: null,
      githubRepoId: null,
      githubRepoOwnerId: null,
      githubRepoOwnerLogin: null,
      githubRepoOwnerType: null,
      repoVerifiedAt: null,
      repoBindingSource: null,
      repoBoundAt: null,
      repoAuthoritySource: null,
    } : {}),
    ...(!cachedVerified || resetVerification ? { repoEvidenceStatus: hasRepoBinding ? 'unverified' : 'missing' } : {}),
    ...(!cachedVerified || resetVerification ? { evidenceStatus: hasRepoBinding ? 'pending' : 'missing' } : {}),
  };
}

export async function scanVaultProjects(): Promise<VaultProjectScanResult> {
  const { repoRoot, candidates } = await scanRawVaultProjects();
  const projects = await listProjects();
  const enriched = candidates.map((candidate) => {
    const cached = matchCachedProject(candidate, projects);
    const cachedRepoStatus: VaultProjectCandidate['cachedRepoStatus'] = hasVerifiedGitHubRepository(cached)
      ? 'verified'
      : cached?.repoEvidenceStatus === 'verified' ? 'unverified' : cached?.repoEvidenceStatus ?? null;
    return {
      ...candidate,
      cachedProjectId: cached?.id ?? null,
      cachedRepoStatus,
    };
  });
  return {
    ok: Boolean(repoRoot),
    repoRoot,
    candidates: enriched,
    imported: 0,
    autoLinked: 0,
    needsLinking: enriched.filter((candidate) => (
      candidate.status === 'active' && candidate.cachedRepoStatus !== 'verified'
    )).length,
    message: repoRoot ? `${enriched.length} vault project candidates found.` : 'Paperclip vault root not found.',
  };
}

export async function importVaultProjects(): Promise<VaultProjectScanResult> {
  const { repoRoot, candidates } = await scanRawVaultProjects();
  if (!repoRoot) {
    return {
      ok: false,
      repoRoot,
      candidates: [],
      imported: 0,
      autoLinked: 0,
      needsLinking: 0,
      message: 'Paperclip vault root not found.',
    };
  }

  const projects = await listProjects();
  let imported = 0;
  let index = projects.length;
  for (const candidate of candidates.filter((item) => item.status === 'active')) {
    const cached = matchCachedProject(candidate, projects);
    const patch = vaultProjectImportPatch(candidate, cached);

    if (cached) {
      await updateProject(cached.id, patch);
      imported++;
      continue;
    }

    await insertProject({
      id: candidate.projectId,
      name: candidate.name,
      color: PALETTE[index % PALETTE.length],
      archived: false,
      createdAt: new Date().toISOString(),
      githubRepoUrl: candidate.githubRepoUrl,
      githubRepoFullName: candidate.githubRepoFullName,
      repoEvidenceStatus: candidate.githubRepoUrl ? 'unverified' : 'missing',
      repoRequired: true,
      evidenceStatus: candidate.githubRepoUrl ? 'pending' : 'missing',
    });
    projects.push({
      id: candidate.projectId,
      name: candidate.name,
      color: PALETTE[index % PALETTE.length],
      archived: false,
      createdAt: new Date().toISOString(),
      githubRepoUrl: candidate.githubRepoUrl,
      githubRepoFullName: candidate.githubRepoFullName,
      repoEvidenceStatus: candidate.githubRepoUrl ? 'unverified' : 'missing',
      repoRequired: true,
      evidenceStatus: candidate.githubRepoUrl ? 'pending' : 'missing',
    });
    index++;
    imported++;
  }

  const rescanned = await scanVaultProjects();
  return {
    ...rescanned,
    imported,
    autoLinked: 0,
    message: `Imported or refreshed ${imported} active vault project${imported === 1 ? '' : 's'}.`,
  };
}

export async function autoLinkVaultProjectRepositories(
  candidates: readonly VaultProjectCandidate[],
  repositories: readonly GitHubRepoOption[],
  verify: (projectId: string, installationId: number, repositoryId: number) => Promise<ProjectRepoVerification>,
): Promise<{ autoLinked: number; failed: number }> {
  const projects = await listProjects();
  const activeCandidates = candidates.filter((item) => item.status === 'active');
  const declaredRepositoryCounts = new Map<string, number>();
  for (const candidate of activeCandidates) {
    const normalized = normalizeGitHubRepositoryFullName(candidate.githubRepoFullName);
    if (normalized) declaredRepositoryCounts.set(normalized, (declaredRepositoryCounts.get(normalized) ?? 0) + 1);
  }
  let autoLinked = 0;
  let failed = 0;

  for (const candidate of activeCandidates) {
    const project = candidate.cachedProjectId
      ? projects.find((item) => item.id === candidate.cachedProjectId)
      : matchCachedProject(candidate, projects);
    if (!project || hasVerifiedGitHubRepository(project)) continue;
    const normalized = normalizeGitHubRepositoryFullName(candidate.githubRepoFullName);
    if (normalized && (declaredRepositoryCounts.get(normalized) ?? 0) > 1) {
      failed++;
      continue;
    }

    const match = matchWorkspaceRepository(candidate.githubRepoFullName, repositories);
    if (match.status !== 'matched') continue;
    const outcome = await serializeGitHubRepositoryBinding(async () => {
      const currentProjects = await listProjects();
      const currentProject = currentProjects.find((item) => item.id === project.id);
      if (!currentProject || hasVerifiedGitHubRepository(currentProject)) {
        return { status: 'skipped' as const };
      }
      const existingBinding = projectLinkedToGitHubRepository(match.repository, currentProjects);
      if (existingBinding && existingBinding.id !== project.id) {
        return { status: 'failed' as const };
      }

      const result = await verify(project.id, match.repository.installationId, match.repository.id);
      if (!result.ok || !result.project) {
        return { status: 'failed' as const };
      }

      const repoBoundAt = result.project.repoVerifiedAt ?? new Date().toISOString();
      const persisted = await bindVerifiedProjectRepository(
        project.id,
        result.project,
        'vault_auto',
        repoBoundAt,
      );
      if (!persisted) return { status: 'failed' as const };
      return { status: 'linked' as const, project: result.project, repoBoundAt };
    });
    if (outcome.status === 'failed') {
      failed++;
      continue;
    }
    if (outcome.status === 'skipped') continue;
    Object.assign(project, outcome.project, {
      repoBindingSource: 'vault_auto' as const,
      repoBoundAt: outcome.repoBoundAt,
    });
    autoLinked++;
  }

  return { autoLinked, failed };
}
