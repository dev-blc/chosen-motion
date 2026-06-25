import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { calculateJointAngle } from '../utils/poseProcessor';
import {
  getSquatDepthPercent,
  getSquatDepthLabel,
  getBalanceSplit,
  getCurrentRepTUT,
  formatMs
} from '../utils/sessionMetrics';

interface MotionFrame {
  id: string;
  session_id: number;
  frame_number: number;
  timestamp_millis: number;
  joint_coordinates: Record<string, number[]>;
  sensor_signals?: any;
}

interface SkeletonReplayProps {
  frames: MotionFrame[];
  exerciseName?: string;
}

export const SkeletonReplay: React.FC<SkeletonReplayProps> = ({ frames, exerciseName = 'Exercise' }) => {
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x
  const [repsAtFrame, setRepsAtFrame] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Precompute repetition counts per frame for instant timeline feedback
  useEffect(() => {
    if (frames.length === 0) return;
    const repsList: number[] = [];
    let count = 0;
    let state = 'standing';
    let minKnee = 180;

    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      const c = f.joint_coordinates;
      
      const pxAngle = (a: number[], b: number[], cPoint: number[]) => {
        if (!a || !b || !cPoint) return 180;
        const baX = a[0] - b[0];
        const baY = a[1] - b[1];
        const bcX = cPoint[0] - b[0];
        const bcY = cPoint[1] - b[1];
        const dot = baX * bcX + baY * bcY;
        const magBA = Math.sqrt(baX * baX + baY * baY);
        const magBC = Math.sqrt(bcX * bcX + bcY * bcY);
        if (magBA === 0 || magBC === 0) return 180;
        const cos = dot / (magBA * magBC);
        return Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
      };

      const kl = c.knee_l ? pxAngle(c.hip_l, c.knee_l, c.ankle_l) : 180;
      const kr = c.knee_r ? pxAngle(c.hip_r, c.knee_r, c.ankle_r) : 180;
      const kneeAvg = (kl + kr) / 2;

      if (exerciseName.toLowerCase().includes('squat')) {
        if (state === 'standing') {
          if (kneeAvg < 160) {
            state = 'descending';
            minKnee = kneeAvg;
          }
        } else if (state === 'descending') {
          if (kneeAvg < minKnee) minKnee = kneeAvg;
          if (kneeAvg <= 110) {
            state = 'bottom';
          }
        } else if (state === 'bottom') {
          if (kneeAvg < minKnee) minKnee = kneeAvg;
          if (kneeAvg > minKnee + 10) {
            state = 'ascending';
          }
        } else if (state === 'ascending') {
          if (kneeAvg >= 165) {
            state = 'standing';
            count += 1;
          }
        }
      } else {
        const isShoulder = exerciseName.toLowerCase().includes('shoulder');
        const isKnee = exerciseName.toLowerCase().includes('knee');
        const val = isShoulder 
          ? (c.shoulder_r ? pxAngle(c.hip_r, c.shoulder_r, c.elbow_r) : 0)
          : isKnee 
            ? (c.knee_r ? pxAngle(c.hip_r, c.knee_r, c.ankle_r) : 0)
            : (c.elbow_r ? pxAngle(c.shoulder_r, c.elbow_r, c.wrist_r) : 0);

        if (isShoulder) {
          if (val > 95 && state === 'extended') {
            state = 'flexed';
          } else if (val < 40 && state === 'flexed') {
            state = 'extended';
            count += 1;
          }
        } else if (isKnee) {
          if (val > 140 && state === 'flexed') {
            state = 'extended';
            count += 1;
          } else if (val < 90 && state === 'extended') {
            state = 'flexed';
          }
        } else {
          if (val < 55 && state === 'extended') {
            state = 'flexed';
          } else if (val > 130 && state === 'flexed') {
            state = 'extended';
            count += 1;
          }
        }
      }
      repsList.push(count);
    }
    setRepsAtFrame(repsList);
  }, [frames, exerciseName]);

  // Determine active joint based on exercise name
  const getActiveJointDetails = () => {
    const name = exerciseName.toLowerCase();
    if (name.includes('squat')) {
      return { type: 'Squat', keyL: 'knee_l', keyR: 'knee_r', label: 'Knee Flexion (Squat)' };
    } else if (name.includes('shoulder')) {
      return { type: 'Shoulder', keyL: 'shoulder_l', keyR: 'shoulder_r', label: 'Shoulder Flexion' };
    } else if (name.includes('knee')) {
      return { type: 'Knee', keyL: 'knee_l', keyR: 'knee_r', label: 'Knee Extension' };
    } else {
      return { type: 'Elbow', keyL: 'elbow_l', keyR: 'elbow_r', label: 'Elbow Flexion' };
    }
  };

  const activeJoint = getActiveJointDetails();

  // Draw the current frame on the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || frames.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const frame = frames[currentFrameIdx];
    if (!frame) return;

    const W = canvas.width;
    const H = canvas.height;
    const coords = frame.joint_coordinates;

    const px = (jointName: string) => {
      const pt = coords[jointName];
      return pt ? { x: pt[0] * W, y: pt[1] * H } : null;
    };

    const drawBone = (nameA: string, nameB: string, color: string, width = 3.5) => {
      const ptA = px(nameA);
      const ptB = px(nameB);
      if (!ptA || !ptB) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.moveTo(ptA.x, ptA.y);
      ctx.lineTo(ptB.x, ptB.y);
      ctx.stroke();
    };

    const drawJoint = (name: string, color: string, radius = 5, highlight = false) => {
      const pt = px(name);
      if (!pt) return;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, highlight ? radius * 1.5 : radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = highlight ? '#ffffff' : 'rgba(255,255,255,0.85)';
      ctx.lineWidth = highlight ? 2.5 : 1.5;
      ctx.stroke();

      if (highlight) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius * 2.5, 0, 2 * Math.PI);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    };

    // Draw head circle
    const sL = px('shoulder_l');
    const sR = px('shoulder_r');
    if (sL && sR) {
      const headX = (sL.x + sR.x) / 2;
      const headY = (sL.y + sR.y) / 2 - Math.abs(sL.x - sR.x) * 0.45;
      ctx.beginPath();
      ctx.arc(headX, headY, Math.abs(sL.x - sR.x) * 0.25, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(203,213,225,0.9)';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Draw bones
    // Torso (Slate)
    drawBone('shoulder_l', 'shoulder_r', 'rgba(203,213,225,0.9)', 4.5);
    drawBone('shoulder_l', 'hip_l', 'rgba(203,213,225,0.9)', 4.5);
    drawBone('shoulder_r', 'hip_r', 'rgba(203,213,225,0.9)', 4.5);
    drawBone('hip_l', 'hip_r', 'rgba(203,213,225,0.9)', 4.5);

    const isShoulderActive = activeJoint.type === 'Shoulder';
    const isElbowActive = activeJoint.type === 'Elbow';
    const isKneeActive = activeJoint.type === 'Knee' || activeJoint.type === 'Squat';

    // Left Arm (Cyan)
    drawBone('shoulder_l', 'elbow_l', '#22d3ee', 4);
    drawBone('elbow_l', 'wrist_l', '#22d3ee', 3.5);

    // Right Arm (Violet)
    drawBone('shoulder_r', 'elbow_r', '#a78bfa', 4);
    drawBone('elbow_r', 'wrist_r', '#a78bfa', 3.5);

    // Left Leg (Emerald)
    drawBone('hip_l', 'knee_l', '#34d399', 4);
    drawBone('knee_l', 'ankle_l', '#34d399', 3.5);

    // Right Leg (Rose)
    drawBone('hip_r', 'knee_r', '#fb7185', 4);
    drawBone('knee_r', 'ankle_r', '#fb7185', 3.5);

    // Draw joints
    drawJoint('shoulder_l', '#22d3ee', 6, isShoulderActive);
    drawJoint('shoulder_r', '#a78bfa', 6, isShoulderActive);
    drawJoint('hip_l', '#34d399', 6);
    drawJoint('hip_r', '#fb7185', 6);

    drawJoint('elbow_l', '#22d3ee', 5, isElbowActive);
    drawJoint('elbow_r', '#a78bfa', 5, isElbowActive);
    drawJoint('wrist_l', '#22d3ee', 4);
    drawJoint('wrist_r', '#a78bfa', 4);
    
    drawJoint('knee_l', '#34d399', 5, isKneeActive);
    drawJoint('knee_r', '#fb7185', 5, isKneeActive);
    drawJoint('ankle_l', '#34d399', 4);
    drawJoint('ankle_r', '#fb7185', 4);

  }, [currentFrameIdx, frames, exerciseName]);

  // Handle playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    lastTimeRef.current = performance.now();

    const playLoop = (time: number) => {
      const elapsed = time - lastTimeRef.current;
      const currentFrame = frames[currentFrameIdx];
      const nextFrameIdx = currentFrameIdx + 1;

      if (nextFrameIdx >= frames.length) {
        setIsPlaying(false);
        setCurrentFrameIdx(0);
        return;
      }

      const nextFrame = frames[nextFrameIdx];
      const frameDelta = (nextFrame.timestamp_millis - currentFrame.timestamp_millis) / playbackSpeed;

      if (elapsed >= frameDelta) {
        setCurrentFrameIdx(nextFrameIdx);
        lastTimeRef.current = time;
      }

      animationRef.current = requestAnimationFrame(playLoop);
    };

    animationRef.current = requestAnimationFrame(playLoop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, currentFrameIdx, frames, playbackSpeed]);

  if (frames.length === 0) {
    return (
      <div className="flex h-96 w-full items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400">
        No skeleton frames recorded for this session.
      </div>
    );
  }

  const currentFrame = frames[currentFrameIdx];
  const coords = currentFrame.joint_coordinates;

  // Calculate live joint angles for display
  const getAngle = (joint: 'shoulder' | 'elbow' | 'hip' | 'knee', side: 'l' | 'r') => {
    const s = coords[`shoulder_${side}`];
    const e = coords[`elbow_${side}`];
    const w = coords[`wrist_${side}`];
    const h = coords[`hip_${side}`];
    const k = coords[`knee_${side}`];
    const a = coords[`ankle_${side}`];

    if (joint === 'shoulder' && h && s && e) return calculateJointAngle(h, s, e);
    if (joint === 'elbow' && s && e && w) return calculateJointAngle(s, e, w);
    if (joint === 'hip' && s && h && k) return calculateJointAngle(s, h, k);
    if (joint === 'knee' && h && k && a) return calculateJointAngle(h, k, a);
    return 0;
  };

  const getTorsoAngle = () => {
    const s_r = coords.shoulder_r;
    const h_r = coords.hip_r;
    if (s_r && h_r) {
      const dy = Math.abs(s_r[1] - h_r[1]);
      const dx = Math.abs(s_r[0] - h_r[0]);
      return dy > 0 ? Math.round((Math.atan2(dx, dy) * 180) / Math.PI) : 0;
    }
    return 0;
  };

  const angles = {
    shoulder_l: getAngle('shoulder', 'l'),
    shoulder_r: getAngle('shoulder', 'r'),
    elbow_l: getAngle('elbow', 'l'),
    elbow_r: getAngle('elbow', 'r'),
    knee_l: getAngle('knee', 'l'),
    knee_r: getAngle('knee', 'r'),
    hip_l: getAngle('hip', 'l'),
    hip_r: getAngle('hip', 'r'),
    torso: getTorsoAngle()
  };

  // Speed calculation for current frame (degrees / sec)
  const getCurrentSpeed = () => {
    if (currentFrameIdx === 0) return 0;
    const prevFrame = frames[currentFrameIdx - 1];
    const dt = (currentFrame.timestamp_millis - prevFrame.timestamp_millis) / 1000;
    if (dt <= 0) return 0;
    const curK = (angles.knee_l + angles.knee_r) / 2;
    const prevC = prevFrame.joint_coordinates;
    const prevK = prevC.knee_l ? (calculateJointAngle(prevC.hip_l, prevC.knee_l, prevC.ankle_l) + calculateJointAngle(prevC.hip_r, prevC.knee_r, prevC.ankle_r)) / 2 : 180;
    return Math.round(Math.abs(curK - prevK) / dt);
  };

  const getSymmetry = () => {
    const diff = Math.abs(angles.knee_l - angles.knee_r);
    return Math.max(10, Math.min(100, Math.round(100 - diff * 3)));
  };

  const getActiveErrors = () => {
    const errorsList: string[] = [];
    if (coords.knee_l && coords.knee_r && coords.ankle_l && coords.ankle_r) {
      const knee_dist = Math.abs(coords.knee_l[0] - coords.knee_r[0]);
      const ankle_dist = Math.abs(coords.ankle_l[0] - coords.ankle_r[0]);
      if (ankle_dist > 0 && (knee_dist / ankle_dist) < 0.82) {
        errorsList.push("Knees Caving In");
      }
    }
    if (angles.torso > 35) {
      errorsList.push("Torso Lean");
    }
    if (Math.abs(angles.knee_l - angles.knee_r) > 15) {
      errorsList.push("Uneven Weight Distribution");
    }
    return errorsList;
  };

  const activeErrors = getActiveErrors();
  const accuracy = currentFrame.sensor_signals?.confidence 
    ? Math.round(currentFrame.sensor_signals.confidence * 100) 
    : 95;

  const isSquat = exerciseName.toLowerCase().includes('squat');
  const kneeAvg = Math.round((angles.knee_l + angles.knee_r) / 2);
  const hipAvg = Math.round((angles.hip_l + angles.hip_r) / 2);
  const depthPercent = getSquatDepthPercent(kneeAvg);
  const depthLabel = getSquatDepthLabel(kneeAvg);
  const balance = getBalanceSplit(angles.knee_l, angles.knee_r);
  const repTut = getCurrentRepTUT(frames, currentFrameIdx, exerciseName);

  const telemetryCards = [
    { label: 'Current Frame', value: `#${currentFrameIdx + 1}`, color: 'text-white' },
    { label: 'Current Rep', value: `${repsAtFrame[currentFrameIdx] ?? 0}`, color: 'text-cyan-400' },
    { label: 'Knee / Hip', value: `${kneeAvg}° / ${hipAvg}°`, color: 'text-emerald-400' },
    { label: 'Torso Lean', value: `${angles.torso}°`, color: 'text-orange-400' },
    { label: 'Symmetry', value: `${getSymmetry()}%`, color: 'text-violet-400' },
    { label: 'Accuracy', value: `${accuracy}%`, color: 'text-white' },
    { label: 'Speed', value: `${getCurrentSpeed()} °/s`, color: 'text-cyan-400' },
    ...(isSquat ? [
      { label: 'Squat Depth', value: `${depthPercent}%`, color: depthPercent >= 70 ? 'text-emerald-400' : 'text-amber-400' },
      { label: 'Depth Status', value: depthLabel, color: depthLabel === 'Below Parallel' || depthLabel === 'Parallel' ? 'text-emerald-400' : 'text-amber-400' },
      { label: 'Time Under Tension', value: formatMs(repTut.tutMs), color: 'text-violet-400' },
      { label: 'Movement Phase', value: repTut.phase, color: repTut.phase === 'Eccentric' ? 'text-amber-400' : repTut.phase === 'Concentric' ? 'text-cyan-400' : 'text-slate-300' },
      { label: 'Balance L / R', value: `${balance.left}% / ${balance.right}%`, color: Math.abs(balance.left - balance.right) <= 8 ? 'text-emerald-400' : 'text-rose-400' },
    ] : []),
  ];

  const formattedTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);
    return `${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
  };

  return (
    <div className="relative flex flex-col items-center w-full rounded-2xl bg-slate-950 p-4 border border-slate-850 shadow-2xl overflow-hidden">
      
      {/* Title & Speed HUD overlay */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-1 pointer-events-none text-left">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Telemetry Replay</span>
        <h3 className="text-lg font-bold text-white tracking-tight">{exerciseName}</h3>
      </div>

      <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
        <div className="bg-slate-900/80 backdrop-blur px-3 py-1 rounded-lg border border-slate-800 text-xs font-mono text-cyan-400">
          {formattedTime(currentFrame.timestamp_millis)} / {formattedTime(frames[frames.length - 1].timestamp_millis)}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative w-full aspect-[4/3] max-w-2xl bg-slate-900 rounded-xl overflow-hidden border border-slate-800/60 shadow-inner flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          className="w-full h-full object-contain animate-fade-in"
        />
        
        {/* Joint angles sidebar HUD */}
        <div className="absolute bottom-4 left-4 bg-slate-950/85 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-left flex flex-col gap-1.5 font-mono text-xs w-48 text-slate-300">
          <div className="text-[10px] text-slate-500 font-bold uppercase mb-0.5 tracking-wider">Live Joint Angles</div>
          <div className="flex justify-between items-center">
            <span>Torso Lean:</span>
            <span className="text-orange-400 font-bold">{angles.torso}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>L Hip / R Hip:</span>
            <span className="text-cyan-400 font-bold">{angles.hip_l}° / {angles.hip_r}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>L Knee / R Knee:</span>
            <span className="text-emerald-400 font-bold">{angles.knee_l}° / {angles.knee_r}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>L Elbow / R Elbow:</span>
            <span className="text-violet-400 font-bold">{angles.elbow_l}° / {angles.elbow_r}°</span>
          </div>
        </div>

        {/* Selected joint telemetry HUD */}
        <div className="absolute bottom-4 right-4 bg-slate-950/85 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-right flex flex-col gap-1 font-mono text-xs text-slate-300">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Active Metric</div>
          <div className="text-xs font-bold text-white leading-tight">
            {activeJoint.label}:
          </div>
          <div className="text-lg font-black text-cyan-400">
            {activeJoint.type === 'Squat' 
              ? `${Math.round((angles.knee_l + angles.knee_r)/2)}°`
              : `${angles[activeJoint.keyR as keyof typeof angles] || 0}°`
            }
          </div>
        </div>
      </div>

      {/* Control Deck */}
      <div className="w-full max-w-2xl mt-4 flex flex-col gap-3">
        {/* Timeline Slider */}
        <div className="flex items-center gap-3 w-full">
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentFrameIdx}
            onChange={(e) => {
              setCurrentFrameIdx(parseInt(e.target.value));
              if (isPlaying) setIsPlaying(false);
            }}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500 focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="flex items-center justify-center p-3 rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all shadow-lg hover:shadow-cyan-500/20 active:scale-95"
            >
              {isPlaying ? <Pause className="h-5 w-5 fill-slate-950" /> : <Play className="h-5 w-5 fill-slate-950" />}
            </button>
            
            <button
              onClick={() => {
                setIsPlaying(false);
                setCurrentFrameIdx(0);
              }}
              className="flex items-center justify-center p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white transition-all active:scale-95"
              title="Restart"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
          </div>

          <div className="text-xs font-mono text-slate-500">
            Frame {currentFrameIdx + 1} of {frames.length}
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1">
            {([0.5, 1, 2] as number[]).map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  playbackSpeed === speed
                    ? 'bg-slate-800 text-cyan-400 border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* REPLAY DISPLAY PANEL */}
      <div className="w-full max-w-2xl mt-5 p-5 rounded-xl bg-slate-900 border border-slate-800/80 text-left">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Replay Telemetry Deck</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs font-mono">
          {telemetryCards.map((card) => (
            <div key={card.label} className="p-3.5 bg-slate-950 rounded-xl border border-slate-850 min-h-[72px] flex flex-col justify-between">
              <span className="text-[10px] text-slate-500 leading-tight">{card.label}</span>
              <span className={`font-bold mt-1.5 ${card.color}`}>{card.value}</span>
            </div>
          ))}

          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-850 col-span-2 sm:col-span-3 lg:col-span-4 min-h-[72px] flex flex-col justify-between">
            <span className="text-[10px] text-slate-500">Active Form Alerts</span>
            <span className={`font-bold mt-1.5 ${activeErrors.length > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {activeErrors.length > 0 ? activeErrors.join(' · ') : 'None — excellent posture'}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

