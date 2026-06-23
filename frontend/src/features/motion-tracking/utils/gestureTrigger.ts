/**
 * gestureTrigger.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts MediaPipe GestureRecognizer output into stable start/stop triggers.
 * Requires a pretrained Thumb_Up classification held for several frames.
 */

export interface GestureFrame {
  gesture: string;
  score: number;
  handedness: string;
}

export interface GestureTriggerResult {
  detected: boolean;
  holding: boolean;
  holdProgress: number;
  currentGesture: string | null;
  confidence: number;
}

export interface GestureTriggerConfig {
  targetGesture: string;
  minScore: number;
  holdFramesRequired: number;
  cooldownMs: number;
}

const DEFAULT_CONFIG: GestureTriggerConfig = {
  targetGesture: 'Thumb_Up',
  minScore: 0.55,
  holdFramesRequired: 6,
  cooldownMs: 2500,
};

export class GestureTrigger {
  private config: GestureTriggerConfig;
  private holdFrames = 0;
  private lastTriggerTime = 0;
  private armed = true;

  constructor(config: Partial<GestureTriggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.holdFrames = 0;
    this.armed = true;
  }

  disarm(): void {
    this.armed = false;
    this.holdFrames = 0;
  }

  process(frames: GestureFrame[]): GestureTriggerResult {
    const none: GestureTriggerResult = {
      detected: false,
      holding: false,
      holdProgress: 0,
      currentGesture: null,
      confidence: 0,
    };

    if (!frames || frames.length === 0) {
      if (!this.armed) this.armed = true;
      this.holdFrames = 0;
      return none;
    }

    const best = frames
      .filter((f) => f.gesture && f.gesture !== 'None')
      .sort((a, b) => b.score - a.score)[0];

    if (!best) {
      if (!this.armed) this.armed = true;
      this.holdFrames = 0;
      return none;
    }

    const isTarget =
      best.gesture === this.config.targetGesture &&
      best.score >= this.config.minScore;

    if (!isTarget) {
      if (!this.armed) this.armed = true;
      this.holdFrames = 0;
      return {
        detected: false,
        holding: false,
        holdProgress: 0,
        currentGesture: best.gesture,
        confidence: best.score,
      };
    }

    if (!this.armed) {
      return {
        detected: false,
        holding: true,
        holdProgress: 0,
        currentGesture: best.gesture,
        confidence: best.score,
      };
    }

    const now = performance.now();
    if (now - this.lastTriggerTime < this.config.cooldownMs) {
      return {
        detected: false,
        holding: true,
        holdProgress: 0,
        currentGesture: best.gesture,
        confidence: best.score,
      };
    }

    this.holdFrames++;
    const holdProgress = Math.min(1, this.holdFrames / this.config.holdFramesRequired);

    if (this.holdFrames >= this.config.holdFramesRequired) {
      this.lastTriggerTime = now;
      this.disarm();
      this.holdFrames = 0;
      return {
        detected: true,
        holding: true,
        holdProgress: 1,
        currentGesture: best.gesture,
        confidence: best.score,
      };
    }

    return {
      detected: false,
      holding: true,
      holdProgress,
      currentGesture: best.gesture,
      confidence: best.score,
    };
  }
}
