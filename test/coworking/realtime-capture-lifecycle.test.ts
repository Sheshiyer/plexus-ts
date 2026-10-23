import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeJoinResponse, RealtimeRoom, RealtimeMediaTrack } from '../../src/shared/types';
const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, publish: vi.fn(), close: vi.fn(), subscribe: vi.fn(), onConnection: undefined as undefined | ((state: RTCPeerConnectionState) => void) }));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = initial;
    return [harness.slots[index], (value: unknown) => {
      harness.slots[index] = typeof value === 'function' ? value(harness.slots[index]) : value;
    }];
  },
  useRef: (initial: unknown) => {
    const index = harness.cursor++;
    if (!(index in harness.slots)) harness.slots[index] = { current: initial };
    return harness.slots[index];
  },
  useCallback: (callback: unknown) => callback,
  useMemo: (factory: () => unknown) => factory(),
  useEffect: () => {},
}));
vi.mock('../../src/renderer/lib/RealtimeSession', () => ({
  RealtimeSession: class {
    configured = true;
    constructor(_join: unknown, events: { onConnectionStateChange: (state: RTCPeerConnectionState) => void }) { harness.onConnection = events.onConnectionStateChange; }
    init = async () => {};
    close = harness.close;
    publishLocal = harness.publish;
    subscribeRemote = harness.subscribe;
    unpublishLocal = async () => {};
  },
}));
import { useRealtimeMedia } from '../../src/renderer/lib/useRealtimeMedia';
const room = { id: 'room', name: 'Project', roomType: 'project_room' } as RealtimeRoom;
const joined = { call: { id: 'call' }, participant: { id: 'self', displayName: 'Member' }, cloudflare: { configured: true, sessionId: 'provider' } } as RealtimeJoinResponse;
const options = { loungeRoom: null, onRefresh: async () => {} };
function render() { harness.cursor = 0; return useRealtimeMedia(options); }
async function join() {
  const initial = render();
  await initial.dropInToRoom(room);
  return render();
}
beforeEach(() => {
  harness.slots = []; harness.cursor = 0;
  harness.publish.mockReset().mockResolvedValue('published');
  harness.subscribe.mockReset().mockResolvedValue(undefined);
  harness.close.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('window', { plexus: {
    realtimeJoinRoom: vi.fn().mockResolvedValue({ ok: true, joined }),
    realtimeLeaveCall: vi.fn().mockResolvedValue({ ok: true }),
  } });
});
afterEach(() => vi.unstubAllGlobals());
describe('media capture lifecycle using controlled React hook state', () => {
  it('stops delayed microphone capture after room leave', async () => {
    let resolveCapture!: (stream: MediaStream) => void;
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => new Promise((resolve) => { resolveCapture = resolve; })) } });
    const hook = await join();
    const pending = hook.toggleMic();
    await vi.waitFor(() => expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled());
    await hook.leaveActiveJoin(hook.activeJoinList[0]);
    resolveCapture({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await pending;
    expect(stop).toHaveBeenCalled();
    expect(harness.publish).not.toHaveBeenCalled();
    expect(render().micActive).toBe(false);
  });
  it('stops camera capture when publication throws', async () => {
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    harness.publish.mockRejectedValueOnce(new Error('negotiation failed'));
    const hook = await join();
    await hook.toggleCamera();
    expect(stop).toHaveBeenCalled();
    expect(render().cameraActive).toBe(false);
    expect(render().loungeError).toBe('negotiation failed');
  });
  it('stops delayed screen capture after room leave', async () => {
    let resolveCapture!: (stream: MediaStream) => void;
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getDisplayMedia: vi.fn(() => new Promise((resolve) => { resolveCapture = resolve; })) } });
    const hook = await join();
    const pending = hook.toggleScreen();
    await vi.waitFor(() => expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled());
    await hook.leaveActiveJoin(hook.activeJoinList[0]);
    resolveCapture({ getTracks: () => [{ stop }] } as unknown as MediaStream);
    await pending;
    expect(stop).toHaveBeenCalled();
    expect(harness.publish).not.toHaveBeenCalled();
    expect(render().screenActive).toBe(false);
  });
  it('upgrades presence-only membership before requesting a device', async () => {
    vi.mocked(window.plexus.realtimeJoinRoom)
      .mockResolvedValueOnce({ ok: true, joined: { ...joined, cloudflare: { ...joined.cloudflare, sessionId: null } } })
      .mockResolvedValueOnce({ ok: true, joined });
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    const hook = await join();
    await hook.toggleMic();
    expect(window.plexus.realtimeJoinRoom).toHaveBeenLastCalledWith('room', { intent: 'media', media: { audio: false, video: false, screen: false } });
    expect(harness.publish).toHaveBeenCalled();
    expect(render().micActive).toBe(true);
  });
  it('receives active room tracks without opening microphone, camera or screen capture', async () => {
    const getUserMedia = vi.fn();
    const getDisplayMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, getDisplayMedia } });
    const hook = await join();
    const tracks = [{ state: 'live', cloudflareTrackId: 'provider' }] as RealtimeMediaTrack[];
    await hook.subscribeRemoteTracks(tracks, { roomId: 'room', callId: 'call', participantId: 'self' });
    expect(harness.subscribe).toHaveBeenCalledWith(tracks);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });
  it('ignores stale receiving callbacks after leaving or for another call', async () => {
    vi.stubGlobal('navigator', { mediaDevices: {} });
    const hook = await join();
    const tracks = [{ state: 'live', cloudflareTrackId: 'provider' }] as RealtimeMediaTrack[];
    await hook.subscribeRemoteTracks(tracks, { roomId: 'room', callId: 'other-call', participantId: 'self' });
    await hook.leaveActiveJoin(hook.activeJoinList[0]);
    await hook.subscribeRemoteTracks(tracks, { roomId: 'room', callId: 'call', participantId: 'self' });
    expect(harness.subscribe).not.toHaveBeenCalled();
  });

  it('reconciles an empty publication list without allocating a provider session or capturing devices', async () => {
    vi.mocked(window.plexus.realtimeJoinRoom).mockResolvedValue({ ok: true, joined: { ...joined, cloudflare: { ...joined.cloudflare, sessionId: null } } });
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    const hook = await join();
    await hook.subscribeRemoteTracks([], { roomId: 'room', callId: 'call', participantId: 'self' });
    expect(harness.subscribe).toHaveBeenCalledWith([]);
    expect(window.plexus.realtimeJoinRoom).toHaveBeenCalledTimes(1);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('stops local capture promptly when session negotiation requires recovery', async () => {
    const stop = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    const hook = await join();
    await hook.toggleMic();
    expect(render().micActive).toBe(true);
    harness.onConnection?.('failed');
    expect(stop).toHaveBeenCalledOnce();
    expect(render().micActive).toBe(false);
    expect(render().connectionState).toBe('failed');
  });

});
