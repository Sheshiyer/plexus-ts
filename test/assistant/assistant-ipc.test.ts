import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cancelAssistantIntent } from '../../src/main/assistant-tools';

const sharedTypesSource = readFileSync(path.resolve(process.cwd(), 'src/shared/types.ts'), 'utf8');
const preloadSource = readFileSync(path.resolve(process.cwd(), 'src/preload/preload.ts'), 'utf8');
const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main/main.ts'), 'utf8');

function expectMainHandler(channel: string) {
  expect(
    mainSource.includes(`ipcMain.handle('${channel}'`) || mainSource.includes(`guardedHandle('${channel}'`),
    channel,
  ).toBe(true);
}

describe('assistant ipc surface', () => {
  it('exposes the Today aggregate snapshot through PlexusAPI, preload, and main', () => {
    expect(sharedTypesSource).toContain('todaySnapshot');
    expect(preloadSource).toContain('todaySnapshot');
    expect(preloadSource).toContain("ipcRenderer.invoke('today:snapshot')");
    expectMainHandler('today:snapshot');
  });

  it('exposes the admin proof cockpit snapshot through PlexusAPI, preload, and main', () => {
    expect(sharedTypesSource).toContain('adminProofCockpitSnapshot');
    expect(preloadSource).toContain('adminProofCockpitSnapshot');
    expect(preloadSource).toContain("ipcRenderer.invoke('adminProofCockpit:snapshot')");
    expectMainHandler('adminProofCockpit:snapshot');
  });

  it('exposes allowlisted admin proof cockpit drill-through actions', () => {
    expect(sharedTypesSource).toContain('AdminProofOpsDrilldownOpenResult');
    expect(sharedTypesSource).toContain('adminProofCockpitOpenDrilldown');
    expect(preloadSource).toContain('adminProofCockpitOpenDrilldown');
    expect(preloadSource).toContain("ipcRenderer.invoke('adminProofCockpit:openDrilldown'");
    expectMainHandler('adminProofCockpit:openDrilldown');
    expect(mainSource).toContain('ADMIN_PROOF_DRILLDOWN_TARGETS');
    expect(mainSource).toContain('docs/RELEASE_EVIDENCE.md');
    expect(mainSource).toContain('.github/workflows/ci.yml');
    expect(mainSource).toContain('https://github.com/Sheshiyer/plexus-ts/issues/49');
    expect(mainSource).toContain('shell.openPath');
    expect(mainSource).toContain('shell.openExternal');
  });

  it('keeps admin IPC channels behind an active admin session', () => {
    expect(mainSource).toMatch(/guardedHandle\('adminProofCockpit:snapshot'[\s\S]*?const session = await activeAdminSession\(\)/);
    expect(mainSource).toMatch(/guardedHandle\('adminProofCockpit:openDrilldown'[\s\S]*?await assertActiveAdminSession\(\)/);
    expect(mainSource).toMatch(/guardedHandle\('adminDemo:overview'[\s\S]*?await assertActiveAdminSession\(\)/);
    expect(mainSource).toMatch(/guardedHandle\('adminDemo:onboardingUpdate', normalizeAdminDemoOnboardingUpdateArgs[\s\S]*?await assertActiveAdminSession\(\)/);
    expect(mainSource).toContain('normalizeAdminDemoOnboardingUpdateArgs');
  });

  it('exposes typed assistant methods through PlexusAPI and preload', () => {
    for (const method of [
      'assistantStatus',
      'assistantAsk',
      'assistantSuggestions',
      'assistantConfirmIntent',
      'assistantCancelIntent',
      'assistantModelStatus',
      'assistantModelSetConfig',
      'assistantModelHealth',
      'assistantModelCatalog',
      'assistantContextDiagnostics',
      'assistantDailyOutbox',
      'assistantRetryDailyOutboxEvent',
      'assistantModelUsage',
      'onAssistantEvent',
    ]) {
      expect(sharedTypesSource).toContain(method);
      expect(preloadSource).toContain(method);
    }
  });

  it('exposes Temperance dispatch lane status through PlexusAPI, preload, and main', () => {
    expect(sharedTypesSource).toContain('TemperanceDispatchLaneStatusResult');
    expect(sharedTypesSource).toContain('thoughtseedDispatchLanes');
    expect(preloadSource).toContain('thoughtseedDispatchLanes');
    expect(preloadSource).toContain("ipcRenderer.invoke('thoughtseed:dispatchLanes')");
    expectMainHandler('thoughtseed:dispatchLanes');
  });

  it('wires main handlers and stream events through assistant:event', () => {
    for (const channel of [
      'assistant:status',
      'assistant:ask',
      'assistant:suggestions',
      'assistant:confirmIntent',
      'assistant:cancelIntent',
      'assistant:modelStatus',
      'assistant:modelSetConfig',
      'assistant:modelHealth',
      'assistant:modelCatalog',
      'assistant:contextDiagnostics',
      'assistant:dailyOutbox',
      'assistant:retryDailyOutbox',
      'assistant:modelUsage',
    ]) {
      expectMainHandler(channel);
      expect(preloadSource).toContain(`ipcRenderer.invoke('${channel}'`);
    }

    expect(mainSource).toContain("mainWindow.webContents.send('assistant:event', event)");
    expect(preloadSource).toContain("ipcRenderer.on('assistant:event', handler)");
    expect(preloadSource).toContain("ipcRenderer.off('assistant:event', handler)");
  });

  it('cancels draft intents through the existing intent update helper path', async () => {
    const patches: unknown[] = [];
    const cancelled = await cancelAssistantIntent(
      'intent_cancel',
      { actorId: 'user_1' },
      {
        getIntent: async () => ({
          id: 'intent_cancel',
          conversationId: 'conversation_1',
          toolId: 'app.navigate',
          status: 'draft',
          payload: { routeKey: 'reports' },
          result: {},
          createdAt: '2026-07-01T09:00:00.000Z',
          updatedAt: '2026-07-01T09:00:00.000Z',
        }),
        updateIntent: async (_id, patch) => {
          patches.push(patch);
          return {
            id: 'intent_cancel',
            conversationId: 'conversation_1',
            toolId: 'app.navigate',
            status: 'cancelled',
            payload: { routeKey: 'reports' },
            result: patch.result ?? {},
            createdAt: '2026-07-01T09:00:00.000Z',
            updatedAt: patch.updatedAt ?? '2026-07-01T09:01:00.000Z',
          };
        },
        now: () => new Date('2026-07-01T09:01:00.000Z'),
      },
    );

    expect(cancelled.status).toBe('cancelled');
    expect(patches).toEqual([
      {
        status: 'cancelled',
        result: {
          cancelled: true,
          actorId: 'user_1',
          cancelledAt: '2026-07-01T09:01:00.000Z',
        },
        updatedAt: '2026-07-01T09:01:00.000Z',
      },
    ]);
  });
});
