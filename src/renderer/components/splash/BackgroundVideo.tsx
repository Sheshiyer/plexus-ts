import React, { useEffect, useRef } from 'react';

const splashVideoUrl = new URL('../../assets/post-onboarding-bg.mp4', import.meta.url).href;

interface Props {
  className?: string;
  style?: React.CSSProperties;
  muted?: boolean;
}

export default function BackgroundVideo({ className, style, muted = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(async () => {
      video.muted = true;
      await video.play();
    });
    return () => {
      video.pause();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      src={splashVideoUrl}
      playsInline
      preload="auto"
      loop
      muted={muted}
      style={style}
    />
  );
}
