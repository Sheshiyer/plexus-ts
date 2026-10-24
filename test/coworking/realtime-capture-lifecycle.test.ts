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
function render(input: Parameters<typeof useRealtimeMedia>[0] = options) { harness.cursor = 0; return useRealtimeMedia(input); }
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
  it('upgrades presence-only membership after obtaining a device', async () => {
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

  it('joins the lounge without device capture or an idle provider allocation', async () => {
    const getUserMedia = vi.fn();
    const getDisplayMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia, getDisplayMedia } });
    vi.mocked(window.plexus.realtimeJoinRoom).mockResolvedValue({ ok: true, joined: { ...joined, cloudflare: { ...joined.cloudflare, configured: false, sessionId: null } } });
    const input = { ...options, loungeRoom: { ...room, roomType: 'workspace_lobby' } as RealtimeRoom };
    await render(input).joinLounge();
    expect(window.plexus.realtimeJoinRoom).toHaveBeenCalledExactlyOnceWith('room', { intent: 'presence_only', media: { audio: false, video: false, screen: false } });
    await render(input).subscribeRemoteTracks([], { roomId: 'room', callId: 'call', participantId: 'self' });
    expect(window.plexus.realtimeJoinRoom).toHaveBeenCalledTimes(1);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(harness.publish).not.toHaveBeenCalled();
  });
  it.each(['mic', 'camera', 'screen'] as const)('waits for %s capture permission before allocating the first provider session', async (kind) => {
    let finishCapture!: (stream: MediaStream) => void;
    const capture = vi.fn(() => new Promise<MediaStream>((resolve) => { finishCapture = resolve; }));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: capture, getDisplayMedia: capture } });
    vi.mocked(window.plexus.realtimeJoinRoom)
      .mockResolvedValueOnce({ ok: true, joined: { ...joined, cloudflare: { ...joined.cloudflare, sessionId: null } } })
      .mockResolvedValueOnce({ ok: true, joined });
    const hook = await join();
    const pending = kind === 'mic' ? hook.toggleMic() : kind === 'camera' ? hook.toggleCamera() : hook.toggleScreen();
    await vi.waitFor(() => expect(capture).toHaveBeenCalledOnce());
    expect(window.plexus.realtimeJoinRoom).toHaveBeenCalledTimes(1);
    expect(harness.publish).not.toHaveBeenCalled();
    const track = { stop: vi.fn(), onended: null };
    finishCapture({ getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream);
    await pending;
    expect(window.plexus.realtimeJoinRoom).toHaveBeenCalledTimes(2);
    expect(window.plexus.realtimeJoinRoom).toHaveBeenLastCalledWith('room', { intent: 'media', media: { audio: false, video: false, screen: false } });
    expect(harness.publish).toHaveBeenCalledOnce();
  });
  it('does not allocate a provider session when first capture permission is denied', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new Error('Permission denied')) } });
    vi.mocked(window.plexus.realtimeJoinRoom).mockResolvedValue({ ok: true, joined: { ...joined, cloudflare: { ...joined.cloudflare, sessionId: null } } });
    const hook = await join();
    await hook.toggleMic();
    expect(window.plexus.realtimeJoinRoom).toHaveBeenCalledTimes(1);
    expect(harness.publish).not.toHaveBeenCalled();
    expect(render().loungeError).toBe('Permission denied');
  });

  it.each([
    ['project', true], ['project', false], ['lounge', true], ['lounge', false],
  ] as const)('stops capture before %s leave and closes the peer after Worker response (ok=%s)', async (scope, ok) => {
    const order: string[] = [];
    const stop = vi.fn(() => order.push('capture stopped'));
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] }) } });
    const input = scope === 'lounge' ? { ...options, loungeRoom: { ...room, roomType: 'workspace_lobby' } as RealtimeRoom } : options;
    const initial = render(input);
    if (scope === 'lounge') await initial.joinLounge(); else await initial.dropInToRoom(room);
    const hook = render(input);
    await hook.toggleMic();
    order.length = 0;
    harness.close.mockImplementation(async () => { order.push('peer closed'); });
    let finishLeave!: (result: { ok: boolean; message?: string }) => void;
    vi.mocked(window.plexus.realtimeLeaveCall).mockImplementation(() => {
      order.push('Worker leave requested');
      return new Promise((resolve) => { finishLeave = resolve; });
    });
    const leaving = scope === 'lounge' ? hook.leaveLounge() : hook.leaveActiveJoin(hook.activeJoinList[0]);
    await vi.waitFor(() => expect(window.plexus.realtimeLeaveCall).toHaveBeenCalledOnce());
    expect(order).toEqual(['capture stopped', 'Worker leave requested']);
    expect(harness.close).not.toHaveBeenCalled();
    expect(render(input).micActive).toBe(false);
    finishLeave({ ok, message: ok ? undefined : 'Provider close failed' });
    await Promise.allSettled([leaving]);
    expect(order).toEqual(['capture stopped', 'Worker leave requested', 'peer closed']);
    expect(harness.close).toHaveBeenCalledOnce();
    expect(render(input).activeJoinList).toHaveLength(ok ? 0 : 1);
  });

});
