import { THOUGHTSEED_GITHUB_INSTALLATION_TARGETS } from './founder-github-setup.js';
import type {
  GitHubConnectionReason,
  GitHubConnectionState,
  GitHubConnectionStatus,
  GitHubConnectionTargetStatus,
  GitHubInstallationTarget,
} from './types.js';

const TARGET_COUNT = THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.length;
const PINNED_TARGETS = new Map<number, GitHubInstallationTarget>(
  THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.map((target) => [target.id, { ...target }]),
);

const EXPECTED_STATUS_BY_REASON: Readonly<Record<GitHubConnectionReason, GitHubConnectionState>> = {
  connected: 'connected',
  repository_scope_all: 'forbidden',
  repository_selection_invalid: 'forbidden',
  permissions_incomplete: 'forbidden',
  installation_suspended: 'suspended',
  installation_revoked: 'forbidden',
  oauth_pending: 'pending',
  trust_anchor_missing: 'forbidden',
  installation_hint_mismatch: 'forbidden',
  ambiguous_installation: 'forbidden',
  not_connected: 'unconfigured',
};

function pinnedTarget(raw: unknown): GitHubInstallationTarget | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === 'number'
    ? value.id
    : typeof value.accountId === 'number' ? value.accountId : value.account_id;
  if (!Number.isSafeInteger(id)) return null;
  const target = PINNED_TARGETS.get(id as number);
  if (!target
    || typeof value.login !== 'string'
    || value.login.toLowerCase() !== target.login.toLowerCase()
    || value.type !== target.type) return null;
  return { ...target };
}

function positiveInstallationId(raw: Record<string, unknown>): number | undefined | null {
  const value = raw.installationId ?? raw.installation_id;
  if (value === undefined || value === null) return undefined;
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function optionalRepositorySelection(raw: Record<string, unknown>): 'selected' | 'all' | undefined | null {
  const value = raw.repositorySelection ?? raw.repository_selection;
  if (value === undefined || value === null) return undefined;
  return value === 'selected' || value === 'all' ? value : null;
}

function failClosedTargets(): GitHubConnectionTargetStatus[] {
  return THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.map((account) => ({
    account: { ...account },
    status: 'forbidden',
    reason: 'not_connected',
  }));
}

export function normalizeGitHubConnectionTargets(raw: unknown): GitHubConnectionTargetStatus[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw) || raw.length !== TARGET_COUNT) return failClosedTargets();

  const targets: GitHubConnectionTargetStatus[] = [];
  const accountIds = new Set<number>();
  for (const candidate of raw) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return failClosedTargets();
    const record = candidate as Record<string, unknown>;
    const account = pinnedTarget(record.account);
    const reason = typeof record.reason === 'string' && record.reason in EXPECTED_STATUS_BY_REASON
      ? record.reason as GitHubConnectionReason
      : null;
    const status = typeof record.status === 'string' ? record.status as GitHubConnectionState : null;
    const installationId = positiveInstallationId(record);
    const repositorySelection = optionalRepositorySelection(record);
    if (!account
      || accountIds.has(account.id)
      || !reason
      || EXPECTED_STATUS_BY_REASON[reason] !== status
      || installationId === null
      || repositorySelection === null) return failClosedTargets();
    accountIds.add(account.id);
    targets.push({
      account,
      status,
      reason,
      ...(installationId ? { installationId } : {}),
      ...(repositorySelection ? { repositorySelection } : {}),
    });
  }

  return accountIds.size === TARGET_COUNT
    && THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.every((target) => accountIds.has(target.id))
    ? targets
    : failClosedTargets();
}

