#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (key.toLowerCase() === 'npm_config_allow_scripts') {
    delete env[key];
  }
}

// Electron and electron-builder are devDependencies for npm installation
// semantics, but both participate in the shipped binary. The release gate must
// therefore audit the complete lockfile rather than production dependencies
// alone.
const auditArgs = ['audit', '--audit-level=high'];
const npmExecPath = process.env.npm_execpath;
const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
const args = npmExecPath ? [npmExecPath, ...auditArgs] : auditArgs;

const result = spawnSync(command, args, {
  env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[security:audit:release] ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
