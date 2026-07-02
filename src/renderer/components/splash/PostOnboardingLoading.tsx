import React, { useEffect, useRef, useState } from 'react';
import AnimatedLogo from './AnimatedLogo';

const splashVideoUrl = new URL('../../assets/post-onboarding-bg.mp4', import.meta.url).href;

interface Props {
  onComplete: () => void;
  minDuration?: number;
}

export default function PostOnboardingLoading({
  onComplete,
  minDuration = 4200,
}: Props) {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const completeTimer = window.setTimeout(() => {
      setFadeOut(true);
      window.setTimeout(() => {
        setVisible(false);
        onComplete();
      }, 700);
    }, minDuration);

    const currentVideo = videoRef.current;
    if (currentVideo) {
      currentVideo.currentTime = 0;
      currentVideo.play().catch(() => {
        // If autoplay-with-audio is blocked, retry muted so motion still appears.
        currentVideo.muted = true;
        return currentVideo.play().catch(() => undefined);
      });
    }

    return () => {
      window.clearTimeout(completeTimer);
      if (currentVideo) {
        currentVideo.pause();
      }
    };
  }, [minDuration, onComplete]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12000,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 700ms ease-out',
      }}
    >
      <video
        ref={videoRef}
        src={splashVideoUrl}
        playsInline
        preload="auto"
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          zIndex: 12000,
          filter: 'saturate(1.1) contrast(1.02)',
        }}
      />
      <AnimatedLogo />
      <div
        style={{
          position: 'fixed',
          left: '50%',
          bottom: 36,
          transform: 'translateX(-50%)',
          zIndex: 12002,
          color: 'rgba(214,255,246,0.72)',
          fontFamily: "'Geist Mono', ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: '0.17em',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        Preparing home workspace
      </div>
    </div>
  );
}
