/**
 * clapDetector.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hand-clap gesture detection using MediaPipe Pose landmarks.
 *
 * Uses a multi-criteria state machine to minimise false positives during
 * exercises (e.g. lunges) where arms may move but should not trigger start/stop.
 */

import { Landmark, MediaPipeIndices, calculateAngle } from './poseProcessor';

export interface ClapDetectorConfig {
  /** Minimum wrist visibility to consider a landmark reliable */
  minWristVisibility: number;
  /** Normalised distance below which wrists are considered in contact */
  contactDistance: number;
  /** Normalised distance above which hands are considered separated */
  openDistance: number;
  /** Minimum frames wrists must stay separated before a new clap can register */
  minOpenFrames: number;
  /** Minimum frames wrists must remain in contact to confirm a clap */
  minContactFrames: number;
  /** Cooldown between registered claps (ms) */
  cooldownMs: number;
  /** Max vertical offset between wrists for a symmetric clap */
  maxWristYDelta: number;
  /** Wrists must be above this fraction of torso height (0=nose, 1=hip) */
  minTorsoHeightRatio: number;
  /** Wrists must be below this fraction of torso height */
  maxTorsoHeightRatio: number;
  /** Elbow angle range that indicates arms are raised/bent for clapping */
  minElbowAngle: number;
  maxElbowAngle: number;
  /** Minimum approach speed (normalised distance decrease per frame) */
  minApproachSpeed: number;
}

const DEFAULT_CONFIG: ClapDetectorConfig = {
  minWristVisibility: 0.55,
  contactDistance: 0.065,
  openDistance: 0.16,
  minOpenFrames: 4,
  minContactFrames: 2,
  cooldownMs: 2200,
  maxWristYDelta: 0.09,
  minTorsoHeightRatio: 0.15,
  maxTorsoHeightRatio: 0.85,
  minElbowAngle: 55,
  maxElbowAngle: 155,
  minApproachSpeed: 0.008,
};

type ClapPhase = 'open' | 'approaching' | 'contact';

export interface ClapDetectorResult {
  detected: boolean;
  /** 0–1 confidence score for the current frame's clap signal */
  confidence: number;
  /** Human-readable reason when constraints fail (debug / UI) */
  debugReason?: string;
}

export class ClapDetector {
  private config: ClapDetectorConfig;
  private phase: ClapPhase = 'open';
  private openFrameCount = 0;
  private contactFrameCount = 0;
  private lastClapTime = 0;
  private distanceHistory: number[] = [];
  private readonly historySize = 8;

