import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import * as updatePromptModule from '../../src/renderer/components/UpdatePrompt';
import type { UpdateStatus } from '../../src/shared/types';

function source(file: string): string {
  return readFileSync(path.resolve(process.cwd(), file), 'utf8');
}

function status(state: UpdateStatus['state'], patch: Partial<UpdateStatus> = {}): UpdateStatus {
  return {
    state,
    currentVersion: '0.5.3',
    channel: 'latest',
    updatedAt: '2026-07-11T00:00:00.000Z',
    canCheck: false,
    canDownload: state === 'available',
    canInstall: state === 'downloaded',
    ...patch,
  };
}

type PromptOptions = {
  canInterrupt: boolean;
  dismissedPromptKey: string | null;
};

type PromptModel = {
  key: string;
  phase: 'available' | 'downloading' | 'downloaded';
  version: string;
  percent?: number;
};

function buildModel(value: UpdateStatus | null, options: PromptOptions): PromptModel | null {
  const builder = (updatePromptModule as unknown as {
    buildUpdatePromptModel?: (status: UpdateStatus | null, options: PromptOptions) => PromptModel | null;
  }).buildUpdatePromptModel;
  expect(builder).toBeTypeOf('function');
  return builder!(value, options);
}

function chooseLatest(current: UpdateStatus | null, incoming: UpdateStatus): UpdateStatus {
  const chooser = (updatePromptModule as unknown as {
    chooseLatestUpdateStatus?: (current: UpdateStatus | null, incoming: UpdateStatus) => UpdateStatus;
  }).chooseLatestUpdateStatus;
  expect(chooser).toBeTypeOf('function');
  return chooser!(current, incoming);
}

function renderPrompt(value: UpdateStatus | null, options: Partial<PromptOptions> = {}): string {
  const UpdatePrompt = updatePromptModule.default;
  return renderToStaticMarkup(
    <UpdatePrompt
      status={value}
      canInterrupt={options.canInterrupt ?? true}
      dismissedPromptKey={options.dismissedPromptKey ?? null}
      actionBusy={null}
      onLater={() => {}}
      onDownload={() => {}}
      onInstall={() => {}}
    />,
  );
}

function nodeText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (!React.isValidElement(node)) return '';
  return React.Children.toArray((node.props as { children?: React.ReactNode }).children)
    .map(nodeText)
    .join('');
}

function findButton(node: React.ReactNode, label: string): React.ReactElement<{ onClick?: () => void }> {
  if (React.isValidElement(node)) {
    if (node.type === 'button' && nodeText(node).includes(label)) {
      return node as React.ReactElement<{ onClick?: () => void }>;
    }
    for (const child of React.Children.toArray((node.props as { children?: React.ReactNode }).children)) {
      try {
        return findButton(child, label);
      } catch {
        // Continue searching sibling elements.
      }
    }
  }
  throw new Error(`Button not found: ${label}`);
}

