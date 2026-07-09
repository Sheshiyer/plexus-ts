import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTodaySnapshot } from '../../src/shared/today-snapshot';
import type { AgentSessionScanResult, WorkEvidenceSummary } from '../../src/shared/types';
import { buildProject, buildThoughtseedFabricTask, buildTimeEntry, FIXTURE_NOW } from './fixtures/builders';

function evidenceSummary(patch: Partial<WorkEvidenceSummary> = {}): WorkEvidenceSummary {
  return {
    proofStatus: 'verified',
    totalEntries: 1,
    evidencedEntries: 1,
    missingEvidenceEntries: 0,
    legacyUnverifiedEntries: 0,
    evidencedSeconds: 3600,
    missingEvidenceSeconds: 0,
    projectRepoCoverage: { project_verified: 'verified' },
    ...patch,
  };
}

function agentSessions(patch: Partial<AgentSessionScanResult> = {}): AgentSessionScanResult {
  return {
    ok: true,
    enabled: true,
    scanned: 0,
    imported: 0,
    totalPending: 1,
    matchedPending: 1,
    readyPending: 1,
    candidates: [],
    roots: [],
    ...patch,
  };
}

describe('Today snapshot model', () => {
  it('derives timer, proof, task, and session rollups from plain inputs', () => {
    const snapshot = buildTodaySnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      timerState: {
        running: true,
        entryId: 'entry_running',
        projectId: 'project_verified',
        description: 'Implement Today route',
        activeSeconds: 900,
      },
      entries: [buildTimeEntry()],
      projects: [buildProject()],
      tasks: [buildThoughtseedFabricTask({ status: 'in_progress' })],
      evidenceSummary: evidenceSummary(),
      agentSessionStatus: agentSessions(),
      memberKpi: {
        todaySeconds: 4500,
        weekSeconds: 7200,
        projectBreakdown: { project_verified: 4500 },
        standupCompliant: true,
      },
    });

    expect(snapshot.timer).toMatchObject({
      running: true,
      projectName: 'Verified Project',
      activeSeconds: 900,
    });
    expect(snapshot.totals).toMatchObject({
      trackedSeconds: 3600,
      activeSeconds: 900,
      entryCount: 1,
      projectCount: 1,
      activeTaskCount: 1,
    });
    expect(snapshot.proof.risk).toBe('clear');
    expect(snapshot.standup.state).toBe('ready');
    expect(snapshot.sessions.ready).toBe(1);
    expect(snapshot.nextActions.map((action) => action.id)).toEqual([
      'review-fabric-tasks',
      'convert-clio-memories',
    ]);
  });

  it('prioritizes missing project proof, missing entry proof, and standup work', () => {
    const noProjectProof = buildTodaySnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      timerState: { running: false },
      entries: [],
      projects: [buildProject({
        githubRepoUrl: null,
        githubRepoFullName: null,
        repoVerifiedAt: null,
        repoEvidenceStatus: 'missing',
      })],
      evidenceSummary: evidenceSummary({
        proofStatus: 'pending',
        totalEntries: 0,
        evidencedEntries: 0,
        evidencedSeconds: 0,
      }),
    });
    expect(noProjectProof.proof.risk).toBe('needs_project');
    expect(noProjectProof.nextActions[0]).toMatchObject({
      id: 'link-project-proof',
      routeKey: 'projects',
    });

    const missingEntryProof = buildTodaySnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      timerState: { running: false },
      entries: [buildTimeEntry({ evidenceStatus: 'missing', githubActivityIds: [] })],
      projects: [buildProject()],
      evidenceSummary: evidenceSummary({
        proofStatus: 'missing',
        evidencedEntries: 0,
        missingEvidenceEntries: 1,
        evidencedSeconds: 0,
        missingEvidenceSeconds: 3600,
      }),
      memberKpi: {
        todaySeconds: 3600,
        weekSeconds: 3600,
        projectBreakdown: { project_verified: 3600 },
        standupCompliant: false,
      },
    });
    expect(missingEntryProof.proof.risk).toBe('needs_evidence');
    expect(missingEntryProof.nextActions.map((action) => action.id)).toContain('repair-missing-proof');
    expect(missingEntryProof.nextActions.map((action) => action.id)).toContain('prepare-daily-proof');
  });

  it('does not import renderer, Electron, filesystem, or browser globals', () => {
    const sourcePath = fileURLToPath(new URL('../../src/shared/today-snapshot.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|\bnavigator\b|\bWorker\b/);
    expect(source).not.toMatch(/\bipcRenderer\b|\bipcMain\b|from ['"]electron['"]/);
    expect(source).not.toMatch(/from ['"]node:/);
  });
});
