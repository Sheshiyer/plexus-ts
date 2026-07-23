import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

// Task 1 stubbed the Paperclip/Fabric install-gate (`paperclipInstalled`, always
// false) so the renderer kept compiling after the main-process runtime was
// removed. Task 2 finishes the job: the gate, the companion roster it guarded,
// and the helper perk it hid are gone outright, not stubbed.
describe('identity panel has no Paperclip install-gate left (fully retired, not stubbed)', () => {
  const panel = source('src/renderer/components/IdentityPanel.tsx');

  it('has no paperclip/fabric install-gate scaffolding', () => {
    expect(panel).not.toContain('fabricInstallStatus');
    expect(panel).not.toContain('paperclipInstalled');
    expect(panel).not.toMatch(/paperclip/i);
  });

  it('has no companion roster (it existed only to render Fabric agent health)', () => {
    expect(panel).not.toContain('CompanionRoster');
    expect(panel).not.toContain('buildCompanionAgents');
  });

  it('renders perks directly with no helper-perk filtering', () => {
    expect(panel).not.toContain("perk.key !== 'helpers'");
    expect(panel).not.toContain('visiblePerks');
    expect(panel).toContain('perks={perks}');
  });

  it('drops the helper status token from the hero entirely', () => {
    expect(panel).not.toContain('helperLayer');
  });
});
