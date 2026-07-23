import type { AssistantContextSources } from '../../../src/main/assistant-context';
import type { AgentSessionScanResult, UpdateStatus } from '../../../src/shared/types';
import { buildThoughtseedFabricTask } from './builders';
import {
  assistantGitHubActivity,
  connectedBridgeStatus,
  missingEvidenceProject,
  providerSessionCandidates,
  verifiedProject,
  assistantTimeEntry,
} from './sample-data';

const updateStatus: UpdateStatus = {
  state: 'idle',
  currentVersion: '0.4.5',
  channel: 'latest',
  updatedAt: '2026-07-01T09:00:00.000Z',
  canCheck: true,
  canDownload: false,
  canInstall: false,
  message: 'Ready.',
};

export function buildContextSources(patch: Partial<AssistantContextSources> = {}): AssistantContextSources {
  const sources: AssistantContextSources = {
    async listProjects() {
      return [verifiedProject, missingEvidenceProject];
    },
    async listEntries() {
      return [assistantTimeEntry];
    },
    async getRunningEntry() {
      return null;
    },
    async listGitHubActivity(projectId) {
      return assistantGitHubActivity.projectId === projectId ? [assistantGitHubActivity] : [];
    },
    async listFabricTasks() {
      return [buildThoughtseedFabricTask()];
    },
    async agentSessionStatus(): Promise<AgentSessionScanResult> {
      return {
        ok: true,
        enabled: true,
        scanned: providerSessionCandidates.length,
        imported: providerSessionCandidates.length,
        totalPending: providerSessionCandidates.length,
        matchedPending: providerSessionCandidates.length,
        readyPending: providerSessionCandidates.length,
        candidates: providerSessionCandidates,
        roots: [],
      };
    },
    async workerStatus() {
      return { connected: true };
    },
    async thoughtseedBridgeStatus() {
      return connectedBridgeStatus;
    },
    getUpdateStatus() {
      return updateStatus;
    },
  };
  return { ...sources, ...patch };
}
