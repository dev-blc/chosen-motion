/**
 * poseProcessor.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Pose Processing Module for the Chosen Motion skeletal capture engine.
 *
 * Responsibilities:
 *  - TypeScript interfaces for MediaPipe Pose Landmarker output
 *  - Landmark index constants for all 33 pose landmarks
 *  - Full skeleton connections map (bone pairs) including face, torso, arms, legs
 *  - Joint coordinate extraction utility
 *  - Joint angle calculation (trigonometric)
 *  - In-memory PoseBuffer class for session telemetry (NO video/image storage)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * MediaPipe Pose: 33 Landmark Map
 * ┌──────────────────────────────────────────────────────────┐
 * │  0: nose                                                 │
 * │  1: left_eye_inner    2: left_eye       3: left_eye_outer│
 * │  4: right_eye_inner   5: right_eye      6: right_eye_outer│
 * │  7: left_ear          8: right_ear                       │
 * │  9: mouth_left       10: mouth_right                     │
 * │ 11: left_shoulder    12: right_shoulder                  │
 * │ 13: left_elbow       14: right_elbow                     │
 * │ 15: left_wrist       16: right_wrist                     │
 * │ 17: left_pinky       18: right_pinky                     │
 * │ 19: left_index       20: right_index                     │
 * │ 21: left_thumb       22: right_thumb                     │
 * │ 23: left_hip         24: right_hip                       │
 * │ 25: left_knee        26: right_knee                      │
 * │ 27: left_ankle       28: right_ankle                     │
 * │ 29: left_heel        30: right_heel                      │
 * │ 31: left_foot_index  32: right_foot_index                │
 * └──────────────────────────────────────────────────────────┘
 */

// ─────────────────────────────────────────────────────────────────────────────
// TypeScript Interfaces
// ─────────────────────────────────────────────────────────────────────────────

/** A single normalized landmark from MediaPipe PoseLandmarker output */
export interface Landmark {
  /** Normalized X coordinate (0.0 = left edge, 1.0 = right edge) */
  x: number;
  /** Normalized Y coordinate (0.0 = top edge, 1.0 = bottom edge) */
  y: number;
  /** Normalized Z coordinate (depth relative to hips; negative = closer to camera) */
  z: number;
  /** Visibility confidence [0.0 – 1.0]. Landmark is unreliable if < 0.5 */
  visibility?: number;
  /** Presence confidence [0.0 – 1.0] (available in newer models) */
  presence?: number;
}

/** Extracted coordinates for the 12 primary tracked joints [x, y, z] */
export interface JointCoordinates {
  shoulder_l: number[]; // Landmark 11
  shoulder_r: number[]; // Landmark 12
  elbow_l:    number[]; // Landmark 13
  elbow_r:    number[]; // Landmark 14
  wrist_l:    number[]; // Landmark 15
  wrist_r:    number[]; // Landmark 16
  hip_l:      number[]; // Landmark 23
  hip_r:      number[]; // Landmark 24
  knee_l:     number[]; // Landmark 25
  knee_r:     number[]; // Landmark 26
  ankle_l:    number[]; // Landmark 27
  ankle_r:    number[]; // Landmark 28
}

/** A single telemetry frame captured during an exercise session */
export interface TelemetryFrame {
  /** Elapsed session time in milliseconds when this frame was captured */
  timestamp_millis: number;
  /** Extracted joint coordinates for this frame */
  joint_coordinates: Partial<JointCoordinates>;
  /** Hardware and model signal metadata */
  sensor_signals: {
    /** Estimated frames per second at capture time */
    framerate: number;
    /** Average landmark visibility confidence across all keypoints [0.0 – 1.0] */
    confidence: number;
  };
}

/** Aggregate session statistics computed from buffered frames */
export interface SessionStats {
  /** Total frames captured */
  frameCount: number;
  /** Average landmark confidence across all frames [0–100] */
  avgConfidence: number;
  /** Session duration in seconds (derived from first/last timestamp) */
  durationSeconds: number;
}

/** A skeleton bone connection: pair of landmark indices [fromIndex, toIndex] */
export type BoneConnection = [number, number];

// ─────────────────────────────────────────────────────────────────────────────
// Landmark Index Constants
// ─────────────────────────────────────────────────────────────────────────────

