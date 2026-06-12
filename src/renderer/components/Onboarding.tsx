import React, { useState } from 'react';
import { Panel, Button, Crosshairs } from './ui';
import { IconHand, IconTimer, IconPaperclip, IconCloud } from './Icons';

interface Props {
  onComplete: () => void;
}

const STEPS = [
  {
    title: 'Welcome to Plexus',
    body: 'Your time tracker for Thoughtseed. Track projects, generate reports, and sync with Paperclip + MultiCA.',
    Icon: IconHand,
  },
  {
    title: 'Track Your Time',
    body: 'Select a project, hit Start, and Plexus will track every second. Stop when you\'re done — it auto-syncs.',
    Icon: IconTimer,
  },
  {
    title: 'Bridge to Paperclip',
    body: 'Configure your Paperclip path in Settings. Monthly reports auto-write to vault/communications/time-reports/.',
    Icon: IconPaperclip,
  },
  {
    title: 'MultiCA + R2',
    body: 'Push reports upstream to cofounders via MultiCA, and archive durable snapshots to Cloudflare R2.',
    Icon: IconCloud,
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
  const StepIcon = current.Icon;

  return (
    <div className="px-backdrop" style={{ background: 'var(--bg-0)', backdropFilter: 'none' }}>
      <Panel raised pad crosshairs className="px-fadein" style={{ maxWidth: 440, width: '100%', textAlign: 'center', padding: '40px 36px' }}>
        <Crosshairs />

        <div style={{ color: 'var(--accent)', display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <StepIcon s={48} />
        </div>

        <h2 style={{ fontSize: 24, marginBottom: 12 }}>{current.title}</h2>
        <p style={{ fontSize: 14, color: 'var(--t2)', maxWidth: 360, margin: '0 auto 30px', lineHeight: 1.7 }}>
          {current.body}
        </p>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 26 }}>
          {STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 22 : 8,
                height: 8,
                borderRadius: 'var(--r)',
                background: i === step ? 'var(--accent)' : 'var(--line-2)',
                transition: 'all var(--dur) var(--ease)',
              }}
            />
          ))}
        </div>

        <Button onClick={next} style={{ minWidth: 160, justifyContent: 'center' }}>
          {step >= STEPS.length - 1 ? 'Get Started' : 'Next'}
        </Button>
      </Panel>
    </div>
  );
}
