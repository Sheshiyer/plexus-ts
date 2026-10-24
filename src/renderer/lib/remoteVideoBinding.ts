/** Attach playback only; the RealtimeSession retains ownership of receiver tracks. */
export function attachRemoteVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
  onError: (message: string) => void,
  onStarted: () => void,
): { retry: () => Promise<void>; dispose: () => void } {
  let disposed = false;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.srcObject = stream;
  const retry = async () => {
    if (disposed) return;
    try {
      await video.play();
      if (!disposed) onStarted();
    } catch (error) {
      if (!disposed) onError(`Video playback could not start: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  void retry();
  return {
    retry,
    dispose: () => {
      disposed = true;
      if (video.srcObject === stream) {
        video.pause();
        video.srcObject = null;
      }
    },
  };
}