export const MediaPipeIndices = {
  // Face
  NOSE:               0,
  LEFT_EYE_INNER:     1,
  LEFT_EYE:           2,
  LEFT_EYE_OUTER:     3,
  RIGHT_EYE_INNER:    4,
  RIGHT_EYE:          5,
  RIGHT_EYE_OUTER:    6,
  LEFT_EAR:           7,
  RIGHT_EAR:          8,
  MOUTH_LEFT:         9,
  MOUTH_RIGHT:        10,
  // Upper body
  SHOULDER_L:         11,
  SHOULDER_R:         12,
  ELBOW_L:            13,
  ELBOW_R:            14,
  WRIST_L:            15,
  WRIST_R:            16,
  PINKY_L:            17,
  PINKY_R:            18,
  INDEX_L:            19,
  INDEX_R:            20,
  THUMB_L:            21,
  THUMB_R:            22,
  // Lower body
  HIP_L:              23,
  HIP_R:              24,
  KNEE_L:             25,
  KNEE_R:             26,
  ANKLE_L:            27,
  ANKLE_R:            28,
  HEEL_L:             29,
  HEEL_R:             30,
  FOOT_INDEX_L:       31,
  FOOT_INDEX_R:       32,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton Connections Map
//
// Bone connections split by body region for color-coded rendering.
// Each entry is [landmarkIndex_A, landmarkIndex_B].
// ─────────────────────────────────────────────────────────────────────────────

/** Face skeleton: eyes and ears */
export const FACE_CONNECTIONS: BoneConnection[] = [
  [0, 1],   // nose → left_eye_inner
  [1, 2],   // left_eye_inner → left_eye
  [2, 3],   // left_eye → left_eye_outer
  [3, 7],   // left_eye_outer → left_ear
  [0, 4],   // nose → right_eye_inner
  [4, 5],   // right_eye_inner → right_eye
  [5, 6],   // right_eye → right_eye_outer
  [6, 8],   // right_eye_outer → right_ear
  [9, 10],  // mouth_left → mouth_right
];

/** Torso / spine cross connections */
export const TORSO_CONNECTIONS: BoneConnection[] = [
  [11, 12], // left_shoulder → right_shoulder
  [11, 23], // left_shoulder → left_hip
  [12, 24], // right_shoulder → right_hip
  [23, 24], // left_hip → right_hip
];

/** Left arm: shoulder → elbow → wrist → fingers */
export const LEFT_ARM_CONNECTIONS: BoneConnection[] = [
  [11, 13], // left_shoulder → left_elbow
  [13, 15], // left_elbow → left_wrist
  [15, 17], // left_wrist → left_pinky
  [15, 19], // left_wrist → left_index
  [15, 21], // left_wrist → left_thumb
  [17, 19], // left_pinky → left_index
];

/** Right arm: shoulder → elbow → wrist → fingers */
export const RIGHT_ARM_CONNECTIONS: BoneConnection[] = [
  [12, 14], // right_shoulder → right_elbow
  [14, 16], // right_elbow → right_wrist
  [16, 18], // right_wrist → right_pinky
  [16, 20], // right_wrist → right_index
  [16, 22], // right_wrist → right_thumb
  [18, 20], // right_pinky → right_index
];

/** Left leg: hip → knee → ankle → foot */
export const LEFT_LEG_CONNECTIONS: BoneConnection[] = [
  [23, 25], // left_hip → left_knee
  [25, 27], // left_knee → left_ankle
  [27, 29], // left_ankle → left_heel
  [29, 31], // left_heel → left_foot_index
  [27, 31], // left_ankle → left_foot_index
];

/** Right leg: hip → knee → ankle → foot */
export const RIGHT_LEG_CONNECTIONS: BoneConnection[] = [
  [24, 26], // right_hip → right_knee
  [26, 28], // right_knee → right_ankle
  [28, 30], // right_ankle → right_heel
  [30, 32], // right_heel → right_foot_index
  [28, 32], // right_ankle → right_foot_index
];

/** All connections combined for simple full-body rendering */
export const ALL_CONNECTIONS: BoneConnection[] = [
  ...TORSO_CONNECTIONS,
  ...LEFT_ARM_CONNECTIONS,
  ...RIGHT_ARM_CONNECTIONS,
  ...LEFT_LEG_CONNECTIONS,
  ...RIGHT_LEG_CONNECTIONS,
];

/** Primary trackable joints used for angle calculations and telemetry */
export const PRIMARY_JOINT_INDICES: number[] = [
  11, 12,       // shoulders
  13, 14,       // elbows
  15, 16,       // wrists
  23, 24,       // hips
  25, 26,       // knees
  27, 28,       // ankles
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the 12 primary joint coordinates from 33 raw MediaPipe landmarks.
 * Only returns landmarks with visibility >= 0.0 (uses raw values).
 */
export function extractJoints(landmarks: Landmark[]): Partial<JointCoordinates> {
  if (!landmarks || landmarks.length === 0) return {};

  const getCoord = (idx: number): number[] => {
    const pt = landmarks[idx];
    return pt ? [pt.x, pt.y, pt.z] : [0, 0, 0];
  };

  return {
    shoulder_l: getCoord(MediaPipeIndices.SHOULDER_L),
    shoulder_r: getCoord(MediaPipeIndices.SHOULDER_R),
    elbow_l:    getCoord(MediaPipeIndices.ELBOW_L),
    elbow_r:    getCoord(MediaPipeIndices.ELBOW_R),
    wrist_l:    getCoord(MediaPipeIndices.WRIST_L),
    wrist_r:    getCoord(MediaPipeIndices.WRIST_R),
    hip_l:      getCoord(MediaPipeIndices.HIP_L),
    hip_r:      getCoord(MediaPipeIndices.HIP_R),
    knee_l:     getCoord(MediaPipeIndices.KNEE_L),
    knee_r:     getCoord(MediaPipeIndices.KNEE_R),
    ankle_l:    getCoord(MediaPipeIndices.ANKLE_L),
    ankle_r:    getCoord(MediaPipeIndices.ANKLE_R),
  };
}

/**
 * Calculate the angle in degrees at joint B, formed by points A–B–C.
 * Uses the dot-product formula for robust 2D angle computation.
 *
 * @param a - Point A [x, y] or [x, y, z] (proximal segment start)
 * @param b - Point B [x, y] or [x, y, z] (the joint vertex / angle origin)
 * @param c - Point C [x, y] or [x, y, z] (distal segment end)
 * @returns Angle in integer degrees [0 – 180]
 *
 * @example
 * // Right elbow flexion angle
 * const angle = calculateJointAngle(
 *   joints.shoulder_r, joints.elbow_r, joints.wrist_r
 * );
 */
export function calculateJointAngle(a: number[], b: number[], c: number[]): number {
  if (!a || !b || !c || a.length < 2 || b.length < 2 || c.length < 2) return 0;

  const baX = a[0] - b[0];
  const baY = a[1] - b[1];
  const bcX = c[0] - b[0];
  const bcY = c[1] - b[1];

  const dotProduct = baX * bcX + baY * bcY;
  const magBA = Math.sqrt(baX * baX + baY * baY);
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY);

  if (magBA === 0 || magBC === 0) return 0;

  const cosAngle = dotProduct / (magBA * magBC);
  // Clamp to [-1, 1] to prevent NaN from floating-point drift
  const clampedCos = Math.max(-1.0, Math.min(1.0, cosAngle));
  const radians = Math.acos(clampedCos);
  return Math.round((radians * 180.0) / Math.PI);
}

export type JointType = 'shoulder' | 'elbow' | 'hip' | 'knee';

/**
 * Calculate angle for a specific joint type ('shoulder' | 'elbow' | 'hip' | 'knee')
 * on the specified side ('left' | 'right') based on raw MediaPipe landmarks.
 * 
 * @returns Computed angle in integer degrees [0 - 180]
 */
export function calculateAngle(
  joint: JointType,
  landmarks: Landmark[],
  side: 'left' | 'right' = 'right'
): number {
  if (!landmarks || landmarks.length === 0) return 0;

  let aIdx: number, bIdx: number, cIdx: number;

  if (side === 'left') {
    switch (joint) {
      case 'shoulder':
        // Hip -> Shoulder -> Elbow
        aIdx = MediaPipeIndices.HIP_L;
        bIdx = MediaPipeIndices.SHOULDER_L;
        cIdx = MediaPipeIndices.ELBOW_L;
        break;
      case 'elbow':
        // Shoulder -> Elbow -> Wrist
        aIdx = MediaPipeIndices.SHOULDER_L;
        bIdx = MediaPipeIndices.ELBOW_L;
        cIdx = MediaPipeIndices.WRIST_L;
        break;
      case 'hip':
        // Shoulder -> Hip -> Knee
        aIdx = MediaPipeIndices.SHOULDER_L;
        bIdx = MediaPipeIndices.HIP_L;
        cIdx = MediaPipeIndices.KNEE_L;
        break;
      case 'knee':
        // Hip -> Knee -> Ankle
        aIdx = MediaPipeIndices.HIP_L;
        bIdx = MediaPipeIndices.KNEE_L;
        cIdx = MediaPipeIndices.ANKLE_L;
        break;
    }
  } else {
    switch (joint) {
      case 'shoulder':
        // Hip -> Shoulder -> Elbow
        aIdx = MediaPipeIndices.HIP_R;
        bIdx = MediaPipeIndices.SHOULDER_R;
        cIdx = MediaPipeIndices.ELBOW_R;
        break;
      case 'elbow':
        // Shoulder -> Elbow -> Wrist
        aIdx = MediaPipeIndices.SHOULDER_R;
        bIdx = MediaPipeIndices.ELBOW_R;
        cIdx = MediaPipeIndices.WRIST_R;
        break;
      case 'hip':
        // Shoulder -> Hip -> Knee
        aIdx = MediaPipeIndices.SHOULDER_R;
        bIdx = MediaPipeIndices.HIP_R;
        cIdx = MediaPipeIndices.KNEE_R;
        break;
      case 'knee':
        // Hip -> Knee -> Ankle
        aIdx = MediaPipeIndices.HIP_R;
        bIdx = MediaPipeIndices.KNEE_R;
        cIdx = MediaPipeIndices.ANKLE_R;
        break;
    }
  }

  const ptA = landmarks[aIdx];
  const ptB = landmarks[bIdx];
  const ptC = landmarks[cIdx];

  if (!ptA || !ptB || !ptC) return 0;

  return calculateJointAngle(
    [ptA.x, ptA.y],
    [ptB.x, ptB.y],
    [ptC.x, ptC.y]
  );
}


/**
 * Compute average landmark visibility confidence for a frame.
 * @returns A value between 0.0 and 1.0
 */
export function computeFrameConfidence(landmarks: Landmark[]): number {
  if (!landmarks || landmarks.length === 0) return 0;
  const total = landmarks.reduce((acc, l) => {
    const v = l.visibility ?? l.presence ?? 0;
    // If landmark has coordinates but no visibility score, assume moderate confidence
    if (v <= 0 && l.x !== undefined && l.y !== undefined) return acc + 0.5;
    return acc + v;
  }, 0);
  return total / landmarks.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// PoseBuffer: In-Memory Telemetry Session Store
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PoseBuffer manages the in-memory array of telemetry frames for one exercise session.
 * It is deliberately ephemeral — data is never persisted to disk, localStorage,
 * or any database until the session is explicitly submitted via the API.
 *
 * Usage:
 * ```ts
 * const buffer = new PoseBuffer();
 * buffer.pushFrame(performance.now(), landmarks);
 * const frames = buffer.getFrames(); // pass to uploadMotionSession()
 * buffer.clear(); // reset after upload
 * ```
 */
export class PoseBuffer {
  private buffer: TelemetryFrame[] = [];

  constructor() {
    this.buffer = [];
  }

  /**
   * Record a new landmark frame into the session buffer.
   * @param timestampMillis - Elapsed session time (use performance.now() or Date.now())
   * @param landmarks       - Raw MediaPipe Landmark[] array (33 items)
   * @param framerate       - Estimated capture framerate (default 30 fps)
   */
  public pushFrame(
    timestampMillis: number,
    landmarks: Landmark[],
    framerate: number = 30
  ): void {
    if (!landmarks || landmarks.length === 0) return;

    const joint_coordinates = extractJoints(landmarks);
    const confidence = computeFrameConfidence(landmarks);

    this.buffer.push({
      timestamp_millis: timestampMillis,
      joint_coordinates,
      sensor_signals: { framerate, confidence },
    });
  }

  /** Return all buffered telemetry frames */
  public getFrames(): TelemetryFrame[] {
    return this.buffer;
  }

  /** Return the number of captured frames */
  public getFrameCount(): number {
    return this.buffer.length;
  }

  /** Compute aggregate session statistics from all buffered frames */
  public getStats(): SessionStats {
    const count = this.buffer.length;
    if (count === 0) return { frameCount: 0, avgConfidence: 0, durationSeconds: 0 };

    const totalConf = this.buffer.reduce((acc, f) => acc + f.sensor_signals.confidence, 0);
    const avgConfidence = Math.round((totalConf / count) * 100);

    const first = this.buffer[0].timestamp_millis;
    const last = this.buffer[count - 1].timestamp_millis;
    const durationSeconds = Math.round((last - first) / 1000);

    return { frameCount: count, avgConfidence, durationSeconds };
  }

  /** Compute average landmark confidence [0–100] across all frames */
  public getAverageConfidence(): number {
    return this.getStats().avgConfidence;
  }

  /** Clear all buffered frames (call after successful session upload) */
  public clear(): void {
    this.buffer = [];
  }
}