  constructor(config: Partial<ClapDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  reset(): void {
    this.phase = 'open';
    this.openFrameCount = 0;
    this.contactFrameCount = 0;
    this.distanceHistory = [];
  }

  /**
   * Process one frame of pose landmarks.
   * Returns `{ detected: true }` once per confirmed clap gesture.
   */
  detect(landmarks: Landmark[]): ClapDetectorResult {
    const fail = (reason: string): ClapDetectorResult => ({
      detected: false,
      confidence: 0,
      debugReason: reason,
    });

    if (!landmarks || landmarks.length < 33) {
      return fail('insufficient landmarks');
    }

    const now = performance.now();
    if (now - this.lastClapTime < this.config.cooldownMs) {
      return fail('cooldown');
    }

    const lw = landmarks[MediaPipeIndices.WRIST_L];
    const rw = landmarks[MediaPipeIndices.WRIST_R];
    const ls = landmarks[MediaPipeIndices.SHOULDER_L];
    const rs = landmarks[MediaPipeIndices.SHOULDER_R];
    const le = landmarks[MediaPipeIndices.ELBOW_L];
    const re = landmarks[MediaPipeIndices.ELBOW_R];
    const nose = landmarks[MediaPipeIndices.NOSE];
    const lh = landmarks[MediaPipeIndices.HIP_L];
    const rh = landmarks[MediaPipeIndices.HIP_R];

    if (!lw || !rw || !ls || !rs || !le || !re || !nose || !lh || !rh) {
      return fail('missing key landmarks');
    }

    const lwVis = lw.visibility ?? 0;
    const rwVis = rw.visibility ?? 0;
    if (lwVis < this.config.minWristVisibility || rwVis < this.config.minWristVisibility) {
      this.resetPhaseToOpen();
      return fail('low wrist visibility');
    }

    const elbowL = calculateAngle('elbow', landmarks, 'left');
    const elbowR = calculateAngle('elbow', landmarks, 'right');
    const elbowsBent =
      elbowL >= this.config.minElbowAngle &&
      elbowL <= this.config.maxElbowAngle &&
      elbowR >= this.config.minElbowAngle &&
      elbowR <= this.config.maxElbowAngle;

    if (!elbowsBent) {
      this.resetPhaseToOpen();
      return fail('arms not in clap position');
    }

    const hipY = (lh.y + rh.y) / 2;
    const torsoSpan = Math.max(hipY - nose.y, 0.1);
    const wristY = (lw.y + rw.y) / 2;
    const heightRatio = (wristY - nose.y) / torsoSpan;

    if (
      heightRatio < this.config.minTorsoHeightRatio ||
      heightRatio > this.config.maxTorsoHeightRatio
    ) {
      this.resetPhaseToOpen();
      return fail('hands not at chest height');
    }

    if (Math.abs(lw.y - rw.y) > this.config.maxWristYDelta) {
      this.resetPhaseToOpen();
      return fail('asymmetric hand height');
    }

    const shoulderMidX = (ls.x + rs.x) / 2;
    const shoulderWidth = Math.abs(rs.x - ls.x);
    const wristMidX = (lw.x + rw.x) / 2;
    if (Math.abs(wristMidX - shoulderMidX) > shoulderWidth * 0.75) {
      this.resetPhaseToOpen();
      return fail('hands not centred on body');
    }

    const dx = lw.x - rw.x;
    const dy = lw.y - rw.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    this.distanceHistory.push(distance);
    if (this.distanceHistory.length > this.historySize) {
      this.distanceHistory.shift();
    }

    const approachSpeed = this.computeApproachSpeed();

    if (distance >= this.config.openDistance) {
      this.openFrameCount++;
      this.contactFrameCount = 0;
      this.phase = 'open';
      return { detected: false, confidence: 0 };
    }

    if (distance <= this.config.contactDistance) {
      this.contactFrameCount++;

      if (
        this.phase !== 'contact' &&
        this.openFrameCount >= this.config.minOpenFrames &&
        approachSpeed >= this.config.minApproachSpeed
      ) {
        this.phase = 'approaching';
      }

      if (
        this.contactFrameCount >= this.config.minContactFrames &&
        this.openFrameCount >= this.config.minOpenFrames &&
        (this.phase === 'approaching' || approachSpeed >= this.config.minApproachSpeed)
      ) {
        this.lastClapTime = now;
        this.phase = 'contact';
        this.openFrameCount = 0;
        this.contactFrameCount = 0;
        this.distanceHistory = [];

        const visConfidence = (lwVis + rwVis) / 2;
        const proximityConfidence = 1 - distance / this.config.contactDistance;
        const speedConfidence = Math.min(approachSpeed / (this.config.minApproachSpeed * 3), 1);
        const confidence = Math.min(1, visConfidence * 0.4 + proximityConfidence * 0.35 + speedConfidence * 0.25);

        return { detected: true, confidence };
      }

      this.phase = 'contact';
      return { detected: false, confidence: 0.3 };
    }

    if (distance < this.config.openDistance && distance > this.config.contactDistance) {
      if (this.openFrameCount >= this.config.minOpenFrames && approachSpeed >= this.config.minApproachSpeed) {
        this.phase = 'approaching';
      }
    }

    return { detected: false, confidence: 0 };
  }

  private computeApproachSpeed(): number {
    if (this.distanceHistory.length < 3) return 0;
    const recent = this.distanceHistory.slice(-3);
    let totalDecrease = 0;
    for (let i = 1; i < recent.length; i++) {
      totalDecrease += recent[i - 1] - recent[i];
    }
    return totalDecrease / (recent.length - 1);
  }

  private resetPhaseToOpen(): void {
    if (this.phase !== 'open') {
      this.phase = 'open';
      this.contactFrameCount = 0;
    }
  }
}
