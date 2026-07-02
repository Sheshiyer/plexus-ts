import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_DEFAULT_MODELS,
  ASSISTANT_MODEL_ENV,
  assistantModelStatusFromConfig,
  resolveAssistantModelConfig,
} from '../../src/main/assistant-models';

describe('assistant model config', () => {
  it('defaults to auto routing with stable model names', () => {
    const config = resolveAssistantModelConfig({}, {});

    expect(config.provider).toBe('auto');
    expect(config.googleModel).toBe(ASSISTANT_DEFAULT_MODELS.google);
    expect(config.nvidiaModel).toBe(ASSISTANT_DEFAULT_MODELS.nvidia);
    expect(config.selectedProvider).toBeNull();
    expect(config.configuredProviders).toEqual([]);
    expect(config.envKeys).toEqual(ASSISTANT_MODEL_ENV);
  });

  it('uses environment keys before stored keys and exposes status booleans only', () => {
    const config = resolveAssistantModelConfig(
      {
        provider: 'auto',
        googleApiKey: 'stored-google',
        nvidiaApiKey: 'stored-nvidia',
      },
      {
        [ASSISTANT_MODEL_ENV.googleApiKey]: 'env-google',
      },
    );
    const status = assistantModelStatusFromConfig(config);

    expect(config.googleApiKey).toBe('env-google');
    expect(config.nvidiaApiKey).toBe('stored-nvidia');
    expect(status.selectedProvider).toBe('google');
    expect(status.configuredProviders).toEqual(['google', 'nvidia']);
    expect(status.hasGoogleKey).toBe(true);
    expect(JSON.stringify(status)).not.toContain('env-google');
    expect(JSON.stringify(status)).not.toContain('stored-nvidia');
  });

  it('honors explicit mock provider for deterministic local routing', () => {
    const config = resolveAssistantModelConfig({ provider: 'mock' }, {});

    expect(config.selectedProvider).toBe('mock');
    expect(config.configuredProviders).toEqual(['mock']);
  });
});
