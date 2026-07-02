import { getSetting, setSetting } from '../db/database.js';
import type { AssistantModelSettingsInput } from '../shared/native-assistant.js';

export const ASSISTANT_MODEL_SECRET_SETTING_KEYS = {
  googleApiKeyEnc: 'assistant.googleApiKeyEnc',
  nvidiaApiKeyEnc: 'assistant.nvidiaApiKeyEnc',
  lastError: 'assistant.modelKeyLastError',
} as const;

export interface AssistantSecretSettingsStore {
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;
}

export interface AssistantSecretCodec {
  isEncryptionAvailable(): boolean;
  encryptString(value: string): Buffer | Uint8Array | string;
  decryptString(value: Buffer): string;
}

export interface AssistantModelSecrets {
  googleApiKey: string | null;
  nvidiaApiKey: string | null;
}

export interface AssistantModelSecretStatus {
  hasGoogleKey: boolean;
  hasNvidiaKey: boolean;
}

export interface AssistantModelSecretStore {
  setGoogleApiKey(value: string | null): Promise<void>;
  setNvidiaApiKey(value: string | null): Promise<void>;
  getGoogleApiKey(): Promise<string | null>;
  getNvidiaApiKey(): Promise<string | null>;
  readSecrets(): Promise<AssistantModelSecrets>;
  status(): Promise<AssistantModelSecretStatus>;
  applySettings(input: AssistantModelSettingsInput): Promise<AssistantModelSecretStatus>;
}

function encryptedToBase64(value: Buffer | Uint8Array | string): string {
  return typeof value === 'string'
    ? Buffer.from(value, 'utf-8').toString('base64')
    : Buffer.from(value).toString('base64');
}

function trimmedKey(value: string | null | undefined): string | null {
  const next = value?.trim();
  return next ? next : null;
}

export function createAssistantModelSecretStore(
  settings: AssistantSecretSettingsStore,
  codec: AssistantSecretCodec,
): AssistantModelSecretStore {
  async function setEncrypted(key: string, value: string | null): Promise<void> {
    const next = trimmedKey(value);
    if (!next) {
      await settings.setSetting(key, '');
      return;
    }
    if (!codec.isEncryptionAvailable()) {
      throw new Error('OS secure storage is unavailable; cannot store assistant model keys safely.');
    }
    await settings.setSetting(key, encryptedToBase64(codec.encryptString(next)));
  }

  async function getEncrypted(key: string): Promise<string | null> {
    const enc = await settings.getSetting(key);
    if (!enc) return null;
    try {
      return codec.decryptString(Buffer.from(enc, 'base64'));
    } catch {
      await settings.setSetting(
        ASSISTANT_MODEL_SECRET_SETTING_KEYS.lastError,
        'Stored assistant model key could not be decrypted. Save a fresh key.',
      );
      return null;
    }
  }

  return {
    setGoogleApiKey(value) {
      return setEncrypted(ASSISTANT_MODEL_SECRET_SETTING_KEYS.googleApiKeyEnc, value);
    },
    setNvidiaApiKey(value) {
      return setEncrypted(ASSISTANT_MODEL_SECRET_SETTING_KEYS.nvidiaApiKeyEnc, value);
    },
    getGoogleApiKey() {
      return getEncrypted(ASSISTANT_MODEL_SECRET_SETTING_KEYS.googleApiKeyEnc);
    },
    getNvidiaApiKey() {
      return getEncrypted(ASSISTANT_MODEL_SECRET_SETTING_KEYS.nvidiaApiKeyEnc);
    },
    async readSecrets() {
      const [googleApiKey, nvidiaApiKey] = await Promise.all([
        this.getGoogleApiKey(),
        this.getNvidiaApiKey(),
      ]);
      return { googleApiKey, nvidiaApiKey };
    },
    async status() {
      const [googleEnc, nvidiaEnc] = await Promise.all([
        settings.getSetting(ASSISTANT_MODEL_SECRET_SETTING_KEYS.googleApiKeyEnc),
        settings.getSetting(ASSISTANT_MODEL_SECRET_SETTING_KEYS.nvidiaApiKeyEnc),
      ]);
      return {
        hasGoogleKey: Boolean(googleEnc),
        hasNvidiaKey: Boolean(nvidiaEnc),
      };
    },
    async applySettings(input) {
      if (input.clearGoogleKey) await this.setGoogleApiKey(null);
      if (input.clearNvidiaKey) await this.setNvidiaApiKey(null);
      if (input.googleApiKey !== undefined) await this.setGoogleApiKey(input.googleApiKey);
      if (input.nvidiaApiKey !== undefined) await this.setNvidiaApiKey(input.nvidiaApiKey);
      return this.status();
    },
  };
}

export async function createElectronAssistantModelSecretStore(): Promise<AssistantModelSecretStore> {
  const { safeStorage } = await import('electron');
  return createAssistantModelSecretStore({ getSetting, setSetting }, safeStorage);
}
