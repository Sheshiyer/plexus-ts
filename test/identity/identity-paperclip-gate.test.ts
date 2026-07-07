import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('identity panel hides Paperclip surfaces until Paperclip is installed', () => {
  const panel = source('src/renderer/components/IdentityPanel.tsx');

  it('reads Paperclip install status', () => {
    expect(panel).toContain('window.plexus.fabricInstallStatus()');
    expect(panel).toContain('state.install?.binaryFound === true');
    expect(panel).toContain('const paperclipInstalled');
  });

  it('gates the optional-helpers companion roster on install', () => {
    expect(panel).toMatch(/paperclipInstalled\s*&&\s*\(\s*<CompanionRoster/);
  });

  it('drops the helper perk when Paperclip is absent', () => {
    expect(panel).toContain("perk.key !== 'helpers'");
    expect(panel).toContain('visiblePerks');
    expect(panel).toContain('perks={visiblePerks}');
  });

  it('drops the helper status token from the hero when Paperclip is absent', () => {
    expect(panel).toContain('paperclipInstalled ? [scaffold.helperLayer.statusLabel] : []');
  });
});
