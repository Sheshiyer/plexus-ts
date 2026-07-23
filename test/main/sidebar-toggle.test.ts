import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('sidebar toggle reflects auto-collapse state', () => {
  it('derives effective collapse from Clio side chat and narrow viewport', () => {
    const app = source('src/renderer/App.tsx');

    expect(app).toContain('const sidebarAutoCollapsed = clioSideChatOpen || isNarrowViewport;');
    expect(app).toContain('const sidebarEffectivelyCollapsed = navCollapsed || sidebarAutoCollapsed;');
    // Sidebar class must track the effective value, not raw navCollapsed.
    expect(app).toMatch(/px-side\$\{sidebarEffectivelyCollapsed \? ' collapsed' : ''\}/);
  });

  it('disables the toggle instead of leaving a silent no-op', () => {
    const app = source('src/renderer/App.tsx');

    expect(app).toContain('disabled={sidebarAutoCollapsed}');
    expect(app).toContain('if (sidebarAutoCollapsed) return;');
    // Honest tooltip copy for both forced states.
    expect(app).toContain('auto-collapsed while Clio chat is open');
    expect(app).toContain('auto-collapsed on narrow windows');
  });

  it('tracks the same 920px breakpoint the CSS uses', () => {
    const app = source('src/renderer/App.tsx');
    const css = source('src/renderer/theme.css');

    expect(app).toContain("matchMedia?.('(max-width: 920px)')");
    expect(css).toContain('@media (max-width: 920px)');
  });
});
