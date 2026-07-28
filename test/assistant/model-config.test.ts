import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_DEFAULT_MODELS,
  ASSISTANT_MODEL_ENV,
  assistantModelStatusFromConfig,
  resolveAssistantModelConfig,
} from '../../src/main/assistant-models';

describe('OmniRoute assistant model config', () => {
  it('defaults to auto routing through te-build', () => {
    const config = resolveAssistantModelConfig({}, {});
    const status = assistantModelStatusFromConfig(config);

    expect(config.provider).toBe('auto');
    expect(config.laneId).toBe(ASSISTANT_DEFAULT_MODELS.lane);
    expect(config.selectedModelId).toBe('te-build');
    expect(config.selectedProvider).toBe('omniroute');
    expect(config.configuredProviders).toEqual(['omniroute']);
    expect(config.envKeys).toEqual(ASSISTANT_MODEL_ENV);
    expect(status).toMatchObject({ provider: 'auto', laneId: 'te-build' });
    expect(JSON.stringify(status)).not.toMatch(/api.?key|base.?url|jwt|cookie/i);
  });

  it.each(['google', 'nvidia', 'local'] as const)('migrates legacy %s routing to auto/te-build', (provider) => {
    const config = resolveAssistantModelConfig({ provider }, {});

    expect(config.provider).toBe('auto');
    expect(config.laneId).toBe('te-build');
  });

  it('retains a validated governed lane', () => {
    const config = resolveAssistantModelConfig({ provider: 'omniroute', laneId: 'te-review' }, {});

    expect(config.provider).toBe('omniroute');
    expect(config.laneId).toBe('te-review');
    expect(config.selectedModelId).toBe('te-review');
  });

  it('honors explicit mock provider for deterministic tests only', () => {
    const config = resolveAssistantModelConfig({ provider: 'mock' }, {});

    expect(config.selectedProvider).toBe('mock');
    expect(config.configuredProviders).toEqual(['mock']);
  });
});
