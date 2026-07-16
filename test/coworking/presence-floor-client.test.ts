import { afterEach, describe, expect, it, vi } from 'vitest';

const PLEXUS_ACCESS_AUD = '5695e8409cd4e838eaaef4de4995541dae4f31a2773945ea67f136800977c200';

const clientState = vi.hoisted(() => ({
  settings: new Map<string, string | null>(),
}));

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^enc:/, ''),
  },
  BrowserWindow: class MockBrowserWindow {},
  session: {
    fromPartition: vi.fn(() => ({
      clearStorageData: vi.fn(),
      clearCache: vi.fn(),
    })),
  },
}));

vi.mock('../../src/db/database.js', () => ({
  getSetting: vi.fn(async (key: string) => clientState.settings.get(key) ?? ''),
  setSetting: vi.fn(async (key: string, value: string) => {
    clientState.settings.set(key, value);
  }),
  listProjects: vi.fn(async () => []),
  insertProject: vi.fn(),
  updateProject: vi.fn(),
  updateEntry: vi.fn(),
  listUnsyncedEntries: vi.fn(async () => []),
}));

function accessJwt(): string {
  const payload = Buffer.from(JSON.stringify({
    aud: [PLEXUS_ACCESS_AUD],
    email: 'alice@example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return `header.${payload}.signature`;
}

const focusedMember = {
  identityId: 'pid_alice',
  employeeId: 'employee_alice',
  displayName: 'Alice Example',
  activity: {
    state: 'focused',
    timerEntryId: 'entry_alpha',
    projectId: 'project_alpha',
    timerStartedAt: '2026-07-16T09:30:00.000Z',
  },
  room: {
    kind: 'project',
    roomId: 'room_alpha',
    roomName: 'Alpha room',
    projectId: 'project_alpha',
    projectName: 'Alpha',
    callId: 'call_alpha',
    participantId: 'participant_alice',
  },
  observedAt: '2026-07-16T10:00:05.000Z',
  lastSeenAt: '2026-07-16T10:00:00.000Z',
  expiresAt: '2026-07-16T10:01:00.000Z',
  activeClientCount: 2,
  presenceProof: 'authenticated_app_lease',
  clientInstanceId: 'raw-client-must-not-escape',
  presenceSessionId: 'raw-session-must-not-escape',
  audio: { state: 'live' },
};

afterEach(() => {
  clientState.settings = new Map();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('authenticated Coworking presence client', () => {
  it('normalizes complete lease evidence and maps honest floor semantics', async () => {
    const {
      floorPresenceFromLease,
      normalizeCoworkingPresenceMembers,
    } = await import('../../src/shared/coworking-presence');

    const [member] = normalizeCoworkingPresenceMembers({ members: [focusedMember] });
    expect(member).toEqual({
      identityId: 'pid_alice',
      employeeId: 'employee_alice',
      displayName: 'Alice Example',
      activity: focusedMember.activity,
      room: focusedMember.room,
      observedAt: '2026-07-16T10:00:05.000Z',
      lastSeenAt: '2026-07-16T10:00:00.000Z',
      expiresAt: '2026-07-16T10:01:00.000Z',
      activeClientCount: 2,
      presenceProof: 'authenticated_app_lease',
    });
    expect(member).not.toHaveProperty('clientInstanceId');
    expect(member).not.toHaveProperty('presenceSessionId');

    const floor = floorPresenceFromLease(member);
    expect(floor).toMatchObject({
      identityId: 'pid_alice',
      employeeId: 'employee_alice',
      participantId: 'participant_alice',
      displayName: 'Alice Example',
      ringState: 'timing',
      roomId: 'room_alpha',
      roomName: 'Alpha room',
      projectTag: 'ALPHA',
      isSpeaking: false,
      observedAt: '2026-07-16T10:00:05.000Z',
      lastSeenAt: '2026-07-16T10:00:00.000Z',
      expiresAt: '2026-07-16T10:01:00.000Z',
      activeClientCount: 2,
      presenceProof: 'authenticated_app_lease',
    });
    expect(floor).not.toHaveProperty('clientInstanceId');
    expect(floor).not.toHaveProperty('presenceSessionId');
  });

  it('fails closed on malformed proof, timestamps, counts, and enums', async () => {
    const { normalizeCoworkingPresenceMembers } = await import('../../src/shared/coworking-presence');

    expect(() => normalizeCoworkingPresenceMembers({
      members: [{ ...focusedMember, lastSeenAt: 'not-a-timestamp' }],
    })).toThrow(/lastSeenAt/i);
    expect(() => normalizeCoworkingPresenceMembers({
      members: [{ ...focusedMember, presenceProof: 'client_claim' }],
    })).toThrow(/presenceProof/i);
    expect(() => normalizeCoworkingPresenceMembers({
      members: [{ ...focusedMember, activeClientCount: 0 }],
    })).toThrow(/activeClientCount/i);
    expect(() => normalizeCoworkingPresenceMembers({
      members: [{ ...focusedMember, activity: { ...focusedMember.activity, state: 'busy' } }],
    })).toThrow(/activity/i);
  });

  it('uses one authenticated presence GET, never room fanout, and keeps audio from implying speech', async () => {
    const jwt = accessJwt();
    clientState.settings.set('tf.accessJwtEnc', Buffer.from(`enc:${jwt}`).toString('base64'));
    const requests: Array<{ url: string; method: string; headers: Headers; body: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method ?? 'GET';
      requests.push({
        url,
        method,
        headers: new Headers(init?.headers),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(JSON.stringify({ ok: true, data: { members: [focusedMember] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const { getCoworkingFloor } = await import('../../src/main/teamforge');
    const result = await getCoworkingFloor();

    expect(result.ok).toBe(true);
    expect(result.floor).toHaveLength(1);
    expect(result.floor[0]).toMatchObject({ identityId: 'pid_alice', isSpeaking: false });
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://plexus-api.thoughtseed.space/v1/realtime/presence');
    expect(requests[0].method).toBe('GET');
    expect(requests[0].headers.get('Cf-Access-Jwt-Assertion')).toBe(jwt);
    expect(requests.some((request) => /\/v1\/realtime\/rooms\/.+/.test(request.url))).toBe(false);
  });

  it('opens a Worker session, sends roomless sequenced activity, and disconnects the exact process', async () => {
    const jwt = accessJwt();
    clientState.settings.set('tf.accessJwtEnc', Buffer.from(`enc:${jwt}`).toString('base64'));
    const requests: Array<{ url: string; method: string; body: unknown }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      requests.push({
        url,
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      const data = url.endsWith('/session')
        ? { presenceSessionId: 'presence_session_alpha' }
        : (init?.method ?? 'GET') === 'DELETE'
          ? { disconnected: true }
          : { renewed: true };
      return new Response(JSON.stringify({ ok: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const {
      disconnectCoworkingPresence,
      heartbeatCoworkingPresence,
      openCoworkingPresenceSession,
    } = await import('../../src/main/teamforge');
    await expect(openCoworkingPresenceSession('installation_alpha')).resolves.toEqual({
      ok: true,
      presenceSessionId: 'presence_session_alpha',
    });
    const heartbeat = {
      clientInstanceId: 'installation_alpha',
      presenceSessionId: 'presence_session_alpha',
      sequence: 1,
      activity: focusedMember.activity,
    } as const;

    await expect(heartbeatCoworkingPresence(heartbeat)).resolves.toMatchObject({ ok: true });
    await expect(disconnectCoworkingPresence({
      clientInstanceId: 'installation_alpha',
      presenceSessionId: 'presence_session_alpha',
    })).resolves.toMatchObject({ ok: true, disconnected: true });

    expect(requests).toEqual([
      {
        url: 'https://plexus-api.thoughtseed.space/v1/realtime/presence/session',
        method: 'POST',
        body: { clientInstanceId: 'installation_alpha' },
      },
      {
        url: 'https://plexus-api.thoughtseed.space/v1/realtime/presence/heartbeat',
        method: 'POST',
        body: heartbeat,
      },
      {
        url: 'https://plexus-api.thoughtseed.space/v1/realtime/presence/installation_alpha/presence_session_alpha',
        method: 'DELETE',
        body: null,
      },
    ]);
    expect(requests[1].body).not.toHaveProperty('room');
  });
});
