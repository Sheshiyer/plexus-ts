import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

function hexToRgb(value: string): [number, number, number] {
  const hex = value.replace('#', '');
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const next = value / 255;
    return next <= 0.03928 ? next / 12.92 : ((next + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string): number {
  const fg = luminance(hexToRgb(foreground));
  const bg = luminance(hexToRgb(background));
  const light = Math.max(fg, bg);
  const dark = Math.min(fg, bg);
  return (light + 0.05) / (dark + 0.05);
}

describe('Batch30 screenshot matrix and accessibility contract', () => {
  it('pins the aggregate screenshot matrix scripts and evidence path', () => {
    const packageJson = source('package.json');
    const aggregate = source('scripts/capture-design-system-screenshot-matrix.mjs');
    const today = source('scripts/capture-today-screenshot-matrix.mjs');
    const assistant = source('scripts/capture-assistant-screenshot-matrix.mjs');

    expect(packageJson).toContain('"capture:design-system:matrix": "node scripts/capture-design-system-screenshot-matrix.mjs"');
    expect(aggregate).toContain('docs/evidence/2026-07-10-batch30-design-system-screenshot-matrix');
    expect(aggregate).toContain('scripts/capture-today-screenshot-matrix.mjs');
    expect(aggregate).toContain('scripts/capture-assistant-screenshot-matrix.mjs');
    expect(aggregate).toContain('P7-W3-T019');
    expect(aggregate).toContain('P7-W3-T024');

    for (const token of ['idle-ready-1536.png', 'running-session-1536.png', 'long-text-1040.png', 'assistant-degraded-1040.png', 'missing-proof-1536.png']) {
      expect(today).toContain(token);
    }

    for (const token of ['full-panel-1536.png', 'sidechat-1040.png', 'confirm-modal-1280.png', 'context-drawer-1280.png']) {
      expect(assistant).toContain(token);
    }
  });

  it('routes the full Clio assistant panel through the real app shell', () => {
    const app = source('src/renderer/App.tsx');
    const assistant = source('scripts/capture-assistant-screenshot-matrix.mjs');

    expect(app).toContain("type Tab = 'timer' | 'identity' | 'assistant'");
    expect(app).toContain("{ key: 'assistant', label: 'Clio', hint: 'assistant workbench', Icon: IconBridge }");
    expect(app).toContain("assistant: { tab: 'assistant' }");
    expect(app).toContain("tab === 'assistant' && <AssistantPanel projects={projects} surface=\"page\" todaySnapshot={todaySnapshot} />");
    expect(assistant).toContain("route: '?splash=0&tab=assistant'");
    expect(assistant).toContain('.px-assistant-page.surface-page');
  });

  it('keeps keyboard-visible focus rings on core interactive classes', () => {
    const theme = source('src/renderer/theme.css');
    const focusClasses = [
      '.px-btn',
      '.px-hud-action',
      '.px-nav',
      '.px-nav-toggle',
      '.px-command-card',
      '.px-room-stage-option',
      '.px-screen-wall-tile',
      '.px-lounge-ctl',
    ];

    for (const selector of focusClasses) {
      expect(theme).toContain(`${selector}:focus-visible`);
    }
    expect(theme).toContain('outline:2px solid var(--accent)');
    expect(theme).toContain('box-shadow:var(--glow-accent)');
  });

  it('keeps icon-only buttons and modals accessible to keyboard users', () => {
    const app = source('src/renderer/App.tsx');
    const ui = source('src/renderer/components/ui.tsx');

    expect(app).toContain('className="px-hud-action icon-only"');
    expect(app).toContain('aria-label="Open optional helper status"');
    expect(app).toContain('aria-label="Keyboard shortcuts"');
    expect(ui).toContain('role="dialog"');
    expect(ui).toContain('aria-modal="true"');
    expect(ui).toContain("aria-label={typeof title === 'string' ? title : 'Dialog'}");
  });

  it('pins reduced-motion handling for global animation and profile tilt', () => {
    const theme = source('src/renderer/theme.css');
    const profile = source('src/renderer/components/ProfileCard.tsx');

    expect(theme).toContain('@media (prefers-reduced-motion: reduce)');
    expect(theme).toContain('.px-profile-card{--pc-rotate-x:0deg!important;--pc-rotate-y:0deg!important;--pc-opacity:.72!important}');
    expect(profile).toContain("window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true");
    expect(profile).toContain('if (!enableTilt || reduceMotion) return;');
  });

  it('keeps contrast tokens explicit and reserves low-contrast tokens for metadata', () => {
    const theme = source('src/renderer/theme.css');

    expect(contrast('#D6FFF6', '#001417')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#E0FF4F', '#001417')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#C4A77D', '#001417')).toBeGreaterThanOrEqual(3);
    expect(contrast('#F0A0A0', '#001417')).toBeGreaterThanOrEqual(3);
    expect(contrast('#062B2D', '#EEF6F1')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#4F6E10', '#EEF6F1')).toBeGreaterThanOrEqual(4.5);
    expect(theme).toContain('/* text — opacity-only hierarchy on mint */');
    expect(theme).toContain('--t3:rgba(214,255,246,.36); --t4:rgba(214,255,246,.20)');
    expect(theme).toContain('--t3:rgba(0,31,34,.45); --t4:rgba(0,31,34,.26)');
  });
});