export function githubConnectionOwnerRows(connection: GitHubConnectionStatus | null): GitHubConnectionTargetStatus[] {
  if (connection?.targets !== undefined) {
    return normalizeGitHubConnectionTargets(connection.targets) ?? failClosedTargets();
  }

  const targetIds = new Set(connection?.allowedTargets.map((target) => target.id) ?? []);
  const policyComplete = targetIds.size === TARGET_COUNT
    && THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.every((target) => targetIds.has(target.id));
  const targets = policyComplete ? connection!.allowedTargets : THOUGHTSEED_GITHUB_INSTALLATION_TARGETS;
  return targets.map((account) => {
    const installation = connection?.installations.find((item) => item.account.id === account.id);
    if (!installation) return { account: { ...account }, status: 'unconfigured', reason: 'not_connected' };
    if (installation.status === 'connected') {
      return { account: { ...account }, installationId: installation.installationId, ...(installation.repositorySelection ? { repositorySelection: installation.repositorySelection } : {}), status: 'connected', reason: 'connected' };
    }
    if (installation.status === 'suspended') {
      return { account: { ...account }, installationId: installation.installationId, ...(installation.repositorySelection ? { repositorySelection: installation.repositorySelection } : {}), status: 'suspended', reason: 'installation_suspended' };
    }
    return {
      account: { ...account },
      installationId: installation.installationId,
      ...(installation.repositorySelection ? { repositorySelection: installation.repositorySelection } : {}),
      status: installation.status,
      reason: installation.status === 'pending' ? 'oauth_pending' : 'not_connected',
    };
  });
}

export function githubConnectionOwnerCountLabel(connection: GitHubConnectionStatus | null): string {
  const rows = githubConnectionOwnerRows(connection);
  const connected = rows.filter((target) => target.status === 'connected').length;
  const known = rows.filter((target) => target.installationId !== undefined).length;
  return `${connected} connected · ${known} known · ${rows.length} total`;
}

export function hasConnectedGitHubInstallation(connection: GitHubConnectionStatus | null): boolean {
  return githubConnectionOwnerRows(connection).some((target) => target.status === 'connected' && target.reason === 'connected');
}

export function githubConnectionActionLabel(target: Pick<GitHubConnectionTargetStatus, 'status' | 'reason'>): string {
  if (target.reason === 'connected' && target.status === 'connected') return 'Manage repositories';
  if (target.reason === 'repository_scope_all') return 'Update connection';
  if (target.reason === 'repository_selection_invalid') return 'Repair connection';
  if (target.reason === 'permissions_incomplete') return 'Approve permissions';
  if (target.reason === 'installation_suspended') return 'Review suspension';
  if (target.reason === 'oauth_pending') return 'Continue setup';
  if (target.reason === 'installation_revoked') return 'Reconnect owner';
  if (target.reason === 'trust_anchor_missing'
    || target.reason === 'installation_hint_mismatch'
    || target.reason === 'ambiguous_installation') return 'Repair connection';
  return 'Connect owner';
}

export function githubConnectionReasonGuidance(
  target: Pick<GitHubConnectionTargetStatus, 'account' | 'status' | 'reason' | 'repositorySelection'>,
): string {
  if (target.reason === 'connected' && target.repositorySelection === 'all') return `${target.account.login} grants all repositories through its GitHub App installation.`;
  if (target.reason === 'connected' && target.repositorySelection === 'selected') return `${target.account.login} grants selected repositories through its GitHub App installation.`;
  if (target.reason === 'connected') return `${target.account.login} has installation-scoped repository authority.`;
  if (target.reason === 'repository_scope_all') return 'This Worker version does not support all-repository installations. Update it, then refresh.';
  if (target.reason === 'repository_selection_invalid') return 'The Worker returned an unsupported repository selection. Reconnect this installation.';
  if (target.reason === 'permissions_incomplete') return 'Approve the required GitHub App permissions for this installation, then refresh.';
  if (target.reason === 'installation_suspended') return 'Unsuspend this GitHub App installation before reconnecting it.';
  if (target.reason === 'installation_revoked') return 'This installation was revoked. Reconnect the owner to create fresh authority.';
  if (target.reason === 'oauth_pending') return 'Complete the GitHub browser setup, then return to Plexus.';
  if (target.reason === 'trust_anchor_missing') return 'A fresh signed installation event is required. Re-save repository selection or approve permissions, then refresh.';
  if (target.reason === 'installation_hint_mismatch') return 'The returned installation ID does not match the signed owner installation. Start a fresh connection.';
  if (target.reason === 'ambiguous_installation') return 'More than one installation matches this owner. An administrator must remove the ambiguity.';
  return `Connect ${target.account.login} through the Thoughtseed GitHub App.`;
}
