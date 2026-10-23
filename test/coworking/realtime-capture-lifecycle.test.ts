import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { RealtimeJoinResponse, RealtimeRoom } from '../../src/shared/types';
const harness = vi.hoisted(() => ({ slots: [] as unknown[], cursor: 0, publish: vi.fn(), close: vi.fn() }));
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
    init = async () => {};
    close = harness.close;
    publishLocal = harness.publish;
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
});
