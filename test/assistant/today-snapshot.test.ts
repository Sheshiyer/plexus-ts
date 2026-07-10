import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTodaySnapshot } from '../../src/shared/today-snapshot';
import type { AgentSessionScanResult, AssistantStatus, RealtimeRoom, WorkEvidenceSummary } from '../../src/shared/types';
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

function assistantStatus(patch: Partial<AssistantStatus> = {}): AssistantStatus {
  return {
    ok: true,
    state: 'ready',
    enabled: true,
    availability: 'ready',
    checkedAt: FIXTURE_NOW,
    model: {
      provider: 'auto',
      googleModel: 'gemini-2.5-flash',
      nvidiaModel: 'nvidia/llama-3.1-nemotron',
      localModel: 'llama3.2',
      localBaseUrl: null,
      mockModel: 'mock-assistant',
      selectedModelId: 'google:gemini-2.5-flash',
      selectedProvider: 'google',
      configuredProviders: ['google'],
      hasGoogleKey: true,
      hasNvidiaKey: false,
    },
    message: 'Assistant runtime ready.',
    ...patch,
  };
}

function realtimeRoom(patch: Partial<RealtimeRoom> = {}): RealtimeRoom {
  return {
    id: 'room_project_verified',
    workspaceId: 'workspace_1',
    projectId: 'project_verified',
    projectName: 'Verified Project',
    name: 'Verified Project room',
    slug: 'verified-project',
    roomType: 'project_room',
    state: 'open',
    visibility: 'workspace',
    activeCallId: 'call_1',
    activeCall: null,
    presence: { participants: 3, screenShares: 1 },
    metadata: {},
    lastActivityAt: FIXTURE_NOW,
    createdAt: FIXTURE_NOW,
    updatedAt: FIXTURE_NOW,
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
      assistantStatus: assistantStatus(),
      assistantSuggestions: [{
        id: 'suggestion_standup',
        type: 'standup',
        title: 'Prepare daily proof',
        body: 'Generate a daily proof packet from today.',
        confidence: 0.91,
        safety: 'confirm_required',
        intent: { toolId: 'app.generateStandup', title: 'Generate proof', payload: { date: '2026-07-01' } },
      }],
      realtimeRooms: [realtimeRoom()],
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
    expect(snapshot.assistant).toMatchObject({
      availability: 'ready',
      state: 'ready',
      modelProvider: 'google',
      selectedModelId: 'google:gemini-2.5-flash',
      degraded: false,
    });
    expect(snapshot.sessions.ready).toBe(1);
    expect(snapshot.assignments.current).toMatchObject({
      taskId: 'fabric_task_1',
      status: 'in_progress',
      source: 'hermes',
      proofRequired: null,
      nextAction: 'Continue the task and capture the required proof.',
    });
    expect(snapshot.rooms.current).toMatchObject({
      roomId: 'room_project_verified',
      observedState: 'active_call',
      joinState: 'unknown',
      participantCount: 3,
      screenShareCount: 1,
    });
    expect(snapshot.suggestions.map((suggestion) => suggestion.source)).toContain('assistant');
    expect(snapshot.suggestions.map((suggestion) => suggestion.source)).toContain('temperance');
    expect(snapshot.nextActions.map((action) => action.id)).toEqual([
      'review-fabric-tasks',
      'open-active-room',
      'convert-clio-memories',
      'review-temperance-suggestion',
    ]);
  });

  it('maps current bridge assignment details and sanitized Temperance skill hints', () => {
    const snapshot = buildTodaySnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      timerState: { running: false },
      entries: [buildTimeEntry()],
      projects: [buildProject()],
      tasks: [
        buildThoughtseedFabricTask({
          taskId: 'task_blocked',
          title: 'Repair bridge queue proof',
          status: 'blocked',
          source: 'cambium',
          proofRequired: 'github_pr',
          proofStatus: 'missing',
          workMode: 'delegated',
          skillHints: [
            'dispatching-parallel-agents',
            { name: 'executing-plans', token: 'secret-value-that-must-not-leak' },
            { nope: true },
          ],
        }),
      ],
      evidenceSummary: evidenceSummary(),
    });

    expect(snapshot.assignments.current).toMatchObject({
      taskId: 'task_blocked',
      status: 'blocked',
      source: 'cambium',
      proofRequired: 'github_pr',
      proofStatus: 'missing',
      workMode: 'delegated',
      nextAction: 'Resolve the blocker or request operator input.',
    });
    const skillHints = snapshot.suggestions
      .filter((suggestion) => suggestion.source === 'temperance')
      .map((suggestion) => suggestion.skillHint)
      .filter(Boolean);
    expect(skillHints).toEqual(['dispatching-parallel-agents', 'executing-plans']);
    expect(JSON.stringify(snapshot.suggestions)).not.toContain('secret-value');
    expect(snapshot.suggestions.every((suggestion) => suggestion.safety !== 'admin_only')).toBe(true);
  });

  it('keeps realtime and recommendation failures degraded without breaking core Today totals', () => {
    const snapshot = buildTodaySnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      timerState: { running: false },
      entries: [buildTimeEntry()],
      projects: [buildProject()],
      evidenceSummary: evidenceSummary(),
      assistantStatus: assistantStatus({
        ok: false,
        state: 'needs_model_key',
        availability: 'needs_model_key',
        model: {
          ...assistantStatus().model,
          selectedProvider: null,
          selectedModelId: null,
          configuredProviders: [],
          hasGoogleKey: false,
        },
      }),
      assistantSuggestionsError: 'suggestions timed out',
      realtimeRoomsError: 'realtime unavailable',
    });

    expect(snapshot.totals.trackedSeconds).toBe(3600);
    expect(snapshot.assistant.degraded).toBe(true);
    expect(snapshot.sourceHealth.realtimeRooms).toMatchObject({ state: 'unavailable', message: 'realtime unavailable' });
    expect(snapshot.sourceHealth.recommendations).toMatchObject({ state: 'unavailable', message: 'suggestions timed out' });
    expect(snapshot.nextActions.map((action) => action.id)).toContain('repair-clio-runtime');
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

  it('promotes founder update suggestions into the Today action queue', () => {
    const snapshot = buildTodaySnapshot({
      date: '2026-07-01',
      generatedAt: FIXTURE_NOW,
      timerState: { running: false },
      entries: [buildTimeEntry()],
      projects: [buildProject()],
      evidenceSummary: evidenceSummary(),
      memberKpi: {
        todaySeconds: 3600,
        weekSeconds: 3600,
        projectBreakdown: { project_verified: 3600 },
        standupCompliant: false,
      },
      assistantSuggestions: [{
        id: 'offline_founder_update_2026-07-01',
        type: 'standup',
        title: 'Prepare founder update',
        body: "Queue today's proof packet for founder review after confirmation.",
        confidence: 0.93,
        safety: 'confirm_required',
        intent: {
          toolId: 'daily.sendEvent',
          title: 'Queue founder update',
          payload: { date: '2026-07-01', memberId: 'shesh', standupRecordId: null },
        },
      }],
    });

    expect(snapshot.suggestions[0]).toMatchObject({
      title: 'Prepare founder update',
      toolId: 'daily.sendEvent',
      routeKey: 'assistant',
    });
    expect(snapshot.nextActions).toContainEqual(expect.objectContaining({
      id: 'prepare-founder-update',
      title: 'Prepare founder update',
      routeKey: 'assistant',
    }));
  });

  it('does not import renderer, Electron, filesystem, or browser globals', () => {
    const sourcePath = fileURLToPath(new URL('../../src/shared/today-snapshot.ts', import.meta.url));
    const source = readFileSync(sourcePath, 'utf8');

    expect(source).not.toMatch(/\bwindow\b|\bdocument\b|\bnavigator\b|\bWorker\b/);
    expect(source).not.toMatch(/\bipcRenderer\b|\bipcMain\b|from ['"]electron['"]/);
    expect(source).not.toMatch(/from ['"]node:/);
  });
});
