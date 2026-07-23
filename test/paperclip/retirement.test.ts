import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('paperclip retirement — main process', () => {
  it('fabric.ts is deleted and unreferenced', () => {
    expect(existsSync(resolve(process.cwd(), 'src/main/fabric.ts'))).toBe(false);
    expect(source('src/main/main.ts')).not.toContain("from './fabric");
  });

  it('fabric IPC channels and preload methods are gone', () => {
    expect(source('src/main/main.ts')).not.toContain("'fabric:");
    // Note: the ThoughtseedFabricTask feature (task assignments) is unrelated to the
    // retired Paperclip fabric-health runtime and stays wired via `thoughtseed:fabricTasks`
    // etc., so we assert the specific retired methods rather than the bare substring.
    expect(source('src/preload/preload.ts')).not.toContain('fabricStatus');
    expect(source('src/preload/preload.ts')).not.toContain('fabricHealthProbe');
    expect(source('src/preload/preload.ts')).not.toContain('fabricInstallStatus');
    expect(source('src/shared/types.ts')).not.toContain('fabricInstallStatus');
  });

  it('assistant context and prompt no longer reference Paperclip', () => {
    expect(source('src/main/assistant-context.ts')).not.toMatch(/paperclip/i);
    expect(source('src/main/assistant-runtime.ts')).not.toMatch(/paperclip/i);
  });

  it('wire-contract fields survive', () => {
    expect(source('src/shared/types.ts')).toContain('sendToPaperclip');
    expect(source('src/shared/types.ts')).toContain('paperclipStatus');
    expect(source('src/shared/thoughtseed-fabric-task.ts')).toContain("'paperclip'");
  });
});

describe('paperclip retirement — renderer', () => {
  it('AgentFabricPanel is deleted and unrouted', () => {
    expect(existsSync(resolve(process.cwd(), 'src/renderer/components/AgentFabricPanel.tsx'))).toBe(false);
    expect(source('src/renderer/App.tsx')).not.toContain('AgentFabricPanel');
  });

  it('onboarding, settings, identity lose the helper surfaces', () => {
    expect(source('src/renderer/components/Onboarding.tsx')).not.toContain('PaperclipPreflight');
    expect(source('src/renderer/components/Settings.tsx')).not.toMatch(/paperclip/i);
    expect(source('src/renderer/components/IdentityPanel.tsx')).not.toMatch(/paperclip/i);
  });

  it('member:setup / memberSetup is fully removed (routed scope)', () => {
    expect(source('src/main/main.ts')).not.toContain("'member:setup'");
    expect(source('src/preload/preload.ts')).not.toContain('memberSetup');
    expect(source('src/shared/types.ts')).not.toContain('memberSetup');
    expect(source('src/renderer/components/Onboarding.tsx')).not.toContain('memberSetup');
    expect(source('src/renderer/components/Settings.tsx')).not.toContain('memberSetup');
  });

  it('assistantPaperclipEnrichmentEnabled toggle and field are removed (routed scope)', () => {
    expect(source('src/shared/types.ts')).not.toContain('assistantPaperclipEnrichmentEnabled');
    expect(source('src/renderer/components/Settings.tsx')).not.toContain('assistantPaperclipEnrichmentEnabled');
  });

  it('no renderer component polls the removed fabric APIs', () => {
    const offenders = execSync(
      "grep -rl --exclude-dir=dist 'fabricInstallStatus\\|fabricStatus\\|fabricHealthProbe' src/renderer || true",
      { cwd: process.cwd(), encoding: 'utf8' },
    ).trim();
    expect(offenders).toBe('');
  });

  it('AssistantContextDrawer no longer carries the helpers/optional-helper surface', () => {
    expect(source('src/renderer/components/AssistantContextDrawer.tsx')).not.toMatch(/paperclip/i);
    expect(source('src/renderer/components/AssistantContextDrawer.tsx')).not.toContain('AssistantOptionalHelperStatus');
    expect(source('src/renderer/components/AssistantPanel.tsx')).not.toMatch(/paperclip/i);
  });
});
