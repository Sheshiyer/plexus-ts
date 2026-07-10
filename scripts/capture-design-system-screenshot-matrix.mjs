import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const evidenceRoot = process.env.PLEXUS_SCREENSHOT_MATRIX_EVIDENCE_DIR
  ? path.resolve(process.env.PLEXUS_SCREENSHOT_MATRIX_EVIDENCE_DIR)
  : path.join(root, 'docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix');

const jobs = [
  {
    id: 'today-matrix',
    label: 'Today screenshot matrix',
    script: 'scripts/capture-today-screenshot-matrix.mjs',
    output: 'today-matrix',
    envKey: 'PLEXUS_TODAY_MATRIX_EVIDENCE_DIR',
    viewports: ['1536x1024', '1280x800', '1040x700'],
    states: ['idle', 'running', 'long text', 'degraded assistant', 'missing proof'],
  },
  {
    id: 'proof-cockpit',
    label: 'Admin proof cockpit matrix',
    script: 'scripts/capture-admin-proof-cockpit.mjs',
    output: 'proof-cockpit',
    envKey: 'PLEXUS_ADMIN_PROOF_EVIDENCE_DIR',
    viewports: ['1536x1024', '1280x800'],
    states: ['overview', 'long identities', 'degraded health', 'blocker states'],
  },
  {
    id: 'coworking-stage',
    label: 'Co-working floor/stage/lounge matrix',
    script: 'scripts/capture-coworking-stage.mjs',
    output: 'coworking-stage',
    envKey: 'PLEXUS_COWORKING_STAGE_EVIDENCE_DIR',
    viewports: ['1536x1024', '1366x768', '1040x700'],
    states: ['floor', 'stage', 'lounge', 'pinned fullscreen'],
  },
  {
    id: 'coworking-degraded',
    label: 'Co-working permission/SFU degraded matrix',
    script: 'scripts/capture-coworking-media-consent-degraded.mjs',
    output: 'coworking-degraded',
    envKey: 'PLEXUS_COWORKING_BATCH21_EVIDENCE_DIR',
    viewports: ['1366x768', '1040x700'],
    states: ['permission denied', 'SFU unavailable', 'rooms offline'],
  },
  {
    id: 'assistant-matrix',
    label: 'Clio assistant screenshot matrix',
    script: 'scripts/capture-assistant-screenshot-matrix.mjs',
    output: 'assistant-matrix',
    envKey: 'PLEXUS_ASSISTANT_MATRIX_EVIDENCE_DIR',
    viewports: ['1536x1024', '1280x800', '1040x700'],
    states: ['full Clio panel', 'sidechat', 'confirm modal', 'context drawer'],
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
      PLEXUS_SCREENSHOT_PORT: String(5230 + index),
      PLEXUS_CHROME_DEBUG_PORT: String(9380 + index),
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
  roadmapRows: ['P7-W3-T019', 'P7-W3-T020', 'P7-W3-T021', 'P7-W3-T022', 'P7-W3-T023', 'P7-W3-T024'],
  coverage: {
    today: ['idle', 'running', 'long text', 'degraded assistant', 'missing proof'],
    proofCockpit: ['admin overview', 'long identities', 'degraded health', 'blocker states'],
    coworking: ['floor', 'stage', 'lounge', 'pinned fullscreen', 'permission denied', 'SFU degraded'],
    assistant: ['full Clio panel', 'sidechat', 'confirm modal', 'context drawer'],
    accessibility: ['keyboard path', 'focus rings', 'reduced motion', 'contrast tokens'],
  },
  runs,
};

writeFileSync(path.join(evidenceRoot, 'capture.json'), `${JSON.stringify(manifest, null, 2)}\n`);
writeFileSync(path.join(evidenceRoot, 'README.md'), `# Batch30 Design-System Screenshot Matrix

Captured on ${manifest.capturedAt} with \`npm run capture:design-system:matrix\`.

## Coverage

- Today matrix: idle, running, long text, degraded assistant, and missing-proof captures in \`today-matrix/\`.
- Proof cockpit matrix: overview, reports/export handoff, diagnostics, long identities, degraded health, and blocker-state captures in \`proof-cockpit/\`.
- Co-working matrix: floor, stage, lounge, pinned fullscreen, permission-denied, SFU-unavailable, and rooms-offline captures in \`coworking-stage/\` and \`coworking-degraded/\`.
- Clio assistant matrix: settings panel, sidechat, confirmation modal, and context drawer captures in \`assistant-matrix/\`.
- Accessibility pass: keyboard/focus/reduced-motion/contrast contracts are pinned by \`test/renderer/design-system-screenshot-matrix-contract.test.tsx\`.

See \`capture.json\` for generated files, viewport coverage, state coverage, and roadmap row mapping.
`);
