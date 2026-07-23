import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatedGitHubOAuthAuthorizeUrl } from '../../src/main/github-oauth-authorization';

const workerBaseUrl = 'https://plexus-api.thoughtseed.space';
const clientId = 'Iv1.0123456789abcdef';
const state = `${'a'.repeat(64)}.${'b'.repeat(43)}`;

function authorizeUrl(
  overrides: Partial<Record<'client_id' | 'redirect_uri' | 'state' | 'scope' | 'login' | 'allow_signup' | 'prompt' | 'code_challenge' | 'code_challenge_method', string>> = {},
): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', overrides.client_id ?? clientId);
  url.searchParams.set('redirect_uri', overrides.redirect_uri ?? `${workerBaseUrl}/v1/github/callback`);
  url.searchParams.set('state', overrides.state ?? state);
  for (const key of ['scope', 'login', 'allow_signup', 'prompt', 'code_challenge', 'code_challenge_method'] as const) {
    if (overrides[key] !== undefined) url.searchParams.set(key, overrides[key]!);
  }
  return url.toString();
}

describe('main-process GitHub OAuth authorization custody', () => {
  it('accepts only the exact GitHub OAuth path and Worker callback origin', () => {
    const valid = authorizeUrl();
    expect(validatedGitHubOAuthAuthorizeUrl(valid, workerBaseUrl)).toBe(valid);
  });

  it('accepts documented optional OAuth parameters with bounded values', () => {
    const valid = authorizeUrl({
      scope: 'read:user repo',
      login: 'Sheshiyer',
      allow_signup: 'false',
      prompt: 'select_account',
      code_challenge: 'c'.repeat(43),
      code_challenge_method: 'S256',
    });
    expect(validatedGitHubOAuthAuthorizeUrl(valid, workerBaseUrl)).toBe(valid);
  });

  it.each([
    ['wrong host', authorizeUrl().replace('github.com', 'github.example')],
    ['host suffix', authorizeUrl().replace('github.com', 'github.com.example')],
    ['wrong path', authorizeUrl().replace('/login/oauth/authorize', '/apps/install')],
    ['credentials', authorizeUrl().replace('https://', 'https://user:secret@')],
    ['explicit port', authorizeUrl().replace('github.com', 'github.com:443')],
    ['fragment', `${authorizeUrl()}#state`],
    ['wrong callback origin', authorizeUrl({ redirect_uri: 'https://attacker.example/v1/github/callback' })],
    ['wrong callback path', authorizeUrl({ redirect_uri: `${workerBaseUrl}/v1/github/callback/extra` })],
    ['callback query', authorizeUrl({ redirect_uri: `${workerBaseUrl}/v1/github/callback?next=attacker` })],
    ['short client id', authorizeUrl({ client_id: 'short' })],
    ['unsigned state', authorizeUrl({ state: 'not-signed' })],
  ])('rejects %s', (_label, candidate) => {
    expect(validatedGitHubOAuthAuthorizeUrl(candidate, workerBaseUrl)).toBeNull();
  });

  it('rejects missing, duplicate, unknown, and malformed query parameters', () => {
    const missing = new URL(authorizeUrl());
    missing.searchParams.delete('state');
    const duplicate = new URL(authorizeUrl());
    duplicate.searchParams.append('state', state);
    const extra = new URL(authorizeUrl());
    extra.searchParams.set('unexpected', 'value');
    const malformedScope = new URL(authorizeUrl({ scope: 'repo\nadmin' }));
    const incompletePkce = new URL(authorizeUrl({ code_challenge: 'c'.repeat(43) }));
    const duplicateOptional = new URL(authorizeUrl({ scope: 'repo' }));
    duplicateOptional.searchParams.append('scope', 'repo');

    expect(validatedGitHubOAuthAuthorizeUrl(missing.toString(), workerBaseUrl)).toBeNull();
    expect(validatedGitHubOAuthAuthorizeUrl(duplicate.toString(), workerBaseUrl)).toBeNull();
    expect(validatedGitHubOAuthAuthorizeUrl(extra.toString(), workerBaseUrl)).toBeNull();
    expect(validatedGitHubOAuthAuthorizeUrl(malformedScope.toString(), workerBaseUrl)).toBeNull();
    expect(validatedGitHubOAuthAuthorizeUrl(incompletePkce.toString(), workerBaseUrl)).toBeNull();
    expect(validatedGitHubOAuthAuthorizeUrl(duplicateOptional.toString(), workerBaseUrl)).toBeNull();
  });

  it('opens OAuth only in main and removes state URLs from renderer-facing results', () => {
    const main = readFileSync(path.resolve(process.cwd(), 'src/main/main.ts'), 'utf8');
    const preload = readFileSync(path.resolve(process.cwd(), 'src/preload/preload.ts'), 'utf8');
    const renderer = readFileSync(path.resolve(process.cwd(), 'src/renderer/components/Settings.tsx'), 'utf8');
    const types = readFileSync(path.resolve(process.cwd(), 'src/shared/types.ts'), 'utf8');

    expect(main.match(/await shell\.openExternal\(authorizeUrl\)/g)).toHaveLength(1);
    expect(main.match(/authorizeUrl: rawAuthorizeUrl, \.\.\.rendererResult/g)).toHaveLength(2);
    expect(main).toContain('async function openWorkerGitHubOAuth(rawAuthorizeUrl: unknown)');
    expect(main.match(/await openWorkerGitHubOAuth\(rawAuthorizeUrl\)/g)).toHaveLength(2);
    expect(renderer).not.toContain('result.authorizeUrl');
    expect(renderer).not.toContain("window.open(result");
    expect(preload).not.toContain('authorizeUrl');

    const connectResult = types.slice(
      types.indexOf('export interface GitHubConnectStartResult'),
      types.indexOf('export type GitHubActorState'),
    );
    const actorResult = types.slice(
      types.indexOf('export interface GitHubActorEnrollStartResult'),
      types.indexOf('export interface FounderGitHubSetupIntent'),
    );
    expect(connectResult).not.toContain('authorizeUrl');
    expect(actorResult).not.toContain('authorizeUrl');
  });
});
