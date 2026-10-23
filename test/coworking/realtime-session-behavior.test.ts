import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeSession } from '../../src/renderer/lib/RealtimeSession';
import type { RealtimeJoinResponse, RealtimeMediaTrack } from '../../src/shared/types';

class Peer {
  static instance: Peer;
  connectionState = 'new';
  signalingState = 'stable';
  ontrack: ((event: unknown) => void) | null = null;
  onconnectionstatechange = null;
  sender = {};
  iceGatheringState = 'complete';
  listeners = new Map<string, () => void>();
  addEventListener = (name: string, callback: () => void) => this.listeners.set(name, callback);
  removeEventListener = (name: string) => this.listeners.delete(name);
  localDescription: { type: string; sdp?: string } | null = null;
  addTrack = vi.fn(() => this.sender);
  getTransceivers = () => [{ sender: this.sender, mid: '0' }];
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'local-answer' }));
  removeTrack = vi.fn();
  addTransceiver = vi.fn(() => ({ mid: '0', stop: vi.fn() }));
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'local-offer' }));
  setLocalDescription = vi.fn(async (description: { type: string; sdp?: string }) => { this.localDescription = description; this.signalingState = description.type === 'rollback' ? 'stable' : 'have-local-offer'; });
  setRemoteDescription = vi.fn(async () => { this.signalingState = 'stable'; });
  close = vi.fn(() => { this.signalingState = 'closed'; });
  constructor() { Peer.instance = this; }
}
const remote = { id: 'remote', state: 'live', participantId: 'other', direction: 'publish', trackKind: 'audio', cloudflareTrackId: 'provider-remote' } as RealtimeMediaTrack;
const media = { getTracks: () => [{ label: 'mic', kind: 'audio' }] } as unknown as MediaStream;
let publish: ReturnType<typeof vi.fn>;
let closeTrack: ReturnType<typeof vi.fn>;
let onError: ReturnType<typeof vi.fn>;
async function session(configured = true) {
  const value = new RealtimeSession({ call: { id: 'call' }, participant: { id: 'self' }, cloudflare: { configured, sessionId: 'provider-session', stunUrls: [] } } as unknown as RealtimeJoinResponse,
    { onError, onRemoteTrack: vi.fn(), onRemoteTrackEnded: vi.fn(), onConnectionStateChange: vi.fn() });
  await value.init();
  return value;
}
beforeEach(() => {
  publish = vi.fn(); closeTrack = vi.fn().mockResolvedValue({ ok: true }); onError = vi.fn();
  vi.stubGlobal('RTCPeerConnection', Peer);
  vi.stubGlobal('window', { plexus: { realtimePublishTrack: publish, realtimeCloseTrack: closeTrack, realtimeRenegotiate: vi.fn().mockResolvedValue({ ok: true }) } });
});
afterEach(() => vi.unstubAllGlobals());
describe('realtime session negotiation boundary', () => {
  it('does not publish metadata as successful media when provider is unavailable', async () => {
    const value = await session(false);
    expect(await value.publishLocal('mic', media, 'audio', 'Mic')).toBeUndefined();
    expect(publish).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalled();
  });
  it.each([undefined, { sdp: 'answer', type: 'offer' }, ''])('rejects missing or malformed SDP %s and closes the metadata row', async (description) => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, track: { id: 'row' }, cloudflare: { sessionDescription: description } });
    expect(await value.publishLocal('mic', media, 'audio', 'Mic')).toBeUndefined();
    expect(closeTrack).toHaveBeenCalledWith('call', 'row');
    expect(Peer.instance.removeTrack).toHaveBeenCalledTimes(1);
    expect(Peer.instance.signalingState).toBe('stable');
  });
  it('propagates rejected SDP application into failed publication', async () => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, track: { id: 'row', cloudflareTrackId: 'provider' }, cloudflare: { sessionDescription: 'answer' } });
    Peer.instance.setRemoteDescription.mockRejectedValueOnce(new Error('bad SDP'));
    expect(await value.publishLocal('mic', media, 'audio', 'Mic')).toBeUndefined();
    expect(onError).toHaveBeenCalledWith('bad SDP');
  });
  it('answers provider offers, deduplicates successful subscriptions before ontrack', async () => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, cloudflare: { sessionDescription: { type: 'offer', sdp: 'answer' }, tracks: [{ mid: '0', trackId: 'remote' }] } });
    expect((await value.subscribeRemote([remote])).subscribedTargetCount).toBe(1);
    expect((await value.subscribeRemote([remote])).subscribedTargetCount).toBe(1);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(Peer.instance.setRemoteDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'answer' });
  });
  it('reports no successful subscription for metadata-only or deferred negotiation', async () => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, cloudflare: { negotiation: 'negotiation_needed', sessionDescription: 'answer' } });
    expect((await value.subscribeRemote([remote])).subscribedTargetCount).toBe(0);
    expect(Peer.instance.setRemoteDescription).not.toHaveBeenCalled();
  });
  it('removes the sender when unpublishing a stream', async () => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, track: { id: 'row', cloudflareTrackId: 'provider' }, cloudflare: { sessionDescription: 'answer' } });
    expect(await value.publishLocal('mic', media, 'audio', 'Mic')).toBe('row');
    await value.unpublishLocal('mic');
    expect(Peer.instance.removeTrack).toHaveBeenCalledTimes(1);
  });
  it('serializes overlapping publish and subscribe offer exchanges', async () => {
    const value = await session();
    let finish!: (value: unknown) => void;
    publish.mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    publish.mockResolvedValueOnce({ ok: true, cloudflare: { sessionDescription: { type: 'offer', sdp: 'remote-answer' }, tracks: [{ mid: '0', trackId: 'remote' }] } });
    const first = value.publishLocal('mic', media, 'audio', 'Mic');
    const second = value.subscribeRemote([remote]);
    await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    expect(Peer.instance.createOffer).toHaveBeenCalledTimes(1);
    finish({ ok: true, track: { id: 'row', cloudflareTrackId: 'provider' }, cloudflare: { sessionDescription: 'answer' } });
    expect(await first).toBe('row');
    expect((await second).subscribedTargetCount).toBe(1);
    expect(Peer.instance.createOffer).toHaveBeenCalledTimes(1);
    expect(Peer.instance.createAnswer).toHaveBeenCalledTimes(1);
  });
  it('retains a temporarily muted remote stream until the track ends', async () => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, cloudflare: { sessionDescription: { type: 'offer', sdp: 'answer' }, tracks: [{ mid: '0', trackId: 'remote' }] } });
    await value.subscribeRemote([remote]);
    const track = { kind: 'audio', id: 'media', onended: undefined as undefined | (() => void), onmute: undefined as undefined | (() => void) };
    Peer.instance.ontrack?.({ streams: [media], track, transceiver: { mid: '0' } });
    track.onmute?.();
    expect(value.getRemoteStreams()).toHaveLength(1);
    track.onended?.();
    expect(value.getRemoteStreams()).toHaveLength(0);
  });
  it('waits for complete ICE and sends the gathered localDescription and mid', async () => {
    const value = await session();
    Peer.instance.iceGatheringState = 'gathering';
    publish.mockResolvedValue({ ok: true, track: { id: 'row', cloudflareTrackId: 'provider' }, cloudflare: { sessionDescription: 'answer' } });
    const pending = value.publishLocal('mic', media, 'audio', 'Mic');
    await vi.waitFor(() => expect(Peer.instance.listeners.has('icegatheringstatechange')).toBe(true));
    expect(publish).not.toHaveBeenCalled();
    Peer.instance.localDescription = { type: 'offer', sdp: 'offer-with-ice' };
    Peer.instance.iceGatheringState = 'complete';
    Peer.instance.listeners.get('icegatheringstatechange')?.();
    expect(await pending).toBe('row');
    expect(publish).toHaveBeenCalledWith('call', expect.objectContaining({ mid: '0', sessionDescription: { type: 'offer', sdp: 'offer-with-ice' } }));
  });
  it('sends application track IDs for subscription and completes provider renegotiation', async () => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, cloudflare: { sessionDescription: { type: 'offer', sdp: 'offer' }, tracks: [{ mid: '0', trackId: 'remote' }] } });
    expect((await value.subscribeRemote([remote])).subscribedTargetCount).toBe(1);
    expect(publish).toHaveBeenCalledWith('call', expect.objectContaining({ targetTrackIds: ['remote'] }));
    expect(window.plexus.realtimeRenegotiate).toHaveBeenCalledWith('call', { participantId: 'self', sessionDescription: { type: 'answer', sdp: 'local-answer' } });
  });
  it('reports renegotiation failure without counting remote media as subscribed', async () => {
    const value = await session();
    publish.mockResolvedValue({ ok: true, cloudflare: { sessionDescription: { type: 'offer', sdp: 'offer' }, tracks: [{ mid: '0', trackId: 'remote' }] } });
    vi.mocked(window.plexus.realtimeRenegotiate).mockResolvedValue({ ok: false, message: 'provider rejected answer' });
    expect((await value.subscribeRemote([remote])).subscribedTargetCount).toBe(0);
    expect(onError).toHaveBeenCalledWith('provider rejected answer');
  });
  it('subscribes mixed audio and camera one exchange at a time with matching kinds', async () => {
    const value = await session();
    const camera = { ...remote, id: 'camera', trackKind: 'camera', cloudflareTrackId: 'provider-camera' } as RealtimeMediaTrack;
    publish.mockImplementation(async (_call, input) => ({ ok: true, cloudflare: {
      sessionDescription: { type: 'offer', sdp: 'offer' },
      tracks: [{ mid: input.targetTrackIds[0] === 'remote' ? '0' : '1', trackId: input.targetTrackIds[0] }],
    } }));
    expect((await value.subscribeRemote([remote, camera])).subscribedTargetCount).toBe(2);
    expect(publish).toHaveBeenNthCalledWith(1, 'call', expect.objectContaining({ trackKind: 'audio', targetTrackIds: ['remote'] }));
    expect(publish).toHaveBeenNthCalledWith(2, 'call', expect.objectContaining({ trackKind: 'camera', targetTrackIds: ['camera'] }));
    expect(window.plexus.realtimeRenegotiate).toHaveBeenCalledTimes(2);
  });
  it('never resumes a closed session or completes an in-flight publication after close', async () => {
    const value = await session();
    let finish!: (value: unknown) => void;
    publish.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const pending = value.publishLocal('mic', media, 'audio', 'Mic');
    await vi.waitFor(() => expect(publish).toHaveBeenCalled());
    await value.close();
    finish({ ok: true, track: { id: 'row' }, cloudflare: { sessionDescription: 'answer' } });
    expect(await pending).toBeUndefined();
    expect(closeTrack).toHaveBeenCalledWith('call', 'row');
    await expect(value.init()).rejects.toThrow('closed');
  });
});