describe('global update consent prompt contract', () => {
  it('mounts a dedicated update prompt outside Settings-only content', () => {
    const promptPath = 'src/renderer/components/UpdatePrompt.tsx';
    expect(existsSync(path.resolve(process.cwd(), promptPath))).toBe(true);

    const app = source('src/renderer/App.tsx');
    expect(app).toContain("import UpdatePrompt from './components/UpdatePrompt'");
    expect(app).toContain('<UpdatePrompt');
    expect(app.indexOf('<UpdatePrompt')).toBeLessThan(app.indexOf("{tab === 'settings' && <Settings"));
    expect(app).toContain('&& !preferencesDirty && !signingOut}');
    expect(app).toContain('notice={updatePrompt}');
    expect(source('src/renderer/components/Login.tsx')).toContain('className="px-login-notice"');
  });

  it('keeps discovery, download, and installation in the typed updater contract', () => {
    const app = source('src/renderer/App.tsx');
    expect(app).toContain('updatesGetStatus()');
    expect(app).toContain('onUpdatesStatus(');
    expect(app).toContain('updatesDownload()');
    expect(app).toContain('updatesInstall()');
  });

  it('does not let a stale hydration response overwrite a newer live event', () => {
    const liveAvailable = status('available', {
      availableVersion: '0.5.4',
      updatedAt: '2026-07-11T00:00:02.000Z',
    });
    const staleIdle = status('idle', { updatedAt: '2026-07-11T00:00:01.000Z' });
    const laterDownloaded = status('downloaded', {
      availableVersion: '0.5.4',
      updatedAt: '2026-07-11T00:00:03.000Z',
    });

    expect(chooseLatest(liveAvailable, staleIdle)).toBe(liveAvailable);
    expect(chooseLatest(liveAvailable, laterDownloaded)).toBe(laterDownloaded);
  });

  it.each(['disabled', 'idle', 'checking', 'not-available', 'error'] as const)(
    'renders no global prompt for %s status',
    (state) => {
      expect(buildModel(status(state), { canInterrupt: true, dismissedPromptKey: null })).toBeNull();
      expect(renderPrompt(status(state))).toBe('');
    },
  );

  it('asks before downloading an available version as a non-modal labelled region', () => {
    const value = status('available', { availableVersion: '0.5.4' });
    const html = renderPrompt(value);

    expect(buildModel(value, { canInterrupt: true, dismissedPromptKey: null })).toMatchObject({
      key: 'available:0.5.4',
      phase: 'available',
      version: '0.5.4',
    });
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-live="polite"');
    expect(html).not.toContain('aria-modal');
    expect(html).toContain('Plexus 0.5.4 is available');
    expect(html).toContain('Later');
    expect(html).toContain('Download update');
  });

  it('scopes Later to one phase and version for the current launch', () => {
    const available = status('available', { availableVersion: '0.5.4' });
    expect(buildModel(available, {
      canInterrupt: true,
      dismissedPromptKey: 'available:0.5.4',
    })).toBeNull();

    expect(buildModel(status('available', { availableVersion: '0.5.5' }), {
      canInterrupt: true,
      dismissedPromptKey: 'available:0.5.4',
    })).toMatchObject({ key: 'available:0.5.5' });

    expect(buildModel(status('downloaded', { availableVersion: '0.5.4' }), {
      canInterrupt: true,
      dismissedPromptKey: 'available:0.5.4',
    })).toMatchObject({ key: 'downloaded:0.5.4' });
  });

  it('defers interruption until splash, onboarding, and blocking dialogs are clear', () => {
    const available = status('available', { availableVersion: '0.5.4' });
    expect(buildModel(available, { canInterrupt: false, dismissedPromptKey: null })).toBeNull();
    expect(renderPrompt(available, { canInterrupt: false })).toBe('');
  });

  it('shows bounded accessible progress after download consent', () => {
    const downloading = status('downloading', {
      availableVersion: '0.5.4',
      percent: 140,
    });
    const html = renderPrompt(downloading);

    expect(buildModel(downloading, { canInterrupt: true, dismissedPromptKey: null })).toMatchObject({
      key: 'downloading:0.5.4',
      phase: 'downloading',
      percent: 100,
    });
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('Downloading Plexus 0.5.4');
    expect(html).not.toContain('Install &amp; restart');
  });

  it('asks separately before installing and restarting a downloaded version', () => {
    const downloaded = status('downloaded', { availableVersion: '0.5.4', percent: 100 });
    const html = renderPrompt(downloaded);

    expect(buildModel(downloaded, { canInterrupt: true, dismissedPromptKey: null })).toMatchObject({
      key: 'downloaded:0.5.4',
      phase: 'downloaded',
      version: '0.5.4',
    });
    expect(html).toContain('Plexus 0.5.4 is ready');
    expect(html).toContain('Later');
    expect(html).toContain('Install &amp; restart');
  });

  it('invokes updater actions only from their explicit buttons', () => {
    const later: string[] = [];
    let downloads = 0;
    let installs = 0;
    const UpdatePrompt = updatePromptModule.default;
    const shared = {
      canInterrupt: true,
      dismissedPromptKey: null,
      actionBusy: null,
      onLater: (key: string) => { later.push(key); },
      onDownload: () => { downloads += 1; },
      onInstall: () => { installs += 1; },
    } as const;

    const available = UpdatePrompt({
      ...shared,
      status: status('available', { availableVersion: '0.5.4' }),
    });
    findButton(available, 'Later').props.onClick?.();
    expect(later).toEqual(['available:0.5.4']);
    expect(downloads).toBe(0);
    expect(installs).toBe(0);
    findButton(available, 'Download update').props.onClick?.();
    expect(downloads).toBe(1);

    const downloaded = UpdatePrompt({
      ...shared,
      status: status('downloaded', { availableVersion: '0.5.4' }),
    });
    findButton(downloaded, 'Install & restart').props.onClick?.();
    expect(installs).toBe(1);
  });
});
