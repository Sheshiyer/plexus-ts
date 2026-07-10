import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

const closeoutPath = 'docs/evidence/2026-07-10-release-candidate-closeout/README.md';
const deferredPath = 'docs/DEFERRED_REGISTER.md';
const recommendationPath = 'docs/RELEASE_CANDIDATE_RECOMMENDATION.md';
const matrixManifestPath = 'docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix/capture.json';

describe('release candidate closeout packet', () => {
  it('wires the deterministic closeout verifier into verify all', () => {
    const scripts = JSON.parse(source('package.json')).scripts;

    expect(scripts['verify:release-candidate']).toBe('node scripts/verify-release-candidate-closeout.mjs');
    expect(scripts['verify:all']).toContain('npm run verify:release-candidate');

    const verifier = source('scripts/verify-release-candidate-closeout.mjs');
    for (const required of [closeoutPath, deferredPath, recommendationPath, matrixManifestPath]) {
      expect(verifier).toContain(required);
    }
  });

  it('maps every P9 closeout row to an evidence or sync boundary', () => {
    const closeout = source(closeoutPath);

    for (const taskId of [
      'P9-W1-T001',
      'P9-W1-T002',
      'P9-W1-T003',
      'P9-W1-T004',
      'P9-W1-T005',
      'P9-W1-T006',
      'P9-W2-T007',
      'P9-W2-T008',
      'P9-W2-T009',
      'P9-W2-T010',
      'P9-W2-T011',
      'P9-W2-T012',
      'P9-W3-T013',
      'P9-W3-T014',
      'P9-W3-T015',
      'P9-W3-T016',
      'P9-W3-T017',
      'P9-W3-T018',
    ]) {
      expect(closeout).toContain(taskId);
    }

    expect(closeout).toContain('go-with-degraded-live-proof');
    expect(closeout).toContain('npm run verify:all');
    expect(closeout).toContain(matrixManifestPath);
  });

  it('keeps deferred live proof explicit instead of hidden in the release claim', () => {
    const deferred = source(deferredPath);
    const recommendation = source(recommendationPath);

    for (const issue of ['#22', '#23', '#24', '#25', '#26']) {
      expect(deferred).toContain(issue);
    }

    expect(deferred).toContain('signed OTA');
    expect(deferred).toContain('live Paperclip');
    expect(deferred).toContain('SFU');
    expect(recommendation).toContain('Do not call the binary fully production-ready');
  });

  it('anchors the UAT packet to the screenshot matrix manifest', () => {
    const matrix = JSON.parse(source(matrixManifestPath));

    expect(matrix.roadmapRows).toEqual([
      'P7-W3-T019',
      'P7-W3-T020',
      'P7-W3-T021',
      'P7-W3-T022',
      'P7-W3-T023',
      'P7-W3-T024',
    ]);
    expect(matrix.coverage.today).toContain('missing proof');
    expect(matrix.coverage.proofCockpit).toContain('degraded health');
    expect(matrix.coverage.coworking).toContain('SFU degraded');
    expect(matrix.coverage.assistant).toContain('confirm modal');
    expect(matrix.coverage.accessibility).toContain('contrast tokens');
  });
});
