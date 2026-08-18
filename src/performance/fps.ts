export type FrameStats = {
  fps: number;
  frameMs: number;
  minFps: number;
  slowFrames: number;
  updatedAt: number;
};

const DISPLAY_INTERVAL_MS = 250;
const SLOW_FRAME_MS = 42;

export type FpsTracker = {
  sample: (nowMs: number) => FrameStats | null;
  reset: (nowMs: number) => void;
};

export function createFpsTracker(nowMs = Date.now()): FpsTracker {
  let lastFrameAt = nowMs;
  let lastDisplayAt = nowMs;
  let frames = 0;
  let totalFrameMs = 0;
  let slowFrames = 0;
  let minFps = 60;

  return {
    sample(nextNowMs) {
      const frameMs = Math.max(0, nextNowMs - lastFrameAt);
      lastFrameAt = nextNowMs;
      frames += 1;
      totalFrameMs += frameMs;

      if (frameMs >= SLOW_FRAME_MS) {
        slowFrames += 1;
      }

      const elapsed = nextNowMs - lastDisplayAt;
      if (elapsed < DISPLAY_INTERVAL_MS) {
        return null;
      }

      const fps = frames > 0 ? (frames * 1000) / elapsed : 0;
      const averageFrameMs = frames > 0 ? totalFrameMs / frames : 0;
      minFps = Math.min(minFps, fps);

      const stats = {
        fps,
        frameMs: averageFrameMs,
        minFps,
        slowFrames,
        updatedAt: nextNowMs,
      };

      frames = 0;
      totalFrameMs = 0;
      slowFrames = 0;
      lastDisplayAt = nextNowMs;

      return stats;
    },
    reset(resetNowMs) {
      lastFrameAt = resetNowMs;
      lastDisplayAt = resetNowMs;
      frames = 0;
      totalFrameMs = 0;
      slowFrames = 0;
      minFps = 60;
    },
  };
}
