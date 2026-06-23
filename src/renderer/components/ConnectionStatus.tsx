import React, { useCallback, useEffect, useState } from 'react';

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
