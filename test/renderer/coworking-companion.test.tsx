import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { CoWorkingCompanion } from '../../src/renderer/components/coworking/CoWorkingCompanion';

describe('CoWorkingCompanion', () => {
  it('keeps the essential casting controls and capture honesty visible', () => {
    const html = renderToStaticMarkup(<CoWorkingCompanion
      title="Ambient Lounge"
      context="connected · audience-visible companion"
      participants={[]}
      participantCount={2}
      timerState={{ running: true, activeSeconds: 65 }}
      joined
      mediaEnabled
      micActive
      cameraActive={false}
      screenActive
      captionsOn={false}
      busy={false}
      onToggleMic={vi.fn()}
      onToggleCamera={vi.fn()}
      onToggleScreen={vi.fn()}
      onToggleCaptions={vi.fn()}
      onLeave={vi.fn()}
      onExpand={vi.fn()}
    />);

    expect(html).toContain('data-window-mode="compact"');
    expect(html).toContain('Exit compact mode');
    expect(html).toContain('Stop screen sharing');
    expect(html).toContain('Leave co-working room');
    expect(html).toContain('2 participants');
    expect(html).toContain('00:01:05');
    expect(html).toContain('Visible in whole-display sharing');
  });

  it('announces critical compact errors', () => {
    const html = renderToStaticMarkup(<CoWorkingCompanion
      title="Co-working"
      context="connection unavailable"
      participants={[]}
      participantCount={0}
      timerState={{ running: false }}
      joined={false}
      mediaEnabled={false}
      micActive={false}
      cameraActive={false}
      screenActive={false}
      captionsOn={false}
      busy={false}
      error="Could not enter compact mode."
      onToggleMic={vi.fn()}
      onToggleCamera={vi.fn()}
      onToggleScreen={vi.fn()}
      onToggleCaptions={vi.fn()}
      onLeave={vi.fn()}
      onExpand={vi.fn()}
    />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Could not enter compact mode.');
  });
});
