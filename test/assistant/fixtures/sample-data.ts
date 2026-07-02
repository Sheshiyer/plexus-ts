import {
  buildAgentSessionCandidate,
  buildGitHubActivity,
  buildProject,
  buildThoughtseedBridgeStatus,
  buildTimeEntry,
} from './builders';

export const verifiedProject = buildProject();

export const missingEvidenceProject = buildProject({
  id: 'project_missing',
  name: 'Missing Evidence Project',
  githubRepoUrl: null,
  githubRepoFullName: null,
  githubRepoId: null,
  repoVerifiedAt: null,
  repoEvidenceStatus: 'missing',
  evidenceStatus: 'missing',
});

export const assistantTimeEntry = buildTimeEntry();
export const assistantGitHubActivity = buildGitHubActivity();

export const providerSessionCandidates = [
  buildAgentSessionCandidate({ provider: 'codex' }),
  buildAgentSessionCandidate({ provider: 'claude' }),
  buildAgentSessionCandidate({ provider: 'cursor' }),
  buildAgentSessionCandidate({ provider: 'opencode' }),
];

export const connectedBridgeStatus = buildThoughtseedBridgeStatus();
