interface MotionFrame {
  timestamp_millis: number;
  joint_coordinates: Record<string, number[]>;
}

const calculateAngle = (a: number[], b: number[], c: number[]) => {
  const baX = a[0] - b[0];
  const baY = a[1] - b[1];
  const bcX = c[0] - b[0];
  const bcY = c[1] - b[1];
  const dot = baX * bcX + baY * bcY;
  const magBA = Math.sqrt(baX * baX + baY * baY);
  const magBC = Math.sqrt(bcX * bcX + bcY * bcY);
  if (magBA === 0 || magBC === 0) return 180;
  const cos = dot / (magBA * magBC);
  return Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
};

export const getKneeAngle = (coords: Record<string, number[]>, side: 'l' | 'r' = 'r') => {
  const h = coords[`hip_${side}`];
  const k = coords[`knee_${side}`];
  const a = coords[`ankle_${side}`];
  if (h && k && a) return calculateAngle(h, k, a);
  return 180;
};

export const getHipAngle = (coords: Record<string, number[]>, side: 'l' | 'r' = 'r') => {
  const s = coords[`shoulder_${side}`];
  const h = coords[`hip_${side}`];
  const k = coords[`knee_${side}`];
  if (s && h && k) return calculateAngle(s, h, k);
  return 180;
};

export const getTorsoAngle = (coords: Record<string, number[]>) => {
  const s = coords.shoulder_r;
  const h = coords.hip_r;
  if (s && h) {
    const dy = Math.abs(s[1] - h[1]);
    const dx = Math.abs(s[0] - h[0]);
    return dy > 0 ? Math.round((Math.atan2(dx, dy) * 180) / Math.PI) : 0;
  }
  return 0;
};

export const getSquatDepthPercent = (kneeAngle: number) => {
  const depth = Math.max(0, Math.min(100, Math.round(((180 - kneeAngle) / 90) * 100)));
  return depth;
};

export const getSquatDepthLabel = (kneeAngle: number) => {
  if (kneeAngle <= 95) return 'Below Parallel';
  if (kneeAngle <= 110) return 'Parallel';
  if (kneeAngle <= 140) return 'Partial Depth';
  return 'Standing';
};

export const getBalanceSplit = (kneeL: number, kneeR: number) => {
  const total = kneeL + kneeR || 1;
  const leftPct = Math.round((kneeL / total) * 100);
  return { left: leftPct, right: 100 - leftPct };
};

export interface RepPhaseMetrics {
  eccentricMs: number;
  concentricMs: number;
  tutMs: number;
  repCount: number;
  avgDepthPercent: number;
  minKneeAngle: number;
  peakTorsoLean: number;
  avgSymmetry: number;
}

export const analyzeSquatSession = (frames: MotionFrame[]): RepPhaseMetrics => {
  if (frames.length === 0) {
    return {
      eccentricMs: 0,
      concentricMs: 0,
      tutMs: 0,
      repCount: 0,
      avgDepthPercent: 0,
      minKneeAngle: 180,
      peakTorsoLean: 0,
      avgSymmetry: 100
    };
  }

  let state: 'standing' | 'descending' | 'bottom' | 'ascending' = 'standing';
  let minKnee = 180;
  let repCount = 0;
  let eccentricMs = 0;
  let concentricMs = 0;
  let phaseStart = frames[0].timestamp_millis;
  let depthSum = 0;
  let depthCount = 0;
  let globalMinKnee = 180;
  let peakTorso = 0;
  let symmetrySum = 0;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const c = f.joint_coordinates;
    const kl = getKneeAngle(c, 'l');
    const kr = getKneeAngle(c, 'r');
    const kneeAvg = (kl + kr) / 2;
    const torso = getTorsoAngle(c);

    peakTorso = Math.max(peakTorso, torso);
    symmetrySum += Math.max(0, 100 - Math.abs(kl - kr) * 3);
    if (kneeAvg < 160) {
      depthSum += getSquatDepthPercent(kneeAvg);
      depthCount += 1;
    }
    if (kneeAvg < globalMinKnee) globalMinKnee = kneeAvg;

    const elapsed = f.timestamp_millis - phaseStart;

    if (state === 'standing') {
      if (kneeAvg < 160) {
        state = 'descending';
        minKnee = kneeAvg;
        phaseStart = f.timestamp_millis;
      }
    } else if (state === 'descending') {
      if (kneeAvg < minKnee) minKnee = kneeAvg;
      if (kneeAvg <= 110) {
        eccentricMs += elapsed;
        state = 'bottom';
        phaseStart = f.timestamp_millis;
      }
    } else if (state === 'bottom') {
      if (kneeAvg < minKnee) minKnee = kneeAvg;
      if (kneeAvg > minKnee + 10) {
        state = 'ascending';
        phaseStart = f.timestamp_millis;
      }
    } else if (state === 'ascending') {
      if (kneeAvg >= 165) {
        concentricMs += elapsed;
        state = 'standing';
        repCount += 1;
        phaseStart = f.timestamp_millis;
        minKnee = 180;
      }
    }
  }

  return {
    eccentricMs,
    concentricMs,
    tutMs: eccentricMs + concentricMs,
    repCount,
    avgDepthPercent: depthCount > 0 ? Math.round(depthSum / depthCount) : 0,
    minKneeAngle: Math.round(globalMinKnee),
    peakTorsoLean: peakTorso,
    avgSymmetry: Math.round(symmetrySum / frames.length)
  };
};

export const formatMs = (ms: number) => {
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const mins = Math.floor(sec / 60);
  const secs = Math.round(sec % 60);
  return `${mins}m ${secs}s`;
};

