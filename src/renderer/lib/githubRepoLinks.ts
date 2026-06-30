const GITHUB_WEB_ORIGIN = 'https://github.com';
const GITHUB_API_ORIGIN = 'https://api.github.com';
const GITHUB_REPO_FULL_NAME_RE = /^[\w.-]+\/[\w.-]+$/;

function suffixPath(path: string): string {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

export function isGitHubRepoFullName(value: string | null | undefined): value is string {
  return Boolean(value?.trim() && GITHUB_REPO_FULL_NAME_RE.test(value.trim()));
}

export function normalizeGitHubRepoInput(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (isGitHubRepoFullName(trimmed)) return `${GITHUB_WEB_ORIGIN}/${trimmed}`;
  return trimmed;
}

export function gitHubFullNameFromInput(value: string): string | null {
  const repoUrl = normalizeGitHubRepoInput(value);
  const match = repoUrl.match(/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/?#].*)?$/i);
  return match ? `${match[1]}/${match[2]}` : null;
}

export function gitHubWebUrlForFullName(fullName: string, path = ''): string {
  return `${GITHUB_WEB_ORIGIN}/${fullName}${suffixPath(path)}`;
}

export function gitHubWebUrlFromInput(value: string, path = ''): string | null {
  const fullName = gitHubFullNameFromInput(value);
  if (fullName) return gitHubWebUrlForFullName(fullName, path);

  const repoUrl = normalizeGitHubRepoInput(value);
  if (!repoUrl || !repoUrl.startsWith(`${GITHUB_WEB_ORIGIN}/`)) return null;
  return `${repoUrl.replace(/\/+$/, '')}${suffixPath(path)}`;
}

export function gitHubApiUrlForFullName(fullName: string, path = ''): string {
  return `${GITHUB_API_ORIGIN}/repos/${fullName}${suffixPath(path)}`;
}
