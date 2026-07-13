import type { GitHubCiEvidence, GitHubCiEvidenceBatch, ProofCustodyRecord, ProofStatus } from '../shared/types.js';
import { upsertProofCustodyRecord } from '../db/database.js';

const FAILING_CONCLUSIONS = new Set<NonNullable<GitHubCiEvidence['conclusion']>>([
  'failure', 'cancelled', 'timed_out', 'action_required', 'stale', 'startup_failure',
]);

function ciProofStatus(item: GitHubCiEvidence): ProofStatus {
  if (item.status !== 'completed' || item.conclusion === null) return 'pending';
  if (item.conclusion === 'success') return 'verified';
  return FAILING_CONCLUSIONS.has(item.conclusion) ? 'missing' : 'partial';
}

export function summarizeGitHubCiEvidence(batch: GitHubCiEvidenceBatch): {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  conclusion: 'success' | 'failure' | 'pending' | 'partial' | 'none';
} {
  const successful = batch.items.filter((item) => ciProofStatus(item) === 'verified').length;
  const failed = batch.items.filter((item) => ciProofStatus(item) === 'missing').length;
  const pending = batch.items.length - successful - failed;
  return {
    total: batch.items.length,
    successful,
    failed,
    pending,
    conclusion: batch.truncated ? 'partial' : failed > 0 ? 'failure' : pending > 0 ? 'pending' : successful > 0 ? 'success' : 'none',
  };
}

export async function persistGitHubCiEvidence(
  projectId: string,
  batch: GitHubCiEvidenceBatch,
  checkedAt = new Date().toISOString(),
): Promise<ProofCustodyRecord[]> {
  const summary = summarizeGitHubCiEvidence(batch);
  const records: ProofCustodyRecord[] = [];
  records.push(await upsertProofCustodyRecord({
    subjectType: 'project',
    subjectId: projectId,
    proofStatus: batch.truncated ? 'partial' : summary.failed > 0 ? 'missing' : summary.pending > 0 ? 'partial' : summary.total === 0 ? 'pending' : 'verified',
    evidenceType: 'github_ci_summary',
    payload: {
      evidenceClass: 'ci',
      ...summary,
      truncated: batch.truncated,
      checkedShas: batch.checkedShas,
      checkedAt,
    },
    createdAt: checkedAt,
    updatedAt: checkedAt,
  }));
  for (const item of batch.items) {
    records.push(await upsertProofCustodyRecord({
      subjectType: 'project',
      subjectId: projectId,
      proofStatus: ciProofStatus(item),
      evidenceType: item.evidenceType === 'workflow_run' ? 'github_workflow_run' : 'github_check_run',
      strength: 'verified_evidence',
      artifactRef: item.url,
      payload: { ...item },
      createdAt: item.occurredAt,
      updatedAt: checkedAt,
    }));
  }
  return records;
}
