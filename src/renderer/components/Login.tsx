import React, { useState, useEffect } from 'react';
import type { Session, WorkerConfig } from '../../shared/types';
import { Button, Field, Input, Crosshairs, SectionLabel } from './ui';

interface Props {
  onLogin: (session: Session) => void;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cfg, setCfg] = useState<WorkerConfig | null>(null);
  const [showConn, setShowConn] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [token, setToken] = useState('');
  const [connMsg, setConnMsg] = useState('');

  useEffect(() => {
    window.plexus.workerConfigGet().then(c => {
      setCfg(c);
      setBaseUrl(c.baseUrl);
      setWorkspaceId(c.workspaceId);
      if (!c.hasToken) setShowConn(true);
    });
  }, []);

  const saveConn = async () => {
    setConnMsg('Saving…');
    const next = await window.plexus.workerConfigSet({ baseUrl, workspaceId, token: token || undefined });
    setCfg(next);
    setToken('');
    const status = await window.plexus.workerStatus();
    setConnMsg(status.connected ? 'Connected' : `Not connected — ${status.message ?? 'check token'}`);
  };

  const handleLogin = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await window.plexus.authLogin(email);
      if (res.ok && res.session) {
        onLogin(res.session);
      } else {
        setError(res.message ?? 'Login failed.');
        if (res.message && /not connected|token/i.test(res.message)) setShowConn(true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleAccessLogin = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await window.plexus.authAccessLogin();
      if (res.ok && res.session) {
        // Phase 7: provision member automatically after Access login
        const provisioned = await window.plexus.memberProvision();
        if (provisioned.ok && provisioned.bundle) {
          console.log('[Phase 7] Provisioned:', provisioned.bundle.memberId);
        } else {
          console.warn('[Phase 7] Provision skipped:', provisioned.message);
        }
        onLogin(res.session);
      } else {
        setError(res.message ?? 'Access sign-in failed.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(80% 80% at 50% 40%, var(--bg-2), var(--bg-0))', padding: 24,
    }}>
      <div className="px-panel raised" style={{ width: '100%', maxWidth: 420, padding: '34px 34px 30px', position: 'relative' }}>
        <Crosshairs />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <span className="px-dot" />
          <b style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.18em', fontSize: 14, color: 'var(--mint)' }}>PLEXUS</b>
          <span className="px-lbl" style={{ marginLeft: 'auto' }}>time engine</span>
        </div>

        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Sign in</h2>
        <p style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 22 }}>Use your Thoughtseed email to connect to the team.</p>

        <Field label="email" error={error || undefined}>
          <Input
            type="email" autoFocus placeholder="you@thoughtseed.space" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
          />
        </Field>

        <div style={{ marginTop: 18 }}>
          <Button onClick={handleLogin} disabled={busy || !email.trim()} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Connecting…' : 'Continue'}
          </Button>
        </div>

        <div style={{ marginTop: 10 }}>
          <Button variant="ghost" onClick={handleAccessLogin} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            Sign in with Cloudflare Access
          </Button>
        </div>

        <p className="px-lbl" style={{ marginTop: 22, textTransform: 'none', letterSpacing: 0, color: 'var(--t4)', lineHeight: 1.6, fontSize: 11 }}>
          Sign in via Cloudflare Access (email OTP). No passwords stored locally. Paperclip agent fabric is optional — timer and projects work without it.
        </p>
      </div>
    </div>
  );
}
