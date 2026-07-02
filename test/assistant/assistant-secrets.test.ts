import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_MODEL_SECRET_SETTING_KEYS,
  createAssistantModelSecretStore,
  type AssistantSecretCodec,
  type AssistantSecretSettingsStore,
} from '../../src/main/assistant-model-settings';

function memorySettings(): AssistantSecretSettingsStore & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    async getSetting(key) {
      return values.get(key) ?? null;
    },
    async setSetting(key, value) {
      values.set(key, value);
    },
  };
}

function codec(available = true): AssistantSecretCodec {
  return {
    isEncryptionAvailable: () => available,
    encryptString(value) {
      return Buffer.from(`enc:${value}`, 'utf-8');
    },
    decryptString(value) {
      const decoded = value.toString('utf-8');
      if (!decoded.startsWith('enc:')) throw new Error('bad ciphertext');
      return decoded.slice(4);
    },
  };
}

describe('assistant model secrets', () => {
  it('stores encrypted model keys and returns only status booleans', async () => {
    const settings = memorySettings();
    const store = createAssistantModelSecretStore(settings, codec());

    await store.setGoogleApiKey('google-secret');
    await store.setNvidiaApiKey('nvidia-secret');

    expect(settings.values.get(ASSISTANT_MODEL_SECRET_SETTING_KEYS.googleApiKeyEnc)).not.toContain('google-secret');
    expect(await store.readSecrets()).toEqual({
      googleApiKey: 'google-secret',
      nvidiaApiKey: 'nvidia-secret',
    });
    expect(await store.status()).toEqual({
      hasGoogleKey: true,
      hasNvidiaKey: true,
    });
  });

  it('clears keys through model settings input', async () => {
    const settings = memorySettings();
    const store = createAssistantModelSecretStore(settings, codec());

    await store.applySettings({ googleApiKey: 'google-secret', nvidiaApiKey: 'nvidia-secret' });
    await store.applySettings({ clearGoogleKey: true });

    expect(await store.getGoogleApiKey()).toBeNull();
    expect(await store.getNvidiaApiKey()).toBe('nvidia-secret');
    expect(await store.status()).toEqual({
      hasGoogleKey: false,
      hasNvidiaKey: true,
    });
  });

  it('refuses to store keys when secure storage is unavailable', async () => {
    const settings = memorySettings();
    const store = createAssistantModelSecretStore(settings, codec(false));

    await expect(store.setGoogleApiKey('google-secret')).rejects.toThrow('secure storage is unavailable');
  });
});
