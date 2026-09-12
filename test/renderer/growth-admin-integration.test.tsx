import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { authorizeRouteTarget } from '../../src/renderer/routePolicy';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Growth admin integration', () => {
  it('keeps Growth inside the existing admin utility surface', () => {
    const app = source('src/renderer/App.tsx');
    const admin = source('src/renderer/components/AdminDemoPanel.tsx');

    expect(app).toContain("['proof', 'overview', 'growth', 'reports', 'export', 'backups', 'diagnostics']");
    expect(admin).toContain("key: 'growth'");
    expect(admin).toContain("{section === 'growth' && <GrowthOverviewPanel />}");
    expect(app).toContain("session.role === 'admin' && <AdminDemoPanel");
  });

  it('preserves the employee admin-route guard for the Growth section', () => {
    expect(authorizeRouteTarget({ tab: 'admin', adminSection: 'growth' }, 'employee')).toEqual({
      tab: 'timer',
      adminSection: undefined,
    });
  });

  it('uses a narrow, sender-guarded, admin-only read capability', () => {
    const main = source('src/main/main.ts');
    const preload = source('src/preload/preload.ts');
    const types = source('src/shared/types.ts');

    expect(main).toContain("guardedHandle('growth:overview', undefined");
    expect(main).toContain("await assertActiveAdminSession();\n  const { getGrowthOverview } = await import('./growth-overview.js');");
    expect(preload).toContain("growthOverview: () => ipcRenderer.invoke('growth:overview')");
    expect(types).toContain('growthOverview: () => Promise<GrowthOverview>');
  });

  it('does not add an approval, write, or transport path to the Growth reader', () => {
    const reader = source('src/main/growth-overview.ts');
    const panel = source('src/renderer/components/GrowthOverviewPanel.tsx');

    expect(reader).not.toMatch(/\b(writeFile|appendFile|unlink|rename|openExternal|exec|spawn|fetch)\b/);
    expect(panel).toContain('never reads draft bodies into the renderer');
    expect(panel).toContain('No provider adapter or outbound transport is exposed.');
  });
});
