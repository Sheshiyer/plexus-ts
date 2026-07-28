import { describe, expect, it, vi } from 'vitest';
import {
  ASSISTANT_RECOMMENDED_LANE,
  PRODUCTION_OMNIROUTE_LANES,
  normalizeAssistantOmniRouteCatalog,
} from '../../src/shared/native-assistant';
import { discoverAssistantModelCatalog } from '../../src/main/assistant-model-catalog';
import { resolveAssistantModelConfig } from '../../src/main/assistant-models';
import { OmniRouteAccessRequiredError } from '../../src/main/teamforge';

function relayCatalog(extra: Array<Record<string, unknown>> = []) {
  return {
    object: 'list',
    data: [
      ...PRODUCTION_OMNIROUTE_LANES.map((lane) => ({
        id: lane.id,
        object: 'model',
        health: 'healthy',
        lastVerifiedAt: '2026-07-27T19:16:00.000Z',
      })),
      ...extra,
    ],
  };
}

describe('OmniRoute assistant lane catalog contract', () => {
  it('normalizes exactly the 15 governed production lanes with portfolio metadata', () => {
    const catalog = normalizeAssistantOmniRouteCatalog(relayCatalog(), {
      now: new Date('2026-07-28T00:00:00.000Z'),
      selectedLaneId: 'te-plan',
    });

    expect(catalog.entries).toHaveLength(15);
    expect(catalog.entries.every((entry) => entry.provider === 'omniroute')).toBe(true);
    expect(catalog.entries.every((entry) => entry.model === entry.id)).toBe(true);
    expect(catalog.entries.every((entry) => entry.label && entry.purpose)).toBe(true);
    expect(catalog.entries.every((entry) => ['priority', 'fusion'].includes(entry.strategy))).toBe(true);
    expect(catalog.entries.every((entry) => entry.members.length >= 3)).toBe(true);
    expect(catalog.entries.every((entry) => entry.release.status === 'live-verified')).toBe(true);
    expect(catalog.entries.every((entry) => entry.rankerEvidence.rankedModels === 61)).toBe(true);
    expect(catalog.entries.every((entry) => entry.health === 'healthy')).toBe(true);
    expect(catalog.entries.every((entry) => entry.lastVerifiedAt === '2026-07-27T19:16:00.000Z')).toBe(true);
    expect(catalog.selectedModelId).toBe('te-plan');
    expect(catalog.recommendedModelId).toBe(ASSISTANT_RECOMMENDED_LANE);
  });

  it('keeps fusion judges while excluding te-bench and arbitrary raw models', () => {
    const catalog = normalizeAssistantOmniRouteCatalog(relayCatalog([
      { id: 'te-bench', health: 'healthy' },
      { id: 'deepseek/deepseek-v4-pro', health: 'healthy' },
      { id: 'google/gemini-3.6-flash', health: 'healthy' },
    ]));

    expect(catalog.entries.map((entry) => entry.id)).not.toContain('te-bench');
    expect(catalog.entries.map((entry) => entry.id)).not.toContain('deepseek/deepseek-v4-pro');
    expect(catalog.entries.map((entry) => entry.id)).not.toContain('google/gemini-3.6-flash');
    expect(catalog.entries.filter((entry) => entry.strategy === 'fusion')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'te-validate', judgeModel: expect.stringContaining('/') }),
        expect.objectContaining({ id: 'te-write-critique', judgeModel: expect.stringContaining('/') }),
        expect.objectContaining({ id: 'te-write-research', judgeModel: expect.stringContaining('/') }),
      ]),
    );
  });

  it('marks an incomplete or unverified server catalog unavailable instead of inventing selectable lanes', () => {
    const catalog = normalizeAssistantOmniRouteCatalog({
      data: [
        { id: 'te-build', health: 'healthy', lastVerifiedAt: 'not-a-date' },
        { id: 'te-bench', health: 'healthy' },
      ],
    });

    expect(catalog.gatewayState).toBe('invalid_catalog');
    expect(catalog.entries).toEqual([]);
    expect(catalog.selectedModelId).toBeNull();
    expect(catalog.message).toMatch(/verified production lane catalog/i);
  });

  it('rejects complete catalogs that omit live health or verification evidence', () => {
    const withoutHealth = relayCatalog();
    delete withoutHealth.data[0].health;
    const withoutVerification = relayCatalog();
    delete withoutVerification.data[0].lastVerifiedAt;

    for (const payload of [withoutHealth, withoutVerification]) {
      const catalog = normalizeAssistantOmniRouteCatalog(payload, {
        now: new Date('2026-07-28T00:00:00.000Z'),
      });
      expect(catalog).toMatchObject({
        gatewayState: 'invalid_catalog',
        selectedModelId: null,
        entries: [],
      });
      expect(JSON.stringify(catalog)).not.toContain('live-verified');
    }
  });

  it('keeps deterministic mock explicit and outside production fallback ordering', () => {
    const catalog = normalizeAssistantOmniRouteCatalog(relayCatalog());

    expect(catalog.recommendedModelId).toBe('te-build');
    expect(catalog.fallbackModelIds).toEqual([]);
    expect(catalog.entries.some((entry) => entry.provider === 'mock')).toBe(false);
  });

  it('loads the governed catalog from the canonical authenticated relay route', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(relayCatalog()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const catalog = await discoverAssistantModelCatalog(
      resolveAssistantModelConfig({ laneId: 'te-review' }),
      {
        origin: 'https://models.thoughtseed.space',
        fetch,
        now: () => new Date('2026-07-28T00:00:00.000Z'),
      },
    );

    expect(fetch).toHaveBeenCalledWith(
      'https://models.thoughtseed.space/v1/models',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(catalog.gatewayState).toBe('ready');
    expect(catalog.selectedModelId).toBe('te-review');
  });

  it('distinguishes sign-in-required from gateway offline without fallback entries', async () => {
    const config = resolveAssistantModelConfig();
    const signedOut = await discoverAssistantModelCatalog(config, {
      origin: 'https://models.thoughtseed.space',
      fetch: async () => new Response('{}', { status: 401 }),
    });
    const offline = await discoverAssistantModelCatalog(config, {
      origin: 'https://models.thoughtseed.space',
      fetch: async () => {
        throw new Error('ECONNREFUSED response-secret=do-not-leak');
      },
    });
    const accessRedirect = await discoverAssistantModelCatalog(config, {
      origin: 'https://models.thoughtseed.space',
      fetch: async () => {
        throw new OmniRouteAccessRequiredError(new TypeError('fetch failed'));
      },
    });

    expect(signedOut).toMatchObject({ gatewayState: 'sign_in_required', entries: [] });
    expect(accessRedirect).toMatchObject({ gatewayState: 'sign_in_required', entries: [] });
    expect(offline).toMatchObject({ gatewayState: 'offline', entries: [] });
    expect(JSON.stringify(offline)).not.toContain('do-not-leak');
  });
});
