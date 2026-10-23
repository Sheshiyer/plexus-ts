import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RemoteVideoPanel from '../../src/renderer/components/coworking/RemoteVideoPanel';
import type { RemoteStream } from '../../src/renderer/lib/RealtimeSession';
const stream = (kind: RemoteStream['trackKind'], id: string) => ({ participantId: 'person', trackId: id, trackKind: kind, stream: {} as MediaStream });
describe('received video panel', () => {
  it.each(['Ambient Lounge', 'Project Room'])('renders actual camera and screen video elements in %s', (roomName) => {
    const html = renderToStaticMarkup(<RemoteVideoPanel roomName={roomName} participants={[{ id: 'person', displayName: 'Maya' }]} streams={[stream('camera', 'cam'), stream('screen', 'screen'), stream('audio', 'mic')]} />);
    expect(html.match(/<video /g)).toHaveLength(2);
    expect(html).toContain(`Received video in ${roomName}`);
    expect(html).toContain('Maya · camera');
    expect(html).toContain('Maya · screen share');
    expect(html).toContain('muted=""');
    expect(html).toContain('playsinline=""');
    expect(html).toContain('Participant cameras');
    expect(html).toContain('Shared screens');
  });
  it('renders no fake video when only audio exists', () => {
    expect(renderToStaticMarkup(<RemoteVideoPanel roomName="Lounge" streams={[stream('audio', 'mic')]} />)).toBe('');
  });
});
