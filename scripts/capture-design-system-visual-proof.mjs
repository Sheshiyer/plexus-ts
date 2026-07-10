import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evidenceRoot = process.env.PLEXUS_DESIGN_SYSTEM_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_DESIGN_SYSTEM_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-batch29-design-system-visual-proof');

const jobs = [
  {
    id: 'today',
    label: 'Clio Today density',
    script: 'scripts/capture-today-command-center.mjs',
    output: 'today',
    envKey: 'PLEXUS_TODAY_EVIDENCE_DIR',
    viewports: ['1536x1024', '1040x700'],
    states: ['founder update', 'missing proof', 'verified project'],
  },
  {
    id: 'proof-cockpit',
    label: 'Admin proof cockpit density',
    script: 'scripts/capture-admin-proof-cockpit.mjs',
    output: 'proof-cockpit',
    envKey: 'PLEXUS_ADMIN_PROOF_EVIDENCE_DIR',
    viewports: ['1536x1024', '1280x800'],
    states: ['overview', 'reports handoff', 'export handoff', 'diagnostics', 'long identity'],
  },
  {
    id: 'coworking-stage',
    label: 'Co-working social floor',
    script: 'scripts/capture-coworking-stage.mjs',
    output: 'coworking-stage',
    envKey: 'PLEXUS_COWORKING_STAGE_EVIDENCE_DIR',
    viewports: ['1536x1024', '1366x768', '1040x700'],
    states: ['floor', 'stage', 'pinned fullscreen', 'closeout proof'],
  },
  {
    id: 'coworking-degraded',
    label: 'Co-working media and degraded states',
    script: 'scripts/capture-coworking-media-consent-degraded.mjs',
    output: 'coworking-degraded',
    envKey: 'PLEXUS_COWORKING_BATCH21_EVIDENCE_DIR',
    viewports: ['1366x768', '1040x700'],
    states: ['permission denied', 'sfu unavailable', 'rooms offline', 'independent degraded states'],
  },
];

function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function outputFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => /\.(json|md|png)$/.test(file))
    .sort()
    .map((file) => {
      const fullPath = path.join(dir, file);
      return {
        file,
        bytes: statSync(fullPath).size,
      };
    });
}

function runJob(job, index) {
  const outputDir = path.join(evidenceRoot, job.output);
  resetDir(outputDir);

  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [job.script], {
    cwd: root,
    env: {
      ...process.env,
      [job.envKey]: outputDir,
      PLEXUS_SCREENSHOT_PORT: String(5190 + index),
      PLEXUS_CHROME_DEBUG_PORT: String(9340 + index),
    },
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`${job.label} capture failed with exit code ${result.status ?? 'signal'}`);
  }

  return {
    id: job.id,
    label: job.label,
    script: job.script,
    output: path.relative(root, outputDir),
    envKey: job.envKey,
    durationMs: Date.now() - startedAt,
    viewports: job.viewports,
    states: job.states,
    files: outputFiles(outputDir),
  };
}

mkdirSync(evidenceRoot, { recursive: true });

const runs = jobs.map((job, index) => runJob(job, index));
const manifest = {
  capturedAt: new Date().toISOString(),
  evidenceRoot: path.relative(root, evidenceRoot),
  coverage: {
    viewports: ['1536x1024', '1280x800', '1040x700', 'sidechat CSS contract'],
    surfaces: ['Clio Today', 'Admin proof cockpit', 'Co-working stage', 'Co-working degraded states'],
    emptyStateVariants: ['no-records', 'no-rooms', 'no-backups', 'no-tasks'],
    degradedStateVariants: ['offline', 'sync-failed', 'repo-missing', 'proof-inaccessible'],
    roseToneBoundary: 'Rose is reserved for true failure, denial, inaccessible proof, or destructive confirmation.',
  },
  runs,
};

writeFileSync(path.join(evidenceRoot, 'capture.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(path.join(evidenceRoot, 'README.md'), `# Batch29 Design-System Visual Proof

Captured on ${manifest.capturedAt} with \`npm run capture:design-system\`.

## Coverage

- Today density: repeatable 1536x1024 and 1040x700 captures in \`today/\`.
- Proof cockpit density: 1536x1024 overview plus 1280x800 reports, export, diagnostics, and long-identity captures in \`proof-cockpit/\`.
- Co-working social floor: floor, stage, pinned fullscreen, live-boundary, compact, and closeout captures in \`coworking-stage/\`.
- Degraded co-working states: permission denied, SFU unavailable, rooms offline, and independent degraded-state captures in \`coworking-degraded/\`.
- Sidechat and breakpoint behavior is pinned by renderer contracts for 1280px, 1040px, and the \`.px-shell.with-sidechat\` / \`.px-main.sidechat-open\` layout guards.

## Variant Contract

- Empty states: no records, no rooms, no backups, and no tasks.
- Degraded states: offline, sync failed, repo missing, and proof inaccessible.
- Rose tone remains reserved for true failure, denial, inaccessible proof, or destructive confirmation; missing repo and offline states use warning/idle treatment.

See \`capture.json\` for command outputs, generated files, viewport coverage, and state coverage.
`);
