/**
 * Redesigned login screen:
 * - Single "Sign in with Cloudflare Access" button (no email field)
 * - Email is captured from the Access JWT after successful login
 * - Clean, minimal UI
 */

import React, { useState } from 'react';
import type { Session } from '../../shared/types';
import { Button, Crosshairs } from './ui';

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
        // Phase 7: provision member automatically after Access login
        const provisioned = await window.plexus.memberProvision();
        if (provisioned.ok && provisioned.bundle) {
          console.log('[Phase 7] Provisioned:', provisioned.bundle.memberId);
        } else {
          console.warn('[Phase 7] Provision skipped:', provisioned.message);
        }
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
        <p style={{ color: 'var(--t3)', fontSize: 13, marginBottom: 22 }}>
          Sign in with your Thoughtseed email via Cloudflare Access.
        </p>

        {error && (
          <div style={{ 
            color: 'var(--rose)', 
            fontSize: 12, 
            marginBottom: 16, 
            padding: '8px 12px', 
            background: 'rgba(255, 71, 87, 0.1)', 
            borderRadius: 4 
          }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <Button onClick={handleAccessLogin} disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Opening sign-in window…' : 'Sign in with Cloudflare Access'}
          </Button>
        </div>

        <p className="px-lbl" style={{ marginTop: 22, textTransform: 'none', letterSpacing: 0, color: 'var(--t4)', lineHeight: 1.6, fontSize: 11 }}>
          You'll receive a one-time password via email. No passwords are stored locally.
          Paperclip agent fabric and other features are optional — timer and projects work without them.
        </p>
      </div>
    </div>
  );
}
