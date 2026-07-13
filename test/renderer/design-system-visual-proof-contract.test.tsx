import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DegradedStatePanel,
  EmptyStatePanel,
  PLEXUS_DEGRADED_STATE_VARIANTS,
  PLEXUS_EMPTY_STATE_VARIANTS,
  type DegradedStateVariant,
  type EmptyStateVariant,
} from '../../src/renderer/components/PlexusUI';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Plexus design-system visual proof contract', () => {
  it('renders named empty-state variants for no records, rooms, backups, and tasks', () => {
    const expected: EmptyStateVariant[] = ['no-records', 'no-rooms', 'no-backups', 'no-tasks'];

    expect(Object.keys(PLEXUS_EMPTY_STATE_VARIANTS).sort()).toEqual([...expected].sort());

    for (const variant of expected) {
      const html = renderToStaticMarkup(<EmptyStatePanel variant={variant} />);
      expect(html).toContain(`variant-${variant}`);
      expect(html).toContain(PLEXUS_EMPTY_STATE_VARIANTS[variant].title);
      expect(html).toContain(PLEXUS_EMPTY_STATE_VARIANTS[variant].message);
    }
  });

  it('renders distinct degraded-state variants without turning ordinary gaps rose', () => {
    const expected: DegradedStateVariant[] = ['offline', 'sync-failed', 'repo-missing', 'proof-inaccessible'];

    expect(Object.keys(PLEXUS_DEGRADED_STATE_VARIANTS).sort()).toEqual([...expected].sort());
    expect(PLEXUS_DEGRADED_STATE_VARIANTS.offline.tone).toBe('warning');
    expect(PLEXUS_DEGRADED_STATE_VARIANTS['repo-missing'].tone).toBe('warning');
    expect(PLEXUS_DEGRADED_STATE_VARIANTS['sync-failed'].tone).toBe('error');
    expect(PLEXUS_DEGRADED_STATE_VARIANTS['proof-inaccessible'].tone).toBe('error');

    for (const variant of expected) {
      const html = renderToStaticMarkup(<DegradedStatePanel variant={variant} />);
      expect(html).toContain(`variant-${variant}`);
      expect(html).toContain(`tone-${PLEXUS_DEGRADED_STATE_VARIANTS[variant].tone}`);
      expect(html).toContain(PLEXUS_DEGRADED_STATE_VARIANTS[variant].title);
    }
  });

  it('pins the aggregate screenshot fixture harness and evidence directory overrides', () => {
    const packageJson = source('package.json');
    const harness = source('scripts/capture-design-system-visual-proof.mjs');
    const today = source('scripts/capture-today-command-center.mjs');
    const admin = source('scripts/capture-admin-proof-cockpit.mjs');
    const coworkingStage = source('scripts/capture-coworking-stage.mjs');
    const coworkingDegraded = source('scripts/capture-coworking-media-consent-degraded.mjs');

    expect(packageJson).toContain('"capture:design-system": "node scripts/capture-design-system-visual-proof.mjs"');
    expect(today).toContain('PLEXUS_TODAY_EVIDENCE_DIR');
    expect(admin).toContain('PLEXUS_ADMIN_PROOF_EVIDENCE_DIR');
    expect(coworkingStage).toContain('PLEXUS_COWORKING_STAGE_EVIDENCE_DIR');
    expect(coworkingDegraded).toContain('PLEXUS_COWORKING_BATCH21_EVIDENCE_DIR');

    for (const file of [
      'scripts/capture-today-command-center.mjs',
      'scripts/capture-admin-proof-cockpit.mjs',
      'scripts/capture-coworking-stage.mjs',
      'scripts/capture-coworking-media-consent-degraded.mjs',
    ]) {
      expect(harness).toContain(file);
    }

    for (const token of [
      '1536x1024',
      '1280x800',
      '1040x700',
      'sidechat CSS contract',
      'emptyStateVariants',
      'degradedStateVariants',
      'roseToneBoundary',
    ]) {
      expect(harness).toContain(token);
    }
  });

  it('keeps breakpoint and sidechat layout guards source-pinned', () => {
    const theme = source('src/renderer/theme.css');

    expect(theme).toContain('html,body,#root{height:100%;min-width:0;min-height:0}');
    expect(theme).toContain('.px-shell.with-sidechat .px-main{flex-basis:0;min-width:0}');
    expect(theme).toContain('container-name:px-main');
    expect(theme).toContain('@container px-main');
    expect(theme).toContain('.px-assistant-page.surface-sidechat .px-assistant-layout{display:grid;grid-template-columns:1fr');
    expect(theme).toContain('@media (max-width:1280px)');
    expect(theme).toContain('@media (max-width:1040px)');
  });

  it('captures Settings density and overflow states inside the screenshot matrix', () => {
    const aggregate = source('scripts/capture-design-system-screenshot-matrix.mjs');
    const assistant = source('scripts/capture-assistant-screenshot-matrix.mjs');

    expect(aggregate).toContain('Settings full-width modules');
    expect(aggregate).toContain('Settings with sidechat');
    expect(assistant).toContain('settings-layout-1536.png');
    expect(assistant).toContain('settings-clio-sidechat-1280.png');
    expect(assistant).toContain('settings-release-1040.png');
    expect(source('scripts/capture-admin-proof-cockpit.mjs')).toContain('compact-1040.png');
    expect(source('scripts/capture-admin-proof-cockpit.mjs')).toContain('adminSection=proof');
    expect(assistant).toContain('identity-sidechat-1040.png');
    expect(assistant).toContain('projects-sidechat-1040.png');
    expect(assistant).toContain('work-records-sidechat-1040.png');
    expect(assistant).toContain('memories-sidechat-1040.png');
    expect(assistant).toContain("'.px-settings-section.is-active'");
    expect(assistant).toContain("'.px-datum-main'");
    expect(assistant).toContain('assertDensePanelsUseFullRows');
    expect(assistant).toContain('assertKeyboardReachable');
    expect(assistant).toContain("keyboardTarget: '#settings-assistant'");
    expect(assistant).toContain("keyboardTarget: '#settings-release'");
    expect(assistant).toContain('assertModalIsTopmost');
    expect(assistant).toContain('modalTopmost: true');
  });

  it('audits rose usage away from non-failure proof states', () => {
    const theme = source('src/renderer/theme.css');
    const records = source('src/renderer/components/TimeEntryList.tsx');

    expect(theme).toContain('.pxds-degraded.variant-repo-missing{border-color:var(--warn-line);background:var(--warn-dim)}');
    expect(theme).toContain('.pxds-degraded.variant-sync-failed,.pxds-degraded.variant-proof-inaccessible{border-color:var(--rose-line);background:var(--rose-dim)}');
    expect(records).toContain("if (status === 'missing' || status === 'pending' || status === 'legacy_unverified') return 'warning';");
    expect(records).toContain("if (status === 'sync_failed') return 'error';");
  });
});
