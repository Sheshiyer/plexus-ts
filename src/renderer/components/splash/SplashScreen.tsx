import React, { useState, useEffect, useCallback } from 'react';
import RibbonsShader from './RibbonsShader';
import AnimatedLogo from './AnimatedLogo';

interface Props {
  onComplete: () => void;
  minDuration?: number;
}

export default function SplashScreen({ onComplete, minDuration = 2500 }: Props) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  const handleComplete = useCallback(() => {
    setFadeOut(true);
    setTimeout(() => {
      setVisible(false);
      onComplete();
    }, 800);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9998,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 800ms ease-out',
      }}
    >
      <RibbonsShader onComplete={handleComplete} minDuration={minDuration} />
      <AnimatedLogo />
    </div>
  );
}
