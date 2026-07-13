import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Clio shell navigation contract', () => {
  it('keeps Clio side chat primary and the workbench out of primary navigation', () => {
    const app = source('src/renderer/App.tsx');
    const sideChat = source('src/renderer/components/ClioSideChat.tsx');

    expect(app).not.toContain("{ key: 'assistant', label: 'Clio'");
    expect(app).toContain("const openAssistantWorkbench = () =>");
    expect(sideChat).toContain('onOpenWorkbench');
    expect(sideChat).toContain('onOpenSettings');
    expect(sideChat).toContain('Clio settings');
  });

  it('gives the global Clio trigger a stable icon and name independent of runtime state', () => {
    const app = source('src/renderer/App.tsx');
    const connectionStatus = source('src/renderer/components/ConnectionStatus.tsx');

    expect(connectionStatus).toContain('<IconBridge');
    expect(connectionStatus).toContain('<span>Clio</span>');
    expect(connectionStatus).toContain('px-assistant-header-runtime');
    expect(app).not.toContain("assistantConnection.status.status?.availability === 'needs_model_key'");
    expect(app).toContain('setClioSideChatOpen((current) => !current)');
  });

  it('uses one-shot launch routing so founders can remain on their personal Today page', () => {
    const app = source('src/renderer/App.tsx');

    expect(app).toContain('sessionLaunchAppliedRef');
    expect(app).toContain('authorizeRouteTarget');
    expect(app).not.toContain("session.role === 'admin' && tab === TODAY_ROUTE_TARGET.tab");
  });

  it('keeps every Clio configuration group in Settings', () => {
    const settings = source('src/renderer/components/Settings.tsx');

    for (const marker of [
      'Clio runtime',
      'model fallbacks',
      'context consent',
      'Clio session memories',
      'Save Clio',
    ]) {
      expect(settings).toContain(marker);
    }
  });

  it('renders the Today timer controls before the diagnostic snapshot', () => {
    const timer = source('src/renderer/components/Timer.tsx');

    expect(timer.indexOf('px-timer-layout')).toBeGreaterThan(-1);
    expect(timer.indexOf('{todaySnapshot && <TodaySnapshotPanel')).toBeGreaterThan(timer.indexOf('px-timer-layout'));
  });
});
