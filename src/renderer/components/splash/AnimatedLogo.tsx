import React from 'react';

export default function AnimatedLogo() {
  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 10000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
      }}
    >
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ marginBottom: 26 }}>
        <defs>
          <linearGradient id="plexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E0FF4F" />
            <stop offset="50%" stopColor="#D6FFF6" />
            <stop offset="100%" stopColor="#E0FF4F" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.6" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <circle cx="60" cy="60" r="4" fill="#E0FF4F" filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.4;1" dur="2.4s" repeatCount="indefinite" />
        </circle>

        <g>
          <circle cx="60" cy="25" r="3" fill="#E0FF4F">
            <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="25" r="3" fill="#D6FFF6">
            <animateTransform attributeName="transform" type="rotate" from="120 60 60" to="480 60 60" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="25" r="3" fill="#6E5BB0">
            <animateTransform attributeName="transform" type="rotate" from="240 60 60" to="600 60 60" dur="8s" repeatCount="indefinite" />
          </circle>
        </g>

        <g>
          <circle cx="60" cy="10" r="2.5" fill="#E0FF4F" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="60 60 60" to="420 60 60" dur="12s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="10" r="2.5" fill="#D6FFF6" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="180 60 60" to="540 60 60" dur="12s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="10" r="2.5" fill="#6E5BB0" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="300 60 60" to="660 60 60" dur="12s" repeatCount="indefinite" />
          </circle>
        </g>

        <line x1="60" y1="60" x2="60" y2="25" stroke="url(#plexusGrad)" strokeWidth="0.8" opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="8s" repeatCount="indefinite" />
        </line>
        <line x1="60" y1="60" x2="60" y2="25" stroke="url(#plexusGrad)" strokeWidth="0.8" opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" from="120 60 60" to="480 60 60" dur="8s" repeatCount="indefinite" />
        </line>
        <line x1="60" y1="60" x2="60" y2="25" stroke="url(#plexusGrad)" strokeWidth="0.8" opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" from="240 60 60" to="600 60 60" dur="8s" repeatCount="indefinite" />
        </line>

        <circle cx="60" cy="60" r="35" fill="none" stroke="url(#plexusGrad)" strokeWidth="0.5" opacity="0.3">
          <animate attributeName="r" values="35;37;35" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      <h1
        style={{
          fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 30, fontWeight: 500, color: '#D6FFF6',
          letterSpacing: '0.5em', textIndent: '0.5em', textTransform: 'uppercase', margin: 0,
          textShadow: '0 0 24px rgba(224,255,79,0.35)',
        }}
      >
        Plexus
      </h1>
      <p style={{ fontFamily: "'Geist Mono', ui-monospace, monospace", fontSize: 10, color: 'rgba(214,255,246,0.38)', marginTop: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
        Work coordination layer · Thoughtseed
      </p>
    </div>
  );
}
