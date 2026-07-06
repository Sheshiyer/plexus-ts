import React, { useCallback, useEffect, useState } from 'react';
import type { AssistantStatus } from '../../shared/types';

export interface WorkerConnectionState {
  connected: boolean;
  checking: boolean;
  message?: string;
  checkedAt?: string;
}

export function useWorkerConnectionStatus(intervalMs = 30000) {
  const [status, setStatus] = useState<WorkerConnectionState>({
    connected: false,
    checking: true,
    message: 'Checking work coordination connection',
  });

  const refresh = useCallback(async () => {
    setStatus((current) => ({ ...current, checking: true }));
    try {
      const next = await window.plexus.workerStatus();
      setStatus({
        connected: next.connected,
        checking: false,
        message: next.message,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setStatus({
        connected: false,
        checking: false,
        message: err?.message ?? 'Could not reach the work coordination Worker',
        checkedAt: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), intervalMs);
    const handleNetworkChange = () => void refresh();
    window.addEventListener('online', handleNetworkChange);
    window.addEventListener('offline', handleNetworkChange);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('online', handleNetworkChange);
      window.removeEventListener('offline', handleNetworkChange);
    };
  }, [intervalMs, refresh]);

  return { status, refresh };
}

export interface AssistantConnectionState {
  status: AssistantStatus | null;
  checking: boolean;
  message?: string;
  checkedAt?: string;
}

export function useAssistantConnectionStatus(intervalMs = 45000) {
  const [status, setStatus] = useState<AssistantConnectionState>({
    status: null,
    checking: true,
    message: 'Checking Clio runtime',
  });

  const refresh = useCallback(async () => {
    setStatus((current) => ({ ...current, checking: true }));
    try {
      const next = await window.plexus.assistantStatus();
      setStatus({
        status: next,
        checking: false,
        message: next.message,
        checkedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      setStatus({
        status: null,
        checking: false,
        message: err?.message ?? 'Clio status is unavailable',
        checkedAt: new Date().toISOString(),
      });
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, refresh]);

  return { status, refresh };
}

export function WorkerConnectionButton({
  status,
  onRefresh,
  className = 'px-hud-action',
}: {
  status: WorkerConnectionState;
  onRefresh: () => void;
  className?: string;
}) {
  const state = status.checking ? 'checking' : status.connected ? 'online' : 'offline';
  const label = status.checking ? 'Checking' : status.connected ? 'Online' : 'Offline';
  const checked = status.checkedAt ? `Last checked ${new Date(status.checkedAt).toLocaleTimeString()}` : 'Not checked yet';
  const message = status.message ? ` - ${status.message}` : '';

  return (
    <button
      type="button"
      className={`${className} px-connection-state ${state}`}
      onClick={onRefresh}
      title={`Plexus ${label.toLowerCase()}. ${checked}${message}`}
      aria-label={`Plexus connection: ${label}`}
    >
      <span className="px-connection-dot" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function AssistantStatusButton({
  state,
  onClick,
  className = 'px-hud-action',
}: {
  state: AssistantConnectionState;
  onClick: () => void;
  className?: string;
}) {
  const availability = state.status?.availability;
  const compactState = state.checking
    ? 'checking'
    : availability === 'ready'
      ? 'online'
      : availability === 'needs_model_key'
        ? 'warning'
        : availability === 'disabled'
          ? 'offline'
          : availability === 'offline_suggestions'
            ? 'local'
            : 'offline';
  const label = state.checking
    ? 'Clio'
    : availability === 'ready'
      ? 'Clio'
      : availability === 'needs_model_key'
        ? 'Key'
        : availability === 'disabled'
          ? 'Off'
          : availability === 'offline_suggestions'
            ? 'Local'
            : 'Clio';
  const checked = state.checkedAt ? `Last checked ${new Date(state.checkedAt).toLocaleTimeString()}` : 'Not checked yet';
  const message = state.message ? ` - ${state.message}` : '';

  return (
    <button
      type="button"
      className={`${className} px-assistant-header-state ${compactState}`}
      onClick={onClick}
      title={`Clio ${availability ?? 'status unknown'}. ${checked}${message}`}
      aria-label={`Clio status: ${label}`}
    >
      <span className="px-connection-dot" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
