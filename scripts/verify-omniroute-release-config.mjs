#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) {
  console.error(`[verify:omniroute-release] ${message}`);
  process.exitCode = 1;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeSource = readFileSync(path.join(repoRoot, 'src/main/assistant-omniroute.ts'), 'utf8');
const authorityMatch = runtimeSource.match(
  /export const PRODUCTION_OMNIROUTE_RELAY_ORIGIN = '([^']+)';/,
);
const canonicalAuthority = authorityMatch?.[1]?.trim();
const configured = process.env.PLEXUS_OMNIROUTE_RELAY_ORIGIN?.trim();
let authority;
try {
  authority = canonicalAuthority ? new URL(canonicalAuthority) : null;
} catch {
  authority = null;
}

if (
  !canonicalAuthority
  || !authority
  || authority.protocol !== 'https:'
  || canonicalAuthority !== authority.origin
  || authority.pathname !== '/'
  || authority.search
  || authority.hash
) {
  fail('The packaged OmniRoute production authority must be a canonical HTTPS origin.');
} else if (configured) {
  let configuredOrigin;
  try {
    configuredOrigin = new URL(configured);
  } catch {
    configuredOrigin = null;
  }
  if (
    !configuredOrigin
    || configuredOrigin.protocol !== 'https:'
    || configured !== configuredOrigin.origin
    || configuredOrigin.pathname !== '/'
    || configuredOrigin.search
    || configuredOrigin.hash
    || configured !== canonicalAuthority
  ) {
    fail('PLEXUS_OMNIROUTE_RELAY_ORIGIN must exactly match the baked canonical HTTPS production authority.');
  }
}

if (!process.exitCode) {
  console.log('[verify:omniroute-release] Packaged OmniRoute production authority verified.');
}
