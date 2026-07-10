import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultProfileAvatarUrl } from '../profileAvatars';

interface ProfileCardProps {
  avatarUrl?: string;
  miniAvatarUrl?: string;
  name: string;
  title: string;
  handle: string;
  status: string;
  contactText?: string;
  showUserInfo?: boolean;
  enableTilt?: boolean;
  behindGlowEnabled?: boolean;
  behindGlowColor?: string;
  behindGlowSize?: string;
  innerGradient?: string;
  className?: string;
  onContactClick?: () => void;
}

function ProfileCardComponent({
  avatarUrl,
  miniAvatarUrl,
  name,
  title,
  handle,
  status,
  contactText = 'Edit Profile',
  showUserInfo = true,
  enableTilt = true,
  behindGlowEnabled = true,
  behindGlowColor = 'rgba(214, 255, 246, 0.34)',
  behindGlowSize = '48%',
  innerGradient = 'linear-gradient(145deg, rgba(35, 22, 81, 0.72) 0%, rgba(0, 39, 43, 0.92) 50%, rgba(224, 255, 79, 0.16) 100%)',
  className = '',
  onContactClick,
}: ProfileCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
    [],
  );
  const safeHandle = handle.replace(/^@+/, '');
  const fallbackAvatarUrl = useMemo(() => getDefaultProfileAvatarUrl(name, safeHandle), [name, safeHandle]);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const mainAvatarUrl = avatarUrl && !avatarFailed ? avatarUrl : fallbackAvatarUrl;

  useEffect(() => {
    setAvatarFailed(false);
  }, [avatarUrl]);

  const setPointerVars = useCallback((xPct: number, yPct: number) => {
    const node = wrapRef.current;
    if (!node) return;
    const centerX = xPct - 50;
    const centerY = yPct - 50;
    node.style.setProperty('--pc-pointer-x', `${xPct}%`);
    node.style.setProperty('--pc-pointer-y', `${yPct}%`);
    node.style.setProperty('--pc-rotate-x', `${-(centerY / 6).toFixed(2)}deg`);
    node.style.setProperty('--pc-rotate-y', `${(centerX / 7).toFixed(2)}deg`);
    node.style.setProperty('--pc-opacity', '1');
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!enableTilt || reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const xPct = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    setPointerVars(xPct, yPct);
  }, [enableTilt, reduceMotion, setPointerVars]);

  const handlePointerLeave = useCallback(() => {
    const node = wrapRef.current;
    if (!node) return;
    node.style.setProperty('--pc-pointer-x', '50%');
    node.style.setProperty('--pc-pointer-y', '50%');
    node.style.setProperty('--pc-rotate-x', '0deg');
    node.style.setProperty('--pc-rotate-y', '0deg');
    node.style.setProperty('--pc-opacity', '0.72');
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`px-profile-card ${className}`.trim()}
      style={{
        '--pc-inner-gradient': innerGradient,
        '--pc-behind-glow-color': behindGlowColor,
        '--pc-behind-glow-size': behindGlowSize,
      } as React.CSSProperties}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {behindGlowEnabled && <div className="px-profile-card-glow" aria-hidden="true" />}
      <section className="px-profile-card-shell" aria-label={`${name} profile card`}>
        <div className="px-profile-card-shine" aria-hidden="true" />
        <div className="px-profile-card-head">
          <div>
            <div className="px-profile-card-kicker">Plexus member</div>
            <h3>{name}</h3>
            <p>{title}</p>
          </div>
          <span className="px-profile-card-status">{status}</span>
        </div>

        <div className="px-profile-avatar-stage">
          <img
            src={mainAvatarUrl}
            alt={avatarUrl && !avatarFailed ? `${name} avatar` : `${name} generated avatar`}
            onError={() => setAvatarFailed(true)}
          />
        </div>

        {showUserInfo && (
          <div className="px-profile-card-info">
            <div className="px-profile-mini">
              <img
                src={miniAvatarUrl || mainAvatarUrl}
                alt=""
                onError={(event) => {
                  if (event.currentTarget.src !== fallbackAvatarUrl) event.currentTarget.src = fallbackAvatarUrl;
                }}
              />
            </div>
            <div className="px-profile-card-copy">
              <strong>@{safeHandle}</strong>
              <span>{status}</span>
            </div>
            <button type="button" onClick={onContactClick}>{contactText}</button>
          </div>
        )}
      </section>
    </div>
  );
}

const ProfileCard = memo(ProfileCardComponent);
export default ProfileCard;
