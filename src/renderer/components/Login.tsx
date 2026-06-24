/**
 * Redesigned login screen:
 * - Single "Sign in with Cloudflare Access" button (no email field)
 * - Email is captured from the Access JWT after successful login
 * - Clean, minimal UI
 */

import React, { useState } from 'react';
import type { Session } from '../../shared/types';
import { Button, Crosshairs } from './ui';
import RibbonsShader from './splash/RibbonsShader';

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
        console.error('[Login] Access sign-in failed:', res.message);
        setError(res.message ?? 'Access sign-in failed. Please try again.');
      }
    } catch (err: any) {
      console.error('[Login] Exception during Access sign-in:', err);
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
      <RibbonsShader style={{ zIndex: 0 }} />
      <div className="px-panel raised pad" style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>
        <Crosshairs />

        <div className="px-login-brand">
          <span className="px-dot" />
          <b className="px-mono px-login-wordmark">PLEXUS</b>
          <span className="px-lbl px-login-tag">work coordination</span>
        </div>

        <h2 className="px-login-title">Sign in</h2>
        <p className="px-login-blurb">
          Sign in with your Thoughtseed email via Cloudflare Access.
        </p>

        {error && (
          <div className="px-login-error">
            {error}
          </div>
        )}

        <div className="px-login-cta">
          <Button onClick={handleAccessLogin} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Opening sign-in window…' : 'Sign in with Cloudflare Access'}
          </Button>
        </div>

        <p className="px-login-fineprint">
          You'll receive a one-time password via email. No passwords are stored locally.
          Paperclip agent fabric and wellness helpers are optional; verified project work stays GitHub-backed.
        </p>
      </div>
    </div>
  );
}
