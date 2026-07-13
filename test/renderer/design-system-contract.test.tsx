import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Button, PageHeader } from '../../src/renderer/components/ui';
import {
  CommandDock,
  InstrumentPanel,
  LedgerRail,
  MetricRail,
  OverflowText,
  PAGE_VIEWPORTS,
  PLEXUS_STATUS_TONE,
  StatusChip,
  middleTruncate,
  type PageViewportKind,
  type PlexusStatusState,
} from '../../src/renderer/components/PlexusUI';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

describe('Plexus design-system parity contract', () => {
  it('maps every app viewport from the design sheet to a named page contract', () => {
    const expected: PageViewportKind[] = [
      'focus',
      'records',
      'projects',
      'reports',
      'export',
      'fabric',
      'coworking',
      'backups',
      'preferences',
      'admin',
    ];

    expect(Object.keys(PAGE_VIEWPORTS).sort()).toEqual([...expected].sort());
    expect(PAGE_VIEWPORTS.focus.archetype).toBe('command viewport');
    expect(PAGE_VIEWPORTS.records.archetype).toBe('ledger viewport');
    expect(PAGE_VIEWPORTS.fabric.archetype).toBe('operations viewport');
    expect(PAGE_VIEWPORTS.coworking.archetype).toBe('social floor viewport');
    expect(PAGE_VIEWPORTS.admin.archetype).toBe('oversight viewport');
  });

  it('renders the semantic StatusChip matrix with safe tone classes', () => {
    const expected: Record<PlexusStatusState, string> = {
      verified: 'accent',
      connected: 'accent',
      matched: 'mint',
      pending: 'warning',
      needs_repo: 'warning',
      inaccessible: 'error',
      offline: 'idle',
      warning: 'warning',
      error: 'error',
      idle: 'idle',
      skipped: 'idle',
    };

    expect(PLEXUS_STATUS_TONE).toEqual(expected);

    for (const [state, tone] of Object.entries(expected)) {
      const html = renderToStaticMarkup(
        <StatusChip state={state as PlexusStatusState}>{state.replace('_', ' ')}</StatusChip>,
      );
      expect(html).toContain(`state-${state}`);
      expect(html).toContain(`tone-${tone}`);
    }
  });

  it('keeps long operational strings truncated on screen with full title affordance', () => {
    const value = 'github.com/thoughtseed/plexus-ts/pull/8123456789-long-design-system-parity';
    const truncated = middleTruncate(value, 36);
    const html = renderToStaticMarkup(<OverflowText value={value} max={36} />);

    expect(truncated).not.toBe(value);
    expect(truncated).toContain('...');
    expect(truncated.startsWith('github.com/thought')).toBe(true);
    expect(truncated.endsWith('parity')).toBe(true);
    expect(html).toContain(`title="${value}"`);
    expect(html).toContain(truncated);
  });

  it('wraps PageHeader copy and right slot around a stable CommandDock', () => {
    const html = renderToStaticMarkup(
      <PageHeader
        title="Reports"
        sub="review viewport"
        right={(
          <CommandDock>
            <Button>Refresh</Button>
          </CommandDock>
        )}
      />,
    );

    expect(html).toContain('px-page-copy');
    expect(html).toContain('px-page-right');
    expect(html).toContain('pxds-command-dock');
    expect(html).toContain('Refresh');
  });

  it('promotes dense instrument panels to a full layout row', () => {
    const html = renderToStaticMarkup(
      <InstrumentPanel label="release proof" density="dense">
        <div>release evidence</div>
      </InstrumentPanel>,
    );

    expect(html).toContain('data-layout-density="dense"');
    expect(html).toContain('data-layout-span="full"');
  });

  it('keeps human-readable metric and ledger copy available without character truncation', () => {
    const label = 'Release health across continuous integration notarization and update publication';
    const hint = 'All workflow, artifact, signature, and OTA publication evidence remains visible';
    const title = 'Shesh With A Long Ledger Identity Name That Must Remain Completely Readable';
    const meta = 'avery.long.employee.identity.requiring.complete.visibility@thoughtseed.space/workspace/plexus-production-proof';
    const html = renderToStaticMarkup(
      <>
        <MetricRail label={label} value="ready" hint={hint} />
        <LedgerRail title={title} meta={meta} status="verified" />
      </>,
    );

    expect(html).toContain(label);
    expect(html).toContain(hint);
    expect(html).toContain(title);
    expect(html).toContain(meta);
    expect(html).not.toContain(middleTruncate(label, 24));
    expect(html).not.toContain(middleTruncate(meta, 78));
  });

  it('keeps critical Settings datum values visible by default', async () => {
    vi.stubGlobal('__APP_VERSION__', '0.5.5-test');
    const { DatumRail } = await import('../../src/renderer/components/Settings');
    const value = 'workspace/plexus-production/identity/avery.long.employee@thoughtseed.space/repository/proof-source';
    const secondary = 'Complete endpoint and repository evidence remains readable without hover-only disclosure';
    const html = renderToStaticMarkup(
      <DatumRail label="workspace proof source" value={value} secondary={secondary} />,
    );

    expect(html).toContain(value);
    expect(html).toContain(secondary);
    expect(html).toContain('is-wrap');
    expect(html).not.toContain(middleTruncate(value, 42));
  });

  it('pins dock, metric, ledger, and overflow CSS invariants', () => {
    const theme = source('src/renderer/theme.css');

    expect(theme).toContain('.px-page-right > .pxds-command-dock');
    expect(theme).toContain('.pxds-command-dock .px-btn{min-height:40px');
    expect(theme).toContain('.pxds-overflow-text{');
    expect(theme).toMatch(/\.pxds-metric\{[^}]*min-height:92px/);
    expect(theme).toMatch(/\.pxds-metric-value\{[^}]*font-variant-numeric:tabular-nums/);
    expect(theme).toContain('container-name:px-panel');
    expect(theme).toContain('@container px-panel');
    expect(theme).toMatch(/\.pxds-ledger-rail\{[^}]*grid-template-areas:"index main status value action"/);
    expect(theme).toContain('[data-layout-span="full"]{grid-column:1/-1}');
    expect(theme).not.toContain('.px-page-h .px-command-dock');
  });

  it('moves the Fabric priority assignment slice onto named shared primitives', () => {
    const fabric = source('src/renderer/components/AgentFabricPanel.tsx');

    expect(fabric).toContain('PageViewport kind="fabric"');
    expect(fabric).toContain('FieldDock');
    expect(fabric).toContain('className="px-fabric-task-grid"');
    expect(fabric).toContain('className="px-fabric-task-card"');
    expect(fabric).toContain('MetricRailGroup className="px-fabric-connection-metrics"');
    expect(fabric).not.toContain('className="px-fabric-connection-grid"');
    expect(fabric).not.toContain('className="px-stat"');
  });
});
