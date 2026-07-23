import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant infra context', () => {
  it('exposes read-only worker, bridge, and update status', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['infra'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources(),
    });

    expect(snapshot.infra?.worker).toEqual({ connected: true });
    expect(snapshot.infra?.thoughtseedBridge).toMatchObject({
      configured: true,
      connected: true,
      credentialExpiresAt: '2026-07-21T00:00:00.000Z',
    });
    expect(snapshot.infra?.thoughtseedBridge).not.toHaveProperty('tokenExpiresAt');
    expect(snapshot.infra?.updates).toMatchObject({ state: 'idle', currentVersion: '0.4.5' });
    expect(snapshot.infra).not.toHaveProperty('optionalHelpers');
  });
});
