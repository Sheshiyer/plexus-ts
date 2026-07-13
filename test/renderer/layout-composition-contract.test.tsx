import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('app-wide layout composition contract', () => {
  it('sizes the application from available space instead of a fixed minimum viewport', () => {
    const theme = source('src/renderer/theme.css');

    expect(theme).not.toContain('min-width:1040px');
    expect(theme).not.toContain('min-height:700px');
    expect(theme).toMatch(/html,body,#root\{[^}]*min-width:0[^}]*min-height:0/);
    expect(theme).toMatch(/\.px-main\{[^}]*container-name:px-main[^}]*container-type:inline-size/);
  });

  it('makes dense Admin and Settings modules full-row compositions', () => {
    const theme = source('src/renderer/theme.css');
    const admin = source('src/renderer/components/AdminProofCockpitPanel.tsx');
    const settings = source('src/renderer/components/Settings.tsx');

    expect(theme).toMatch(/\.px-admin-layout\{[^}]*grid-template-columns:1fr/);
    expect(theme).toMatch(/\.px-settings-module-grid\{[^}]*grid-template-columns:1fr/);
    expect(theme).toMatch(/\.px-assistant-settings-grid\{[^}]*grid-template-columns:1fr/);
    expect(theme).toContain('.px-preferences-embedded .px-character-console{grid-template-columns:1fr;align-items:start}');
    expect(admin.match(/density="dense"/g)?.length ?? 0).toBeGreaterThanOrEqual(10);
    expect(settings).toContain('data-layout-span={resolvedSpan}');
    expect(theme).toContain('.px-proof-group-rail{grid-column:1/-1;grid-row:2');
    expect(theme).toMatch(/\.px-proof-group-chip span\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
  });

  it('recomposes dense page bands from main and panel container widths', () => {
    const theme = source('src/renderer/theme.css');

    expect(theme).toContain('@container px-main (max-width:1100px)');
    expect(theme).toContain('.px-report-split,.px-timer-layout,.px-today-section-grid,.px-assistant-layout');
    expect(theme).toContain('.px-room-stage-shell,.px-room-stage-body,.px-lounge-active');
    expect(theme).toContain('.px-proof-coverage-strip,.px-proof-blocker-report{grid-template-columns:1fr}');
    expect(theme).toContain('.px-proof-coverage-copy,.px-proof-coverage-meter,.px-proof-action-summary,.px-proof-group-rail{grid-column:auto;grid-row:auto}');
    expect(theme).toContain('.px-settings-section .pxds-metric-grid-identity{grid-template-columns:1fr}');
    expect(theme).toContain('.px-assistant-key-grid{grid-template-columns:1fr}');
    expect(theme).toContain('.px-assistant-layout > .px-assistant-thread-panel{order:-1}');
    expect(theme).toMatch(/\.px-room-stage-body\{[^}]*overflow:hidden/);
    expect(theme).toContain('@container px-panel (max-width:680px)');
    expect(theme).toMatch(/\.pxds-ledger-meta\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).not.toContain('.px-timer-layout{grid-template-columns:minmax(460px,1.15fr)');
    expect(theme).not.toContain('.px-assistant-layout{grid-template-columns:minmax(220px,.38fr)');
  });

  it('wraps operational Admin and Settings copy instead of masking it', () => {
    const theme = source('src/renderer/theme.css');

    expect(theme).toMatch(/\.px-admin-test-banner-copy strong\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-command-title strong\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-command-meta\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-datum-secondary\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-identity-skill-main strong\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-identity-companion-head strong\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-work-entry-resolver-status strong\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-work-entry-resolver-status small\{[^}]*white-space:normal[^}]*overflow-wrap:anywhere/);
    expect(theme).toMatch(/\.px-form-band\{[^}]*min-width:0[^}]*max-width:100%/);
  });

  it('keeps expanded settings content and short-height dialogs reachable', () => {
    const theme = source('src/renderer/theme.css');
    const ui = source('src/renderer/components/ui.tsx');

    expect(theme).toContain('.px-settings-section.is-active{overflow:visible}');
    expect(theme).toContain('.px-settings-section.is-active .px-settings-section-body-inner{overflow:visible}');
    expect(theme).toMatch(/\.px-settings-section\{[^}]*overflow:visible/);
    expect(theme).toMatch(/\.px-settings-section-body-inner\{[^}]*overflow:visible/);
    expect(theme).toMatch(/\.px-backdrop\{[^}]*overflow:auto/);
    expect(theme).toMatch(/\.px-modal\{[^}]*max-height:calc\(100dvh - 2rem\)[^}]*overflow:auto/);
    expect(theme).toContain('.px-modal>.px-cross.tl{top:0;left:0}');
    expect(theme).toContain('.px-modal>.px-cross.br{bottom:0;right:0}');
    expect(ui).toContain("import { createPortal } from 'react-dom';");
    expect(ui).toContain("typeof document === 'undefined' ? content : createPortal(content, document.body)");
    expect(theme).toContain('.px-onboarding-flow-footer{grid-template-columns:1fr}');
  });

  it('keeps a long account identity inside its HUD cell', () => {
    const app = source('src/renderer/App.tsx');
    const theme = source('src/renderer/theme.css');

    expect(app).toContain('className="px-hud-identity"');
    expect(app).toContain('title={`${session?.email ?? `${APP_MUSE} v${APP_VERSION}`} · ${session?.role}`}');
    expect(app).toContain('aria-label={`${session?.email ?? `${APP_MUSE} v${APP_VERSION}`} · ${session?.role}`}');
    expect(theme).toMatch(/\.px-hud-identity\{[^}]*min-width:0[^}]*overflow:hidden[^}]*text-overflow:ellipsis/);
    expect(app).toContain('className="px-hud-action px-hud-testing"');
    expect(app).toContain("adminEmployeeMode?.role === 'employee' ? ' employee-mode' : ''");
    expect(theme).toMatch(/\.px-hud-testing\{[^}]*min-width:0[^}]*max-width:[^;}]+[^}]*overflow:hidden/);
    expect(theme).toMatch(/\.px-hud-testing span\{[^}]*overflow:hidden[^}]*text-overflow:ellipsis/);
    expect(theme).toContain('.px-hud-cell.center.employee-mode .px-hud-status{display:none}');
  });
});
