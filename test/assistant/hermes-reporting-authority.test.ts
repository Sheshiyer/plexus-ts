import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

function source(relativePath: string): string {
  return readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('Hermes reporting authority guard', () => {
  it('keeps active provisioning free of retired MultiCA settings and types', () => {
    expect(source('src/shared/types.ts')).not.toContain('multica?: {');
    expect(source('src/main/teamforge.ts')).not.toContain("setSetting('tf.multicaApiUrl'");
  });

  it('names Hermes and Cambium as current reporting surfaces', () => {
    const contract = source('docs/architecture/HERMES_REPORTING_CONTRACT.md');
    expect(contract).toContain('Member-scoped Thoughtseed bridge');
    expect(contract).toContain('Hermes: report routines');
    expect(contract).toContain('Cambium Telegram Mini App');
    expect(contract).toContain('Configured Telegram topics');
    expect(contract).toContain('audience: founder_review');
  });

  it('rejects the known stale authority claims in active product copy', () => {
    const activeCopy = [
      source('README.md'),
      source('docs/ROADMAP.md'),
      source('docs/HANDOFF.md'),
    ].join('\n');
    expect(activeCopy).not.toContain('TeamForge Control Plane');
    expect(activeCopy).not.toMatch(/send(?:s|ing)?[^\n]{0,80}MultiCA/i);
    expect(activeCopy).not.toMatch(/Worker then bridge fallback/i);
  });

  it('keeps Telegram routing and infrastructure tokens outside the bridge payload source', () => {
    const bridge = source('src/main/thoughtseed-bridge.ts');
    expect(bridge).not.toMatch(/message_thread_id|chat_id|topic_id/i);
    expect(bridge).not.toContain('BRIDGE_TOKEN');
  });
});
