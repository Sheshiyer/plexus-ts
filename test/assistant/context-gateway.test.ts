import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';

describe('assistant context gateway', () => {
  it('returns a valid empty snapshot when no scopes are requested', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: [],
      now: '2026-07-01T09:00:00.000Z',
    });

    expect(snapshot.generatedAt).toBe('2026-07-01T09:00:00.000Z');
    expect(snapshot.requestedScopes).toEqual([]);
    expect(snapshot.projects).toEqual([]);
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.githubActivity).toEqual([]);
    expect(snapshot.sessionGroups).toEqual([]);
    expect(snapshot.agentSessions.candidates).toEqual([]);
    expect(snapshot.timer).toEqual({ running: false });
    expect(snapshot.evidence).toBeNull();
    expect(snapshot.infra).toBeNull();
    expect(snapshot.route).toBeNull();
  });
});
