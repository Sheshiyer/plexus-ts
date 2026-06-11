import React, { useState } from 'react';

interface Props {
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Plexus',
    body: 'Your time tracker for Thoughtseed. Track projects, generate reports, and sync with Paperclip + MultiCA.',
    icon: '👋',
  },
  {
    title: 'Track Your Time',
    body: 'Select a project, hit Start, and Plexus will track every second. Stop when you\'re done — it auto-syncs.',
    icon: '⏱',
  },
  {
    title: 'Bridge to Paperclip',
    body: 'Configure your Paperclip path in Settings. Monthly reports auto-write to vault/communications/time-reports/.',
    icon: '📎',
  },
  {
    title: 'MultiCA + R2',
    body: 'Push reports upstream to cofounders via MultiCA, and archive durable snapshots to Cloudflare R2.',
    icon: '🌉',
  },
];

export default function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState(0);

  const next = () => {
    if (step >= STEPS.length - 1) {
      onComplete();
    } else {
      setStep(s => s + 1);
    }
  };

  const current = STEPS[step];

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 15000,
        background: '#0f1115',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      <div
        style={{
          fontSize: 64,
          marginBottom: 24,
        }}
      >
        {current.icon}
      </div>
      <h2
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: '#fff',
          marginBottom: 12,
          textAlign: 'center',
        }}
      >
        {current.title}
      </h2>
      <p
        style={{
          fontSize: 15,
          color: '#8b949e',
          maxWidth: 420,
          textAlign: 'center',
          lineHeight: 1.6,
          marginBottom: 32,
        }}
      >
        {current.body}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {STEPS.map((_, i) => (
          <div
            key={i}
            style={{
              width: i === step ? 24 : 8,
              height: 8,
              borderRadius: 4,
              background: i === step ? '#58a6ff' : '#30363d',
              transition: 'all 0.3s ease',
            }}
          />
        ))}
      </div>

      <button
        onClick={next}
        style={{
          padding: '12px 32px',
          borderRadius: 10,
          border: 'none',
          background: '#238636',
          color: '#fff',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        {step >= STEPS.length - 1 ? 'Get Started' : 'Next'}
      </button>
    </div>
  );
}
