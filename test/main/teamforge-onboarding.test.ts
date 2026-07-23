import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workerState = vi.hoisted(() => ({
  settings: new Map<string, string | null>([
    ['tf.baseUrl', 'https://worker.test'],
    ['tf.tokenEnc', 'encrypted-token'],
    ['tf.accessJwt', null],
  ]),
}));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: () => 'member-token',
  },
  BrowserWindow: class MockBrowserWindow {},
  session: {},
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => workerState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    workerState.settings.set(key, value);
  }),
  listProjects: vi.fn(),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(),
}));

function baseSession(overrides: Record<string, unknown> = {}) {
  return {
    employee: { id: 'emp-1', displayName: 'Test User', email: 'test@thoughtseed.space', monthlyQuotaHours: 160 },
    identityId: 'identity-1',
    employeeId: 'emp-1',
    adminId: null,
    workspaceId: 'ws-1',
    email: 'test@thoughtseed.space',
    role: 'employee',
    displayName: 'Test User',
    projectVisibility: 'active',
    capabilities: {},
    onboarding: {
      steps: [
        { stepId: 'identity_projects', label: 'Identity and project access', requirement: 'required', state: 'completed' },
        { stepId: 'preferences', label: 'Personal preferences', requirement: 'optional', state: 'skipped' },
      ],
      requiredComplete: true,
      completed: true,
    },
    signedInAt: new Date().toISOString(),
    ...overrides,
  };
}

function persistedSession() {
  const raw = workerState.settings.get('tf.session');
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  workerState.settings.set('tf.session', JSON.stringify(baseSession()));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('onboarding persistence across whoami refreshes', () => {
  it('preserves completed onboarding when /v1/whoami omits the onboarding field', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        email: 'test@thoughtseed.space',
        identityId: 'identity-1',
        employeeId: 'emp-1',
        workspaceId: 'ws-1',
        role: 'employee',
        // no `onboarding` field — the regression trigger
      },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { refreshSession } = await import('../../src/main/teamforge');

    const result = await refreshSession();

    expect(result.ok).toBe(true);
    expect(result.session?.onboarding.completed).toBe(true);
    expect(persistedSession()?.onboarding.completed).toBe(true);
  });

  it('respects an explicit onboarding payload from the server even if incomplete', async () => {
    const serverOnboarding = {
      steps: [
        { stepId: 'identity_projects', label: 'Identity and project access', requirement: 'required', state: 'pending' },
      ],
      requiredComplete: false,
      completed: false,
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        email: 'test@thoughtseed.space',
        identityId: 'identity-1',
        workspaceId: 'ws-1',
        role: 'employee',
        onboarding: serverOnboarding,
      },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { refreshSession } = await import('../../src/main/teamforge');

    const result = await refreshSession();

    expect(result.ok).toBe(true);
    expect(result.session?.onboarding.completed).toBe(false);
  });

  it('does not inherit completed onboarding across a different identity', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      data: {
        email: 'other@thoughtseed.space',
        identityId: 'identity-2',
        workspaceId: 'ws-1',
        role: 'employee',
      },
    })));
    vi.stubGlobal('fetch', fetchMock);
    const { refreshSession } = await import('../../src/main/teamforge');

    const result = await refreshSession();

    expect(result.ok).toBe(true);
    expect(result.session?.onboarding.completed).toBe(false);
  });
});

describe('markOnboardingComplete', () => {
  it('recomputes and persists completion from closed steps without any network call', async () => {
    workerState.settings.set('tf.session', JSON.stringify(baseSession({
      onboarding: {
        steps: [
          { stepId: 'identity_projects', label: 'Identity and project access', requirement: 'required', state: 'completed' },
          { stepId: 'preferences', label: 'Personal preferences', requirement: 'optional', state: 'deferred' },
        ],
        requiredComplete: false,
        completed: false,
      },
    })));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { markOnboardingComplete } = await import('../../src/main/teamforge');

    const result = await markOnboardingComplete();

    expect(result.ok).toBe(true);
    expect(result.session?.onboarding.completed).toBe(true);
    expect(result.session?.onboarding.requiredComplete).toBe(true);
    expect(persistedSession()?.onboarding.completed).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not mark complete while a required step is still open', async () => {
    workerState.settings.set('tf.session', JSON.stringify(baseSession({
      onboarding: {
        steps: [
          { stepId: 'identity_projects', label: 'Identity and project access', requirement: 'required', state: 'pending' },
        ],
        requiredComplete: false,
        completed: false,
      },
    })));
    const { markOnboardingComplete } = await import('../../src/main/teamforge');

    const result = await markOnboardingComplete();

    expect(result.ok).toBe(true);
    expect(result.session?.onboarding.completed).toBe(false);
    expect(persistedSession()?.onboarding.completed).toBe(false);
  });

  it('returns ok:false when no session exists', async () => {
    workerState.settings.set('tf.session', '');
    const { markOnboardingComplete } = await import('../../src/main/teamforge');

    const result = await markOnboardingComplete();

    expect(result.ok).toBe(false);
  });
});
