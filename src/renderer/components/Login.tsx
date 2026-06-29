/**
 * Employee login screen:
 * - Single Thoughtseed email entry point
 * - Workspace opens after the account check succeeds
 */

import React, { useState } from 'react';
import type { Session } from '../../shared/types';
import { Button, Crosshairs } from './ui';
import BackgroundVideo from './splash/BackgroundVideo';

interface Props {
  onLogin: (session: Session) => void;
}

export default function Login({ onLogin }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleAccessLogin = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await window.plexus.authAccessLogin();
      if (res.ok && res.session) {
        onLogin(res.session);
      } else {
        console.error('[Login] Sign-in failed:', res.message);
        setError('We could not open your account. Please try again.');
      }
    } catch (err: any) {
      console.error('[Login] Exception during sign-in:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-0)', padding: 24, overflow: 'hidden',
    }}>
      <BackgroundVideo
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 0,
          filter: 'saturate(1.08) contrast(1.02)',
          pointerEvents: 'none',
        }}
      />
      <div className="px-panel raised pad" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <Crosshairs />

        <div className="px-login-brand">
          <span className="px-dot" />
          <b className="px-mono px-login-wordmark">PLEXUS</b>
          <span className="px-lbl px-login-tag">work coordination</span>
        </div>

        <h2 className="px-login-title">Sign in</h2>
        <p className="px-login-blurb">
          Use your Thoughtseed email to open your workspace.
        </p>

        {error && (
          <div className="px-login-error">
            {error}
          </div>
        )}

        <div className="px-login-cta">
          <Button onClick={handleAccessLogin} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Opening account sign-in...' : 'Continue with Thoughtseed email'}
          </Button>
        </div>

        <p className="px-login-fineprint">
          You'll receive a one-time password by email. No passwords are stored locally.
          Optional local helpers can be checked after sign-in, and work proof stays linked to your assigned projects.
        </p>
      </div>
    </div>
  );
}
