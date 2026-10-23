import { afterEach, describe, expect, it, vi } from 'vitest';
import { startRealtimeRoomPolling } from '../../src/renderer/lib/realtimeRoomPolling';
import type { RealtimeRoomDetail } from '../../src/shared/types';
const scope = { roomId: 'lounge', callId: 'lounge-call', participantId: 'self' };
const remote = { id: 'audio', roomId: 'lounge', callSessionId: 'lounge-call', participantId: 'other', trackKind: 'audio', direction: 'publish', state: 'live', cloudflareTrackId: 'provider-audio' };
function detail(overrides = {}): RealtimeRoomDetail {
  return { room: { id: 'lounge' }, call: { id: 'lounge-call' }, tracks: [remote], participants: [], ...overrides } as unknown as RealtimeRoomDetail;
}
function setup(fetchDetail = vi.fn().mockResolvedValue({ ok: true, detail: detail() })) {
  const onTracks = vi.fn().mockResolvedValue(undefined);
  const onDetail = vi.fn();
  const onError = vi.fn();
  const stop = startRealtimeRoomPolling({ scope, fetchDetail, onTracks, onDetail, onError, intervalMs: 100 });
  return { stop, fetchDetail, onTracks, onDetail, onError };
}
afterEach(() => vi.useRealTimers());
describe('active room receiving poll', () => {
  it('receives lounge tracks immediately and notices publications on subsequent polls', async () => {
    vi.useFakeTimers();
    const state = setup();
    await vi.advanceTimersByTimeAsync(0);
    expect(state.fetchDetail).toHaveBeenCalledWith('lounge');
    expect(state.onTracks).toHaveBeenCalledWith([remote], scope);
    state.fetchDetail.mockResolvedValue({ ok: true, detail: detail({ tracks: [remote, { ...remote, id: 'camera', trackKind: 'camera' }] }) });
    await vi.advanceTimersByTimeAsync(100);
    expect(state.onTracks).toHaveBeenLastCalledWith([remote, expect.objectContaining({ id: 'camera' })], scope);
    state.stop();
  });
  it('filters own, closed, subscription, other-room and other-call tracks', async () => {
    vi.useFakeTimers();
    const state = setup(vi.fn().mockResolvedValue({ ok: true, detail: detail({ tracks: [remote,
      { ...remote, participantId: 'self' }, { ...remote, state: 'closed' },
      { ...remote, direction: 'subscribe' }, { ...remote, roomId: 'other-room' },
      { ...remote, callSessionId: 'other-call' },
    ] }) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.onTracks).toHaveBeenCalledWith([remote], scope);
    state.stop();
  });
  it('ignores a stale response after room leave and stops polling', async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    const state = setup(vi.fn(() => new Promise((resolve) => { finish = resolve; })));
    state.stop();
    finish({ ok: true, detail: detail() });
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.onTracks).not.toHaveBeenCalled();
    expect(state.onDetail).not.toHaveBeenCalled();
    expect(state.fetchDetail).toHaveBeenCalledTimes(1);
  });
  it('ignores responses for another room or a replaced call', async () => {
    vi.useFakeTimers();
    const state = setup(vi.fn().mockResolvedValue({ ok: true, detail: detail({ call: { id: 'new-call' } }) }));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.onTracks).not.toHaveBeenCalled();
    state.fetchDetail.mockResolvedValue({ ok: true, detail: detail({ room: { id: 'other-room' } }) });
    await vi.advanceTimersByTimeAsync(100);
    expect(state.onTracks).not.toHaveBeenCalled();
    state.stop();
  });
  it('does not overlap slow polls', async () => {
    vi.useFakeTimers();
    const state = setup(vi.fn(() => new Promise(() => {})));
    await vi.advanceTimersByTimeAsync(500);
    expect(state.fetchDetail).toHaveBeenCalledTimes(1);
    state.stop();
  });
});
