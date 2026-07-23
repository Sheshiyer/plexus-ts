import React from 'react';
import type { UpdateStatus } from '../../shared/types';

export interface UpdatePromptProps {
  status: UpdateStatus | null;
  canInterrupt: boolean;
  dismissedPromptKey: string | null;
  actionBusy: 'download' | 'install' | null;
  onLater: (promptKey: string) => void;
  onDownload: () => void;
  onInstall: () => void;
}

export interface UpdatePromptModel {
  key: string;
  phase: 'available' | 'downloading' | 'downloaded';
  version: string;
  title: string;
  message: string;
  percent?: number;
}

export interface UpdatePromptModelOptions {
  canInterrupt: boolean;
  dismissedPromptKey: string | null;
}

export function chooseLatestUpdateStatus(
  current: UpdateStatus | null,
  incoming: UpdateStatus,
): UpdateStatus {
  if (!current) return incoming;
  const currentTime = Date.parse(current.updatedAt);
  const incomingTime = Date.parse(incoming.updatedAt);
  if (Number.isNaN(incomingTime)) return current;
  if (Number.isNaN(currentTime) || incomingTime >= currentTime) return incoming;
  return current;
}

function boundedPercent(value: number | undefined) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value as number)));
}

export function buildUpdatePromptModel(
  status: UpdateStatus | null,
  options: UpdatePromptModelOptions,
): UpdatePromptModel | null {
  if (!status || !options.canInterrupt) return null;
  if (status.state !== 'available' && status.state !== 'downloading' && status.state !== 'downloaded') {
    return null;
  }

  const version = status.availableVersion?.trim();
  if (!version) return null;
  const key = `${status.state}:${version}`;
  if (options.dismissedPromptKey === key) return null;

  if (status.state === 'available') {
    return {
      key,
      phase: 'available',
      version,
      title: 'Update available',
      message: `Plexus ${version} is available. Download it now?`,
    };
  }

  if (status.state === 'downloading') {
    return {
      key,
      phase: 'downloading',
      version,
      title: `Downloading Plexus ${version}`,
      message: 'The update is downloading in the background. You can keep working.',
      percent: boundedPercent(status.percent),
    };
  }

  return {
    key,
    phase: 'downloaded',
    version,
    title: 'Ready to update',
    message: status.error
      ? `Plexus ${version} is ready, but restart preparation failed: ${status.error}`
      : `Plexus ${version} is ready. Install and restart now? Active capture will stop safely before restart.`,
    percent: 100,
  };
}

export default function UpdatePrompt(props: UpdatePromptProps) {
  const model = buildUpdatePromptModel(props.status, {
    canInterrupt: props.canInterrupt,
    dismissedPromptKey: props.dismissedPromptKey,
  });
  if (!model) return null;

  const downloading = model.phase === 'downloading';
  const downloadBusy = model.phase === 'available' && props.actionBusy === 'download';
  const installBusy = model.phase === 'downloaded' && props.actionBusy === 'install';

  return (
    <section
      className={`px-update-prompt phase-${model.phase}`}
      role="region"
      aria-live={downloading ? 'off' : 'polite'}
      aria-labelledby="px-update-prompt-title"
      aria-describedby="px-update-prompt-message"
    >
      <div className="px-update-prompt-mark" aria-hidden="true">UP</div>
      <div className="px-update-prompt-copy">
        <div className="px-lbl">App update</div>
        <h2 id="px-update-prompt-title">{model.title}</h2>
        <p id="px-update-prompt-message">{model.message}</p>
        {downloading && (
          <div className="px-update-progress-row">
            <div
              className="px-update-progress"
              role="progressbar"
              aria-label={`Downloading Plexus ${model.version}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={model.percent}
            >
              <span style={{ width: `${model.percent}%` }} />
            </div>
            <span className="px-mono sm">{model.percent}%</span>
          </div>
        )}
      </div>
      {!downloading && (
        <div className="px-update-prompt-actions">
          <button
            type="button"
            className="px-btn ghost"
            onClick={() => props.onLater(model.key)}
            disabled={Boolean(props.actionBusy)}
          >
            Later
          </button>
          {model.phase === 'available' ? (
            <button
              type="button"
              className="px-btn primary"
              onClick={props.onDownload}
              disabled={Boolean(props.actionBusy)}
            >
              {downloadBusy ? 'Starting download…' : 'Download update'}
            </button>
          ) : (
            <button
              type="button"
              className="px-btn primary"
              onClick={props.onInstall}
              disabled={Boolean(props.actionBusy)}
            >
              {installBusy ? 'Preparing restart…' : 'Install & restart'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
