import { describe, expect, it } from 'vitest';
import { computeEvidenceSummary } from '../../src/main/evidence';
import { buildProject, buildTimeEntry } from './fixtures/builders';

describe('proof status rollups', () => {
  it('marks all matched work as verified', () => {
    const summary = computeEvidenceSummary([
      buildTimeEntry({ id: 'entry_1', evidenceStatus: 'matched' }),
      buildTimeEntry({ id: 'entry_2', evidenceStatus: 'matched' }),
    ], [buildProject()]);

    expect(summary.proofStatus).toBe('verified');
  });

  it('marks mixed matched and missing work as partial', () => {
    const summary = computeEvidenceSummary([
      buildTimeEntry({ id: 'entry_1', evidenceStatus: 'matched' }),
      buildTimeEntry({ id: 'entry_2', evidenceStatus: 'missing' }),
    ], [buildProject()]);

    expect(summary.proofStatus).toBe('partial');
  });

  it('keeps sync failures distinct from ordinary missing proof', () => {
    const summary = computeEvidenceSummary([
      buildTimeEntry({ id: 'entry_1', evidenceStatus: 'sync_failed' }),
    ], [buildProject()]);

    expect(summary.proofStatus).toBe('sync_failed');
    expect(summary.missingEvidenceEntries).toBe(1);
  });

  it('marks empty work as pending', () => {
    const summary = computeEvidenceSummary([], [buildProject()]);

    expect(summary.proofStatus).toBe('pending');
  });
});
