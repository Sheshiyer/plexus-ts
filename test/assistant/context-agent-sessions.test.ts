import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildAgentSessionCandidate } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant agent sessions context', () => {
  it('exposes consent, candidate summaries, and groups without file paths by default', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['session_group'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async agentSessionStatus() {
          return {
            ok: true,
            enabled: true,
            scanned: 2,
            imported: 2,
            totalPending: 2,
            matchedPending: 2,
            readyPending: 2,
            candidates: [
              buildAgentSessionCandidate({ id: 'codex_1', provider: 'codex' }),
              buildAgentSessionCandidate({ id: 'claude_1', provider: 'claude' }),
            ],
            roots: [],
          };
        },
      }),
    });

    expect(snapshot.agentSessions.consentState).toBe('enabled');
    expect(snapshot.agentSessions.candidates).toHaveLength(2);
    expect(snapshot.agentSessions.candidates[0]).not.toHaveProperty('sourcePath');
    expect(snapshot.sessionGroups).toHaveLength(1);
    expect(snapshot.sessionGroups[0].providerCounts).toMatchObject({ codex: 1, claude: 1 });
  });

  it('includes diagnostic paths only for admin diagnostics', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['session_group'],
      includeAdminDiagnostics: true,
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources(),
    });

    expect(snapshot.agentSessions.candidates[0].sourcePath).toContain('/mock/');
  });
});
