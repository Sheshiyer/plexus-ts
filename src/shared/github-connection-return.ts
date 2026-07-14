import type { GitHubConnectionReturnIntent, GitHubConnectionState, GitHubConnectionStatus } from './types.js';
import { THOUGHTSEED_GITHUB_INSTALLATION_TARGETS } from './founder-github-setup.js';

export const GITHUB_CONNECTION_RETURN_URL_PREFIX = 'plexus://github/connection/v1';

const PINNED_GITHUB_ACCOUNT_IDS = new Set<number>(
  THOUGHTSEED_GITHUB_INSTALLATION_TARGETS.map((target) => target.id),
);

export function isGitHubConnectionReturnIntent(value: unknown): value is GitHubConnectionReturnIntent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return keys.length === 2
    && keys[0] === 'accountId'
    && keys[1] === 'version'
    && record.version === 1
    && Number.isSafeInteger(record.accountId)
    && PINNED_GITHUB_ACCOUNT_IDS.has(record.accountId as number);
}

export function githubConnectionReturnIntent(value: unknown): GitHubConnectionReturnIntent | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'plexus:'
      || parsed.hostname !== 'github'
      || parsed.username !== ''
      || parsed.password !== ''
      || parsed.port !== ''
      || parsed.search !== ''
      || parsed.hash !== '') return null;
    const match = /^\/connection\/v1\/([1-9]\d*)$/.exec(parsed.pathname);
    if (!match) return null;
    const intent = { version: 1, accountId: Number(match[1]) } as const;
    return isGitHubConnectionReturnIntent(intent)
      && value === `${GITHUB_CONNECTION_RETURN_URL_PREFIX}/${intent.accountId}`
      ? intent
      : null;
  } catch {
    return null;
  }
}

export function argvGitHubConnectionReturnIntent(argv: readonly string[]): GitHubConnectionReturnIntent | null {
  const intents = argv.flatMap((value) => {
    const intent = githubConnectionReturnIntent(value);
    return intent ? [intent] : [];
  });
  return intents.length === 1 ? intents[0] : null;
}

export function terminalGitHubConnectionStateForTarget(
  connection: GitHubConnectionStatus,
  accountId: number,
): Extract<GitHubConnectionState, 'connected' | 'suspended' | 'forbidden'> | null {
  const status = connection.installations.find((installation) => installation.account.id === accountId)?.status;
  return status === 'connected' || status === 'suspended' || status === 'forbidden' ? status : null;
}

type TerminalGitHubConnectionState = Extract<GitHubConnectionState, 'connected' | 'suspended' | 'forbidden'>;

export interface GitHubConnectionTargetPollOptions {
  accountId: number;
  intervalMs: number;
  timeoutMs: number;
  load: () => Promise<GitHubConnectionStatus>;
  onStatus: (connection: GitHubConnectionStatus) => void;
  onTerminal: (status: TerminalGitHubConnectionState, connection: GitHubConnectionStatus) => void;
  onTimeout: () => void;
}

export function startGitHubConnectionTargetPoll(options: GitHubConnectionTargetPollOptions): () => void {
  let cancelled = false;
  let finished = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutTimer = setTimeout(() => {
    if (cancelled || finished) return;
    finished = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    options.onTimeout();
  }, options.timeoutMs);

  const poll = async () => {
    const connection = await options.load().catch(() => null);
    if (cancelled || finished) return;
    if (connection) {
      options.onStatus(connection);
      const terminal = terminalGitHubConnectionStateForTarget(connection, options.accountId);
      if (terminal) {
        finished = true;
        clearTimeout(timeoutTimer);
        options.onTerminal(terminal, connection);
        return;
      }
    }
    timer = setTimeout(() => { void poll(); }, options.intervalMs);
  };

  void poll();
  return () => {
    cancelled = true;
    clearTimeout(timeoutTimer);
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
}
