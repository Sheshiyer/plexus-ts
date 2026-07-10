import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadIsolatedAssistantDatabase } from './fixtures/database';
import { buildThoughtseedFabricTask } from './fixtures/builders';

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`enc:${value}`),
    decryptString: (value: Buffer) => value.toString('utf8').replace(/^enc:/, ''),
  },
}));

let cleanupDatabase: (() => Promise<void>) | null = null;

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await cleanupDatabase?.();
  cleanupDatabase = null;
});

async function connectBridge(database: typeof import('../../src/db/database'), memberId = 'member_alice') {
  vi.stubEnv('PLEXUS_THOUGHTSEED_BRIDGE_URL', 'https://bridge.test');
  await database.setSetting('ts.bridgeApiUrl', 'https://bridge.test');
  await database.setSetting('ts.bridgeMemberId', memberId);
  await database.setSetting('ts.bridgeTenantId', 'cambium');
  await database.setSetting('ts.bridgeTokenEnc', Buffer.from('enc:member-token').toString('base64'));
  await database.setSetting('ts.bridgeTokenExpiresAt', '2026-08-01T00:00:00.000Z');
}

function mockBridgeFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () => (
    new Response(JSON.stringify({ ok: true, artifactRef: 'bridge://artifact/local-smoke' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ));
}

describe('Temperance dispatch local runtime smoke', () => {
  it('runs task mode, delegated proof, diagnostics, and custody with mocked bridge transport only', async () => {
    const { database, cleanup } = await loadIsolatedAssistantDatabase();
    cleanupDatabase = cleanup;
    await connectBridge(database, 'member_alice');
    await database.upsertFabricTask(buildThoughtseedFabricTask({
      taskId: 'fabric_task_runtime_smoke',
      assigneeMemberId: 'member_alice',
      status: 'assigned',
      workMode: undefined,
      workModeLocked: false,
      correlationId: 'corr_runtime_smoke',
      skillHints: ['dispatching-parallel-agents'],
      history: [
        {
          eventId: 'directive_runtime_smoke',
          timestamp: '2026-07-01T08:30:00.000Z',
          actor: 'hermes',
          source: 'hermes',
          type: 'assigned',
          payloadHash: 'hash_runtime_smoke',
          payload: { status: 'assigned' },
          correlationId: 'corr_runtime_smoke',
        },
      ],
    }));
    const fetchSpy = mockBridgeFetch();

    const bridge = await import('../../src/main/thoughtseed-bridge');
    await bridge.setThoughtseedFabricTaskWorkMode('fabric_task_runtime_smoke', 'delegated');
    const report = await bridge.reportThoughtseedFabricTask({
      taskId: 'fabric_task_runtime_smoke',
      status: 'done',
      note: 'Local smoke closes delegated work with explicit weak proof.',
      evidence: {
        type: 'note',
        value: 'Weak evidence note from deterministic local smoke.',
        label: 'Local smoke proof',
      },
    });
    const lanes = await bridge.listThoughtseedDispatchLanes();

    expect(report.task).toMatchObject({
      taskId: 'fabric_task_runtime_smoke',
      status: 'done',
      workMode: 'delegated',
      evidenceStrength: 'weak_evidence',
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls.every(([url]) => String(url).startsWith('https://bridge.test/'))).toBe(true);
    expect(lanes.runtime.correlationIds).toContain('corr_runtime_smoke');
    expect(lanes.runtime.localSmoke.ok).toBe(true);
    expect(lanes.runtime.supportPacket.boundary).toContain('no live Cambium');
    expect(lanes.recommendations).toEqual(expect.arrayContaining([expect.objectContaining({
      taskId: 'fabric_task_runtime_smoke',
      skillName: 'dispatching-parallel-agents',
      safety: 'confirm_required',
    })]));

    const custody = await database.listProofCustodyRecords({
      subjectType: 'fabric_task',
      subjectId: 'fabric_task_runtime_smoke',
    });
    expect(custody).toEqual([expect.objectContaining({
      proofStatus: 'partial',
      evidenceType: 'note',
      strength: 'weak_evidence',
      artifactRef: 'Weak evidence note from deterministic local smoke.',
    })]);
  }, 30000);
});
