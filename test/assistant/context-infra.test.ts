import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant infra context', () => {
  it('exposes read-only worker, bridge, update, and optional helper status', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['infra'],
      includeOptionalHelpers: true,
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async getFabricStatus() {
          return {
            checkedAt: '2026-07-01T09:00:00.000Z',
            ports: [{ port: 3100, label: 'Paperclip API', reachable: true, lastCheckedAt: '2026-07-01T09:00:00.000Z' }],
            agents: [],
            summary: { healthy: 0, degraded: 0, uninitialized: 0, stale: 0, missingFileAgents: 0, total: 0 },
            bridge: { reachable: true },
            vault: { standups: 0, handoffs: 0 },
          };
        },
        async getPaperclipInstallStatus() {
          return { binaryFound: true, binaryPath: '/usr/local/bin/paperclipai', configFound: true };
        },
      }),
    });

    expect(snapshot.infra?.worker).toEqual({ connected: true });
    expect(snapshot.infra?.thoughtseedBridge).toMatchObject({
      configured: true,
      connected: true,
      credentialExpiresAt: '2026-07-21T00:00:00.000Z',
    });
    expect(snapshot.infra?.thoughtseedBridge).not.toHaveProperty('tokenExpiresAt');
    expect(snapshot.infra?.updates).toMatchObject({ state: 'idle', currentVersion: '0.4.5' });
    expect(snapshot.infra?.optionalHelpers.fabric).toMatchObject({ bridgeReachable: true, reachablePorts: 1 });
    expect(snapshot.infra?.optionalHelpers.paperclip).toMatchObject({ binaryFound: true, configFound: true });
  });
});
