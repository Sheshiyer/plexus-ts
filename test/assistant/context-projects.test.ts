import { describe, expect, it } from 'vitest';
import { buildAssistantContext } from '../../src/main/assistant-context';
import { buildProject } from './fixtures/builders';
import { buildContextSources } from './fixtures/context-sources';

describe('assistant projects context', () => {
  it('exposes read-only project context sorted active before archived', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['project'],
      now: '2026-07-01T09:00:00.000Z',
      sources: buildContextSources({
        async listProjects() {
          return [
            buildProject({ id: 'archived', name: 'Archived', archived: true }),
            buildProject({ id: 'active', name: 'Active', archived: false, clientName: 'Client' }),
          ];
        },
      }),
    });

    expect(snapshot.projects.map((project) => project.id)).toEqual(['active', 'archived']);
    expect(snapshot.projects[0]).toMatchObject({
      id: 'active',
      name: 'Active',
      clientName: 'Client',
      archived: false,
      repo: { status: 'verified', required: true },
    });
    expect(JSON.stringify(snapshot.projects)).not.toContain('token');
  });
});
