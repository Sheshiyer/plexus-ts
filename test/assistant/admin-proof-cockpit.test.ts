import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildAdminProofCockpitSnapshot } from '../../src/shared/admin-proof-cockpit';
import type { AdminDemoOverview, ProofCustodyRecord, Session, WorkEvidenceSummary } from '../../src/shared/types';
import { buildProject, buildThoughtseedBridgeStatus, buildThoughtseedFabricTask, FIXTURE_NOW } from './fixtures/builders';

const adminSession: Session = {
  identityId: 'admin_1',
  employeeId: null,
  email: 'founder@example.com',
  displayName: 'Founder',
  role: 'admin',
  workspaceId: 'workspace_1',
  projectVisibility: 'all',
  onboarding: { completed: true, requiredComplete: true, steps: [] },
  signedInAt: FIXTURE_NOW,
};

const overview: AdminDemoOverview = {
  workspaceId: 'workspace_1',
  viewer: {
    identityId: 'admin_1',
    email: 'founder@example.com',
    displayName: 'Founder',
    role: 'admin',
    workspaceId: 'workspace_1',
    projectVisibility: 'all',
    onboarding: { completed: true, requiredComplete: true, steps: [] },
    access: true,
  },
  projects: [],
  identities: [
    {
      identityId: 'employee_1',
      employeeId: 'employee_1',
      email: 'employee@example.com',
      displayName: 'Employee',
      role: 'employee',
      projectVisibility: 'assigned',
      capabilities: {},
      onboarding: {
        steps: [
          { stepId: 'profile', label: 'Profile', requirement: 'required', state: 'completed', updatedAt: FIXTURE_NOW },
          { stepId: 'repo', label: 'Repo', requirement: 'required', state: 'pending', updatedAt: FIXTURE_NOW },
        ],
      },
    },
  ],
};

function evidenceSummary(patch: Partial<WorkEvidenceSummary> = {}): WorkEvidenceSummary {
  return {
    proofStatus: 'partial',
    totalEntries: 2,
    evidencedEntries: 1,
    missingEvidenceEntries: 1,
    legacyUnverifiedEntries: 0,
    evidencedSeconds: 3600,
    missingEvidenceSeconds: 1800,
    projectRepoCoverage: {
      project_verified: 'verified',
      project_missing: 'missing',
      project_inaccessible: 'inaccessible',
    },
    ...patch,
  };
}

function custody(patch: Partial<ProofCustodyRecord> = {}): ProofCustodyRecord {
  return {
    id: 'proof_1',
    subjectType: 'daily_report',
    subjectId: '2026-07-01',
    proofStatus: 'verified',
    evidenceType: 'report',
    strength: 'verified_evidence',
    artifactRef: null,
    payloadHash: 'hash_1',
    payload: {},
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
    ...patch,
  };
}

describe('admin proof cockpit model', () => {
  it('derives the six founder signal domains and task proof counts', () => {
    const snapshot = buildAdminProofCockpitSnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      session: adminSession,
      overview,
      projects: [
        buildProject(),
        buildProject({ id: 'project_missing', githubRepoUrl: null, githubRepoFullName: null, repoVerifiedAt: null, repoEvidenceStatus: 'missing' }),
        buildProject({ id: 'project_inaccessible', repoEvidenceStatus: 'inaccessible' }),
      ],
      tasks: [
        buildThoughtseedFabricTask({ taskId: 'assigned_1', status: 'assigned', proofStatus: 'pending', evidence: [], evidenceStrength: 'weak_evidence' }),
        buildThoughtseedFabricTask({ taskId: 'active_1', status: 'in_progress', proofStatus: 'partial', evidence: [{ type: 'note', value: 'WIP', strength: 'weak_evidence', addedAt: FIXTURE_NOW }] }),
        buildThoughtseedFabricTask({ taskId: 'blocked_1', status: 'blocked', proofStatus: 'missing', evidence: [] }),
        buildThoughtseedFabricTask({ taskId: 'done_1', status: 'done', proofStatus: 'verified', evidence: [{ type: 'github_commit', value: 'abc', strength: 'verified_evidence', addedAt: FIXTURE_NOW }], evidenceStrength: 'verified_evidence' }),
        buildThoughtseedFabricTask({ taskId: 'done_missing_1', status: 'done', proofStatus: 'missing', evidence: [] }),
      ],
      evidenceSummary: evidenceSummary(),
      proofCustodyRecords: [
        custody({ subjectType: 'fabric_task', proofStatus: 'missing', updatedAt: '2026-07-01T10:00:00.000Z' }),
        custody({ subjectType: 'assistant_daily_event', proofStatus: 'partial', updatedAt: '2026-07-01T09:30:00.000Z' }),
        custody({ proofStatus: 'verified', updatedAt: '2026-07-01T09:00:00.000Z' }),
      ],
      bridgeStatus: buildThoughtseedBridgeStatus(),
      releaseEvidenceReady: true,
    });

    expect(Object.keys(snapshot.signals)).toEqual([
      'tasksEvidence',
      'activeRooms',
      'blockers',
      'reports',
      'bridgeHealth',
      'releaseHealth',
    ]);
    expect(snapshot.tasksEvidence).toMatchObject({
      assigned: 1,
      active: 1,
      blocked: 1,
      done: 2,
      verified: 1,
      weak: 1,
      missingProof: 2,
      total: 5,
    });
    expect(snapshot.reports.latestStatus).toBe('partial');
    expect(snapshot.blockers.syncFailures).toBe(0);
    expect(snapshot.projectGroups.map((group) => [group.key, group.count])).toEqual([
      ['verified', 1],
      ['needs_repo', 1],
      ['inaccessible', 1],
      ['missing_proof', 0],
    ]);
    expect(snapshot.signals.bridgeHealth.value).toBe('connected');
  });

  it('keeps sync failures single-counted and degrades bridge/release honestly', () => {
    const snapshot = buildAdminProofCockpitSnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      session: adminSession,
      projects: [buildProject()],
      evidenceSummary: evidenceSummary({
        proofStatus: 'sync_failed',
        missingEvidenceEntries: 3,
        legacyUnverifiedEntries: 1,
      }),
      bridgeStatus: buildThoughtseedBridgeStatus({ connected: false, configured: true, lastError: 'Bridge timeout' }),
      releaseEvidenceReady: false,
    });

    expect(snapshot.blockers).toMatchObject({
      syncFailures: 1,
      missingEvidence: 4,
    });
    expect(snapshot.signals.bridgeHealth).toMatchObject({
      state: 'attention',
      value: 'degraded',
    });
    expect(snapshot.signals.releaseHealth).toMatchObject({
      state: 'manual',
      value: 'manual',
    });
  });

  it('does not import renderer, Electron, filesystem, or browser globals', () => {
    const sourcePath = fileURLToPath(new URL('../../src/shared/admin-proof-cockpit.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|\bnavigator\b|\bWorker\b/);
    expect(source).not.toMatch(/\bipcRenderer\b|\bipcMain\b|from ['"]electron['"]/);
    expect(source).not.toMatch(/from ['"]node:/);
  });
});
