#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (key.toLowerCase() === 'npm_config_allow_scripts') {
    delete env[key];
  }
}

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmBin, ['audit', '--omit=dev', '--audit-level=high'], {
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[security:audit:prod] ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