export const getCurrentRepTUT = (
  frames: MotionFrame[],
  frameIdx: number,
  exerciseName: string
): { tutMs: number; phase: string; eccentricMs: number; concentricMs: number } => {
  if (frames.length === 0 || !exerciseName.toLowerCase().includes('squat')) {
    return { tutMs: 0, phase: 'Idle', eccentricMs: 0, concentricMs: 0 };
  }

  let state: 'standing' | 'descending' | 'bottom' | 'ascending' = 'standing';
  let minKnee = 180;
  let repStart = 0;
  let eccentricMs = 0;
  let concentricMs = 0;
  let phaseStart = frames[0].timestamp_millis;
  let currentPhase = 'Standing';

  for (let i = 0; i <= frameIdx; i++) {
    const f = frames[i];
    const c = f.joint_coordinates;
    const kl = getKneeAngle(c, 'l');
    const kr = getKneeAngle(c, 'r');
    const kneeAvg = (kl + kr) / 2;
    const elapsed = f.timestamp_millis - phaseStart;

    if (state === 'standing') {
      currentPhase = 'Standing';
      if (kneeAvg < 160) {
        state = 'descending';
        minKnee = kneeAvg;
        repStart = f.timestamp_millis;
        phaseStart = f.timestamp_millis;
        currentPhase = 'Eccentric';
      }
    } else if (state === 'descending') {
      currentPhase = 'Eccentric';
      if (kneeAvg < minKnee) minKnee = kneeAvg;
      if (kneeAvg <= 110) {
        eccentricMs += elapsed;
        state = 'bottom';
        phaseStart = f.timestamp_millis;
        currentPhase = 'Bottom Hold';
      }
    } else if (state === 'bottom') {
      currentPhase = 'Bottom Hold';
      if (kneeAvg < minKnee) minKnee = kneeAvg;
      if (kneeAvg > minKnee + 10) {
        state = 'ascending';
        phaseStart = f.timestamp_millis;
        currentPhase = 'Concentric';
      }
    } else if (state === 'ascending') {
      currentPhase = 'Concentric';
      if (kneeAvg >= 165) {
        concentricMs += elapsed;
        state = 'standing';
        phaseStart = f.timestamp_millis;
        currentPhase = 'Standing';
        eccentricMs = 0;
        concentricMs = 0;
        repStart = f.timestamp_millis;
      }
    }
  }

  const tutMs = frameIdx >= 0 ? frames[frameIdx].timestamp_millis - repStart : 0;
  return { tutMs: Math.max(0, tutMs), phase: currentPhase, eccentricMs, concentricMs };
};

export interface SessionInsight {
  label: string;
  value: string;
  detail: string;
  status: 'good' | 'warn' | 'bad';
}

export const generateSessionInsights = (
  frames: MotionFrame[],
  exerciseName: string,
  errorCount: number
): SessionInsight[] => {
  const insights: SessionInsight[] = [];
  const isSquat = exerciseName.toLowerCase().includes('squat');

  if (isSquat && frames.length > 0) {
    const analysis = analyzeSquatSession(frames);
    const tempoRatio = analysis.concentricMs > 0
      ? (analysis.eccentricMs / analysis.concentricMs).toFixed(1)
      : '—';

    insights.push({
      label: 'Tempo Ratio (Ecc:Con)',
      value: `${tempoRatio}:1`,
      detail: analysis.eccentricMs > analysis.concentricMs
        ? 'Controlled descent — good for muscle engagement'
        : 'Fast descent detected — consider slowing the eccentric phase',
      status: analysis.eccentricMs >= analysis.concentricMs ? 'good' : 'warn'
    });

    insights.push({
      label: 'Deepest Squat Depth',
      value: `${analysis.minKneeAngle}°`,
      detail: getSquatDepthLabel(analysis.minKneeAngle),
      status: analysis.minKneeAngle <= 110 ? 'good' : analysis.minKneeAngle <= 130 ? 'warn' : 'bad'
    });

    insights.push({
      label: 'Avg Depth Consistency',
      value: `${analysis.avgDepthPercent}%`,
      detail: analysis.avgDepthPercent >= 70
        ? 'Consistent depth across reps'
        : 'Depth varies — focus on hitting the same bottom position',
      status: analysis.avgDepthPercent >= 65 ? 'good' : 'warn'
    });

    insights.push({
      label: 'Peak Torso Lean',
      value: `${analysis.peakTorsoLean}°`,
      detail: analysis.peakTorsoLean <= 30
        ? 'Torso stays upright throughout'
        : 'Excessive forward lean — brace core and keep chest up',
      status: analysis.peakTorsoLean <= 30 ? 'good' : analysis.peakTorsoLean <= 40 ? 'warn' : 'bad'
    });

    insights.push({
      label: 'Bilateral Symmetry',
      value: `${analysis.avgSymmetry}%`,
      detail: analysis.avgSymmetry >= 90
        ? 'Left/right movement is well balanced'
        : 'Asymmetric loading detected — check weight distribution',
      status: analysis.avgSymmetry >= 88 ? 'good' : 'warn'
    });

    insights.push({
      label: 'Time Under Tension',
      value: formatMs(analysis.tutMs),
      detail: `Eccentric ${formatMs(analysis.eccentricMs)} · Concentric ${formatMs(analysis.concentricMs)}`,
      status: analysis.tutMs >= 8000 ? 'good' : 'warn'
    });
  }

  insights.push({
    label: 'Form Corrections',
    value: `${errorCount}`,
    detail: errorCount === 0
      ? 'No form deviations detected'
      : `${errorCount} alert${errorCount === 1 ? '' : 's'} flagged during session`,
    status: errorCount === 0 ? 'good' : errorCount <= 3 ? 'warn' : 'bad'
  });

  return insights;
};
