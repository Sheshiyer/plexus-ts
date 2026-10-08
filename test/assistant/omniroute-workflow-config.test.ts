import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

const variableMapping = 'PLEXUS_OMNIROUTE_RELAY_ORIGIN: ${{ vars.PLEXUS_OMNIROUTE_RELAY_ORIGIN }}';
const gatedCommand = /^\s*run: npm run (?:smoke:all|release:dry-run|release:mac|build|dist|smoke:packaged-(?:main|renderer))\s*$/m;

describe('OmniRoute retired workflow policy baseline', () => {
  it('maps the non-secret relay variable on every gated CI and release step', () => {
    const workflowPaths = [
      'test/fixtures/retired-workflows/ci.yml',
      'test/fixtures/retired-workflows/release.yml',
      'test/fixtures/retired-workflows/publish-ota.yml',
    ];
    const gatedSteps = workflowPaths.flatMap((workflowPath) => source(workflowPath)
      .split(/(?=      - name: )/)
      .filter((step) => gatedCommand.test(step))
      .map((step) => ({ workflowPath, step })));

    expect(gatedSteps).toHaveLength(5);
    for (const { workflowPath, step } of gatedSteps) {
      expect(step, `${workflowPath}: ${step.match(/- name: (.+)/)?.[1] ?? 'unnamed step'}`).toContain(variableMapping);
    }
  });

  it('keeps workflow configuration optional and rejects a mismatched repository authority', () => {
    const workflows = [
      source('test/fixtures/retired-workflows/ci.yml'),
      source('test/fixtures/retired-workflows/release.yml'),
      source('test/fixtures/retired-workflows/publish-ota.yml'),
    ].join('\n');
    const verifier = source('scripts/verify-omniroute-release-config.mjs');

    expect(workflows).not.toMatch(/PLEXUS_OMNIROUTE_RELAY_ORIGIN:\s*https?:/);
    expect(workflows).not.toContain('vars.PLEXUS_OMNIROUTE_RELAY_ORIGIN ||');
    expect(verifier).toContain('PRODUCTION_OMNIROUTE_RELAY_ORIGIN');
    expect(verifier).toContain('configured !== canonicalAuthority');
    expect(verifier).toContain('process.exitCode = 1');
  });
});
