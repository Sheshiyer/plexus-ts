import React from 'react';
import { Button } from '../ui';
import { IconUsers } from '../Icons';

export interface LoungeStripProps {
  presentCount: number;
  presentInitials: string[];   // up to 4
  joined: boolean;
  busy: boolean;
  available: boolean;
  error: string | null;
  onJoin: () => void;
}

/**
 * Compact ambient-lounge strip. Presence + one Join action. All media
 * controls live in the MediaDock once joined — nothing to manage here.
 */
export default function LoungeStrip({
  presentCount, presentInitials, joined, busy, available, error, onJoin,
}: LoungeStripProps) {
  return (
    <section className="px-lounge-strip" aria-label="Ambient lounge">
      <div className="px-lounge-strip-id">
        <span className="px-lbl">Ambient lounge</span>
        <span className="px-lounge-strip-note">{presentCount} in lounge · unrecorded</span>
      </div>
      <div className="px-lounge-strip-people">
        {presentInitials.slice(0, 4).map((initials, index) => (
          <span key={`${initials}-${index}`} className="px-mini-avatar"><span className="px-mini-initials">{initials}</span></span>
        ))}
      </div>
      <div className="px-lounge-strip-act">
        {error && <span className="px-lounge-strip-err">{error}</span>}
        {joined
          ? <span className="px-stage-joined-chip"><span className="px-dot pulse" /> In the lounge</span>
          : <Button variant="accent" onClick={onJoin} disabled={busy || !available}><IconUsers s={12} /> {busy ? 'Joining' : 'Join lounge'}</Button>}
      </div>
    </section>
  );
}
