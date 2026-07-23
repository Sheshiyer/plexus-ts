import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cancelAssistantIntent } from '../../src/main/assistant-tools';

const sharedTypesSource = readFileSync(path.resolve(process.cwd(), 'src/shared/types.ts'), 'utf8');
const preloadSource = readFileSync(path.resolve(process.cwd(), 'src/preload/preload.ts'), 'utf8');
const mainSource = readFileSync(path.resolve(process.cwd(), 'src/main/main.ts'), 'utf8');

describe('assistant ipc surface', () => {
  it('exposes typed assistant methods through PlexusAPI and preload', () => {
    for (const method of [
      'assistantStatus',
      'assistantCapabilities',
      'assistantAsk',
      'assistantSuggestions',
      'assistantConfirmIntent',
      'assistantCancelIntent',
      'assistantModelStatus',
      'assistantModelSetConfig',
      'assistantModelHealth',
      'assistantModelCatalog',
      'onAssistantEvent',
    ]) {
      expect(sharedTypesSource).toContain(method);
      expect(preloadSource).toContain(method);
    }
  });

  it('wires main handlers and stream events through assistant:event', () => {
    for (const channel of [
      'assistant:status',
      'assistant:capabilities',
      'assistant:ask',
      'assistant:suggestions',
      'assistant:confirmIntent',
      'assistant:cancelIntent',
      'assistant:modelStatus',
      'assistant:modelSetConfig',
      'assistant:modelHealth',
      'assistant:modelCatalog',
    ]) {
      expect(mainSource).toContain(`ipcMain.handle('${channel}'`);
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
