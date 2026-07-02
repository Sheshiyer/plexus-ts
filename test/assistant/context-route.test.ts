import { describe, expect, it } from 'vitest';
import { buildAssistantContext, updateAssistantRouteContext } from '../../src/main/assistant-context';

describe('assistant route context', () => {
  it('stores and exposes current app route state in memory', async () => {
    updateAssistantRouteContext({
      routeKey: 'reports.daily',
      selectedProjectId: 'project_verified',
    }, '2026-07-01T09:00:00.000Z');

    const snapshot = await buildAssistantContext({
      contextScopes: ['app'],
      now: '2026-07-01T09:05:00.000Z',
    });

    expect(snapshot.route).toEqual({
      routeKey: 'reports.daily',
      selectedProjectId: 'project_verified',
      updatedAt: '2026-07-01T09:00:00.000Z',
    });
  });

  it('allows injected route state for renderer-independent tests', async () => {
    const snapshot = await buildAssistantContext({
      contextScopes: ['app'],
      now: '2026-07-01T09:05:00.000Z',
      routeState: {
        routeKey: 'projects.detail',
        selectedProjectId: 'project_missing',
        updatedAt: '2026-07-01T09:04:00.000Z',
      },
    });

    expect(snapshot.route?.routeKey).toBe('projects.detail');
    expect(snapshot.route?.selectedProjectId).toBe('project_missing');
  });
});
