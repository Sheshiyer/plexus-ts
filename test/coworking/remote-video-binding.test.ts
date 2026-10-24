import { describe, expect, it, vi } from 'vitest';
import { attachRemoteVideo } from '../../src/renderer/lib/remoteVideoBinding';
function video() {
  return { play: vi.fn().mockResolvedValue(undefined), pause: vi.fn(), srcObject: null, muted: false, autoplay: false, playsInline: false } as unknown as HTMLVideoElement;
}
describe('remote video playback binding', () => {
  it('attaches the received stream to muted inline autoplay and releases only the element on cleanup', async () => {
    const element = video();
    const stop = vi.fn();
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
    const onStarted = vi.fn();
    const binding = attachRemoteVideo(element, stream, vi.fn(), onStarted);
    await Promise.resolve();
    expect(element.srcObject).toBe(stream);
    expect([element.muted, element.autoplay, element.playsInline]).toEqual([true, true, true]);
    expect(element.play).toHaveBeenCalledOnce();
    expect(onStarted).toHaveBeenCalledOnce();
    binding.dispose();
    expect(element.srcObject).toBeNull();
    expect(element.pause).toHaveBeenCalledOnce();
    expect(stop).not.toHaveBeenCalled();
  });
  it('surfaces a playback rejection and retries from an explicit interaction', async () => {
    const element = video();
    vi.mocked(element.play).mockRejectedValueOnce(new Error('autoplay denied'));
    const onError = vi.fn();
    const onStarted = vi.fn();
    const binding = attachRemoteVideo(element, {} as MediaStream, onError, onStarted);
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('autoplay denied'));
    await binding.retry();
    expect(element.play).toHaveBeenCalledTimes(2);
    expect(onStarted).toHaveBeenCalledOnce();
    binding.dispose();
  });
  it('suppresses stale playback completion after unmount and leaves replacement bindings alone', async () => {
    const element = video();
    let fail!: (reason: Error) => void;
    vi.mocked(element.play).mockReturnValueOnce(new Promise((_resolve, reject) => { fail = reject; }));
    const onError = vi.fn();
    const onStarted = vi.fn();
    const binding = attachRemoteVideo(element, {} as MediaStream, onError, onStarted);
    const replacement = {} as MediaStream;
    element.srcObject = replacement;
    binding.dispose();
    fail(new Error('late failure'));
    await Promise.resolve();
    expect(onError).not.toHaveBeenCalled();
    expect(onStarted).not.toHaveBeenCalled();
    expect(element.srcObject).toBe(replacement);
    expect(element.pause).not.toHaveBeenCalled();
    await binding.retry();
    expect(element.play).toHaveBeenCalledOnce();
  });
});
