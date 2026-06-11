import React from 'react';

export default function AnimatedLogo() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        style={{ marginBottom: 24 }}
      >
        <defs>
          <linearGradient id="plexusGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#58a6ff" />
            <stop offset="50%" stopColor="#3fb950" />
            <stop offset="100%" stopColor="#58a6ff" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Orbiting nodes */}
        <circle cx="60" cy="60" r="4" fill="#58a6ff" filter="url(#glow)">
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Ring 1 */}
        <g>
          <circle cx="60" cy="25" r="3" fill="#3fb950">
            <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="25" r="3" fill="#58a6ff">
            <animateTransform attributeName="transform" type="rotate" from="120 60 60" to="480 60 60" dur="8s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="25" r="3" fill="#f0883e">
            <animateTransform attributeName="transform" type="rotate" from="240 60 60" to="600 60 60" dur="8s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Ring 2 */}
        <g>
          <circle cx="60" cy="10" r="2.5" fill="#58a6ff" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="60 60 60" to="420 60 60" dur="12s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="10" r="2.5" fill="#3fb950" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="180 60 60" to="540 60 60" dur="12s" repeatCount="indefinite" />
          </circle>
          <circle cx="60" cy="10" r="2.5" fill="#f0883e" opacity="0.8">
            <animateTransform attributeName="transform" type="rotate" from="300 60 60" to="660 60 60" dur="12s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Connecting lines from center */}
        <line x1="60" y1="60" x2="60" y2="25" stroke="url(#plexusGrad)" strokeWidth="0.8" opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="8s" repeatCount="indefinite" />
        </line>
        <line x1="60" y1="60" x2="60" y2="25" stroke="url(#plexusGrad)" strokeWidth="0.8" opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" from="120 60 60" to="480 60 60" dur="8s" repeatCount="indefinite" />
        </line>
        <line x1="60" y1="60" x2="60" y2="25" stroke="url(#plexusGrad)" strokeWidth="0.8" opacity="0.6">
          <animateTransform attributeName="transform" type="rotate" from="240 60 60" to="600 60 60" dur="8s" repeatCount="indefinite" />
        </line>

        {/* Outer ring outline */}
        <circle cx="60" cy="60" r="35" fill="none" stroke="url(#plexusGrad)" strokeWidth="0.5" opacity="0.3">
          <animate attributeName="r" values="35;37;35" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0.6;0.3" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      <h1
        style={{
          fontSize: 36,
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '4px',
          textTransform: 'uppercase',
          margin: 0,
          textShadow: '0 0 20px rgba(88,166,255,0.5)',
        }}
      >
        Plexus
      </h1>
      <p
        style={{
          fontSize: 13,
          color: '#8b949e',
          marginTop: 8,
          letterSpacing: '2px',
        }}
      >
        Time Tracker for Thoughtseed
      </p>
    </div>
  );
}
