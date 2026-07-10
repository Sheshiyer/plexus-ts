import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, PageHeader } from '../../src/renderer/components/ui';
import {
  CommandDock,
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

  it('pins dock, metric, ledger, and overflow CSS invariants', () => {
    const theme = source('src/renderer/theme.css');

    expect(theme).toContain('.px-page-right > .pxds-command-dock');
    expect(theme).toContain('.pxds-command-dock .px-btn{min-height:40px');
    expect(theme).toContain('.pxds-overflow-text{');
    expect(theme).toMatch(/\.pxds-metric\{[^}]*min-height:92px/);
    expect(theme).toMatch(/\.pxds-metric-value\{[^}]*font-variant-numeric:tabular-nums/);
    expect(theme).toMatch(/\.pxds-ledger-rail\{[^}]*minmax\(220px,1fr\)/);
    expect(theme).toMatch(/\.pxds-ledger-rail\{[^}]*grid-template-areas:"index main status value action"/);
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
