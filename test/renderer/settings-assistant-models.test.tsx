import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  PRODUCTION_OMNIROUTE_LANES,
  normalizeAssistantOmniRouteCatalog,
} from '../../src/shared/native-assistant';
import type { ComponentType } from 'react';

let TemperanceLaneSettings: ComponentType<{
  catalog: ReturnType<typeof catalog>;
  selectedLaneId: string;
  onSelect: (laneId: string) => void;
}>;

beforeAll(async () => {
  vi.stubGlobal('__APP_VERSION__', 'test');
  ({ TemperanceLaneSettings } = await import('../../src/renderer/components/Settings'));
});

function catalog() {
  return normalizeAssistantOmniRouteCatalog({
    data: PRODUCTION_OMNIROUTE_LANES.map((lane) => ({
      id: lane.id,
      health: lane.id === 'te-free-burst' ? 'degraded' : 'healthy',
      lastVerifiedAt: '2026-07-27T19:16:00.000Z',
    })),
  }, { selectedLaneId: 'te-build' });
}

describe('Clio Temperance lane settings', () => {
  it('renders all 15 production lanes with purpose, strategy, ordered members, and health', () => {
    const html = renderToStaticMarkup(
      <TemperanceLaneSettings catalog={catalog()} selectedLaneId="te-build" onSelect={vi.fn()} />,
    );

    expect((html.match(/data-temperance-lane=/g) ?? [])).toHaveLength(15);
    for (const lane of PRODUCTION_OMNIROUTE_LANES) {
      expect(html).toContain(`data-temperance-lane="${lane.id}"`);
      expect(html).toContain(lane.purpose);
      expect(html).toContain(lane.strategy);
      for (const member of lane.members) expect(html).toContain(member);
    }
    expect(html).toContain('healthy');
    expect(html).toContain('degraded');
  });

  it('shows fusion judges and labels rankings as evidence rather than entitlement', () => {
    const html = renderToStaticMarkup(
      <TemperanceLaneSettings catalog={catalog()} selectedLaneId="te-validate" onSelect={vi.fn()} />,
    );

    expect(html).toContain('Fusion judge');
    expect(html).toContain('openai-compatible-commandcode/moonshotai/Kimi-K3');
    expect(html).toContain('Ranker evidence');
    expect(html).toContain('not live entitlement');
  });

  it('never renders te-bench, raw aliases, credentials, or direct-provider controls', () => {
    const html = renderToStaticMarkup(
      <TemperanceLaneSettings catalog={catalog()} selectedLaneId="te-build" onSelect={vi.fn()} />,
    );
    const settingsSource = readFileSync(
      path.resolve(process.cwd(), 'src/renderer/components/Settings.tsx'),
      'utf8',
    );

    expect(html).not.toContain('te-bench');
    expect(html).not.toContain('google/gemini');
    expect(settingsSource).not.toMatch(/Google key|NVIDIA key|Local endpoint|assistantGoogleApiKey|assistantNvidiaApiKey/);
  });

  it('uses a native accessible lane selector with the saved lane selected', () => {
    const html = renderToStaticMarkup(
      <TemperanceLaneSettings catalog={catalog()} selectedLaneId="te-build" onSelect={vi.fn()} />,
    );

    expect(html).toContain('Recommended: Build');
    expect(html).toContain('<select');
    expect(html).toContain('aria-label="Select Temperance model lane"');
    expect(html).toMatch(/<option value="te-build" selected="">Build · healthy · priority<\/option>/);
    expect((html.match(/<option value=/g) ?? [])).toHaveLength(15);
    expect(html).not.toContain('role="radio"');
  });

  it('renders distinct actionable sign-in-required and gateway-offline states', () => {
    const signedOut = renderToStaticMarkup(
      <TemperanceLaneSettings
        catalog={{ ...catalog(), entries: [], gatewayState: 'sign_in_required', message: 'Sign in to Plexus.' }}
        selectedLaneId="te-build"
        onSelect={vi.fn()}
      />,
    );
    const offline = renderToStaticMarkup(
      <TemperanceLaneSettings
        catalog={{ ...catalog(), entries: [], gatewayState: 'offline', message: 'Gateway offline.' }}
        selectedLaneId="te-build"
        onSelect={vi.fn()}
      />,
    );

    expect(signedOut).toMatch(/Sign in to Plexus.*Open sign-in/i);
    expect(offline).toMatch(/Gateway offline.*Retry catalog/i);
  });
});
