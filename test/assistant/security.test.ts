import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AssistantModelSettingsInput } from '../../src/shared/native-assistant';

const source = (relativePath: string) => readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

describe('OmniRoute assistant renderer-safe contract', () => {
  it('accepts only provider and governed lane metadata in settings input', () => {
    const input: AssistantModelSettingsInput = {
      provider: 'omniroute',
      laneId: 'te-build',
    };

    expect(Object.keys(input).sort()).toEqual(['laneId', 'provider']);
    expect(JSON.stringify(input)).not.toMatch(/api.?key|base.?url|jwt|cookie/i);
  });

  it('contains no direct-provider keys, arbitrary base URL, or credential-bearing catalog fields', () => {
    const sharedContract = source('src/shared/native-assistant.ts');
    const sharedTypes = source('src/shared/types.ts');
    const rendererSurface = `${sharedContract}\n${sharedTypes}`;

    expect(rendererSurface).not.toMatch(/googleApiKey|nvidiaApiKey|localBaseUrl/);
    expect(rendererSurface).not.toMatch(/accessJwt|Cf-Access-Jwt-Assertion|OmniRouteApiKey|cookie/i);
  });
});
