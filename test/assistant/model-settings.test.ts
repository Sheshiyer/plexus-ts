import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_RECOMMENDED_LANE,
  normalizeAssistantLaneId,
  normalizeAssistantModelProvider,
} from '../../src/shared/native-assistant';
import {
  migrateAssistantModelSelection,
  saveAssistantModelSelection,
} from '../../src/main/assistant-model-settings';

describe('OmniRoute assistant settings migration', () => {
  it.each(['google', 'nvidia', 'local', 'ollama', 'lmstudio', '', null, undefined])(
    'migrates legacy provider %j to auto',
    (provider) => {
      expect(normalizeAssistantModelProvider(provider)).toBe('auto');
    },
  );

  it.each(['auto', 'omniroute', 'mock'] as const)('retains supported provider %s', (provider) => {
    expect(normalizeAssistantModelProvider(provider)).toBe(provider);
  });

  it('accepts governed production lane ids and rejects raw or hidden ids', () => {
    expect(normalizeAssistantLaneId('te-plan')).toBe('te-plan');
    expect(normalizeAssistantLaneId('temperance-coding')).toBe('temperance-coding');
    expect(normalizeAssistantLaneId('te-bench')).toBe(ASSISTANT_RECOMMENDED_LANE);
    expect(normalizeAssistantLaneId('deepseek/deepseek-v4-pro')).toBe(ASSISTANT_RECOMMENDED_LANE);
  });

  it('persists a valid selected lane while migrating a legacy provider once', async () => {
    const values = new Map<string, string | null>([
      ['assistantModelProvider', 'google'],
      ['assistantModelLaneId', 'te-review'],
    ]);
    const writes: Array<[string, string]> = [];
    const selection = await migrateAssistantModelSelection({
      getSetting: async (key) => values.get(key) ?? null,
      setSetting: async (key, value) => {
        values.set(key, value);
        writes.push([key, value]);
      },
    });

    expect(selection).toEqual({ provider: 'auto', laneId: 'te-review', migrated: true });
    expect(writes).toEqual([['assistantModelProvider', 'auto']]);
  });

  it('saves a selected lane and reloads it without repeating migration', async () => {
    const values = new Map<string, string | null>([
      ['assistantModelProvider', 'auto'],
      ['assistantModelLaneId', 'te-build'],
    ]);
    const writes: Array<[string, string]> = [];
    const store = {
      getSetting: async (key: string) => values.get(key) ?? null,
      setSetting: async (key: string, value: string) => {
        values.set(key, value);
        writes.push([key, value]);
      },
    };

    const saved = await saveAssistantModelSelection({
      provider: 'omniroute',
      laneId: 'te-plan',
    }, store);
    const writesAfterSave = [...writes];
    const reloaded = await migrateAssistantModelSelection(store);

    expect(saved).toEqual({ provider: 'omniroute', laneId: 'te-plan', migrated: false });
    expect(reloaded).toEqual(saved);
    expect(writesAfterSave).toEqual([
      ['assistantModelProvider', 'omniroute'],
      ['assistantModelLaneId', 'te-plan'],
    ]);
    expect(writes).toEqual(writesAfterSave);
  });
});
