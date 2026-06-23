/**
 * thumbsUpDetector.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Thumbs-up gesture detection using MediaPipe Pose hand landmarks.
 *
 * Requires the gesture to be held steady for several frames before firing,
 * which greatly reduces accidental triggers during exercise movement.
 */

import { Landmark, MediaPipeIndices, calculateAngle } from './poseProcessor';

export interface ThumbsUpDetectorConfig {
  minVisibility: number;
  /** Frames the pose must be held before triggering (~12 ≈ 0.4 s at 30 fps) */
  holdFramesRequired: number;
  /** Cooldown after a trigger before another can register (ms) */
  cooldownMs: number;
  /** Thumb must be this far above wrist (normalised y; image y grows downward) */
  thumbAboveWristMin: number;
  /** Thumb must be this far above index finger tip */
  thumbAboveIndexMin: number;
}

const DEFAULT_CONFIG: ThumbsUpDetectorConfig = {
  minVisibility: 0.25,
  holdFramesRequired: 8,
  cooldownMs: 2500,
  thumbAboveWristMin: 0.015,
  thumbAboveIndexMin: 0.01,
};

export interface ThumbsUpDetectorResult {
  detected: boolean;
  /** True while a thumbs-up pose is visible (even if not yet held long enough) */
  holding: boolean;
  /** 0–1 progress toward the required hold duration */
  holdProgress: number;
  side: 'left' | 'right' | null;
}

function dist(a: Landmark, b: Landmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function scoreThumbsUpSide(
  landmarks: Landmark[],
  side: 'left' | 'right',
  config: ThumbsUpDetectorConfig
): number {
  const wristIdx = side === 'left' ? MediaPipeIndices.WRIST_L : MediaPipeIndices.WRIST_R;
  const thumbIdx = side === 'left' ? MediaPipeIndices.THUMB_L : MediaPipeIndices.THUMB_R;
  const indexIdx = side === 'left' ? MediaPipeIndices.INDEX_L : MediaPipeIndices.INDEX_R;
  const pinkyIdx = side === 'left' ? MediaPipeIndices.PINKY_L : MediaPipeIndices.PINKY_R;
  const elbowIdx = side === 'left' ? MediaPipeIndices.ELBOW_L : MediaPipeIndices.ELBOW_R;
  const hipIdx = side === 'left' ? MediaPipeIndices.HIP_L : MediaPipeIndices.HIP_R;

  const wrist = landmarks[wristIdx];
  const thumb = landmarks[thumbIdx];
  const index = landmarks[indexIdx];
  const pinky = landmarks[pinkyIdx];
  const elbow = landmarks[elbowIdx];
  const hip = landmarks[hipIdx];

  if (!wrist || !thumb || !index || !pinky || !elbow || !hip) return 0;

  const vis = Math.min(
    wrist.visibility ?? 0,
    thumb.visibility ?? 0,
    index.visibility ?? 0,
    elbow.visibility ?? 0
  );
  if (vis < config.minVisibility) return 0;

  let score = 0;

  // Thumb tip above wrist (pointing up)
  if (thumb.y < wrist.y - config.thumbAboveWristMin) score += 2;

  // Thumb above curled index and pinky
  if (thumb.y < index.y - config.thumbAboveIndexMin) score += 2;
  if (thumb.y < pinky.y - config.thumbAboveIndexMin) score += 1;

  // Thumb extended further from wrist than index (extended vs curled)
  const thumbDist = dist(thumb, wrist);
  const indexDist = dist(index, wrist);
  if (thumbDist > indexDist * 0.75) score += 1;

  // Hand raised above hip
  if (wrist.y < hip.y - 0.04) score += 2;

  // Elbow bent so arm is lifted (not hanging at side)
  const elbowAngle = calculateAngle('elbow', landmarks, side);
  if (elbowAngle < 155) score += 1;

  // Thumb is highest point among finger landmarks on this hand
  const fingerYs = [wrist.y, thumb.y, index.y, pinky.y];
  if (thumb.y === Math.min(...fingerYs)) score += 1;

  return score;
}

const MATCH_THRESHOLD = 5;

export class ThumbsUpDetector {
  private config: ThumbsUpDetectorConfig;
  private holdFrames = 0;
  private lastTriggerTime = 0;
  private armed = true;

  constructor(config: Partial<ThumbsUpDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.holdFrames = 0;
    this.armed = true;
  }

  /** Call after a successful trigger; requires releasing the pose before re-arming */
  disarm(): void {
    this.armed = false;
    this.holdFrames = 0;
  }

  /** Call when the pose is no longer detected so the next gesture can register */
  rearm(): void {
    this.armed = true;
    this.holdFrames = 0;
  }

  detect(landmarks: Landmark[]): ThumbsUpDetectorResult {
    const none: ThumbsUpDetectorResult = {
      detected: false,
      holding: false,
      holdProgress: 0,
      side: null,
    };

    if (!landmarks || landmarks.length < 33) return none;

    const leftScore = scoreThumbsUpSide(landmarks, 'left', this.config);
    const rightScore = scoreThumbsUpSide(landmarks, 'right', this.config);
    const leftMatch = leftScore >= MATCH_THRESHOLD;
    const rightMatch = rightScore >= MATCH_THRESHOLD;
    const isThumbsUp = leftMatch || rightMatch;
    const side: 'left' | 'right' | null = leftMatch
      ? 'left'
      : rightMatch
        ? 'right'
        : null;

    if (!isThumbsUp) {
      if (!this.armed) this.rearm();
      this.holdFrames = 0;
      return none;
    }

    if (!this.armed) {
      return { detected: false, holding: true, holdProgress: 0, side };
    }

    const now = performance.now();
    if (now - this.lastTriggerTime < this.config.cooldownMs) {
      return { detected: false, holding: true, holdProgress: 0, side };
    }

    this.holdFrames++;
    const holdProgress = Math.min(1, this.holdFrames / this.config.holdFramesRequired);

    if (this.holdFrames >= this.config.holdFramesRequired) {
      this.lastTriggerTime = now;
      this.disarm();
      this.holdFrames = 0;
      return { detected: true, holding: true, holdProgress: 1, side };
    }

    return { detected: false, holding: true, holdProgress, side };
  }
}
