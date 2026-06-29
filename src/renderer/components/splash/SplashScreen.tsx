import React, { useState, useEffect, useCallback } from 'react';
import AnimatedLogo from './AnimatedLogo';
import BackgroundVideo from './BackgroundVideo';

interface Props {
  onComplete: () => void;
  minDuration?: number;
}

export default function SplashScreen({ onComplete, minDuration = 2500 }: Props) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const skipTimer = setTimeout(() => setCanSkip(true), 800);
    return () => clearTimeout(skipTimer);
  }, []);

  const handleComplete = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 800);
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    if (!canSkip) return;
    handleComplete();
  }, [canSkip, handleComplete]);

  useEffect(() => {
    const completeTimer = setTimeout(handleComplete, minDuration);
    return () => clearTimeout(completeTimer);
  }, [handleComplete, minDuration]);

  if (!visible) return null;

  return (
    <div
      onClick={handleSkip}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9998,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 800ms ease-out',
        cursor: canSkip ? 'pointer' : 'default',
      }}
    >
      <BackgroundVideo
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 9999,
          filter: 'saturate(1.1) contrast(1.02)',
          pointerEvents: 'none',
        }}
      />
      <AnimatedLogo />
      {canSkip && (
        <div
          style={{
            position: 'fixed',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10001,
            color: 'rgba(214, 255, 246, 0.4)',
            fontFamily: "'Geist Mono', ui-monospace, monospace",
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            animation: 'fadeIn 400ms ease',
          }}
        >
          Click to skip
        </div>
      )}
    </div>
  );
}
