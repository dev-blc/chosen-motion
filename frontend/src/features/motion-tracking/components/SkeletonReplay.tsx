import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { calculateJointAngle } from '../utils/poseProcessor';

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  // Determine active joint based on exercise name
  const getActiveJointDetails = () => {
    const name = exerciseName.toLowerCase();
    if (name.includes('shoulder')) {
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
      // Mirror coords horizontally if necessary, but typical coordinates are normalized 0-1
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

    // Draw bones
    // Torso (Slate)
    drawBone('shoulder_l', 'shoulder_r', 'rgba(203,213,225,0.9)', 4.5);
    drawBone('shoulder_l', 'hip_l', 'rgba(203,213,225,0.9)', 4.5);
    drawBone('shoulder_r', 'hip_r', 'rgba(203,213,225,0.9)', 4.5);
    drawBone('hip_l', 'hip_r', 'rgba(203,213,225,0.9)', 4.5);

    // Left Arm (Cyan)
    const isShoulderActive = activeJoint.type === 'Shoulder';
    const isElbowActive = activeJoint.type === 'Elbow';
    const isKneeActive = activeJoint.type === 'Knee';

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
    // Torso joints
    drawJoint('shoulder_l', '#22d3ee', 6, isShoulderActive);
    drawJoint('shoulder_r', '#a78bfa', 6, isShoulderActive);
    drawJoint('hip_l', '#34d399', 6);
    drawJoint('hip_r', '#fb7185', 6);

    // Limbs joints
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

  const angles = {
    shoulder_l: getAngle('shoulder', 'l'),
    shoulder_r: getAngle('shoulder', 'r'),
    elbow_l: getAngle('elbow', 'l'),
    elbow_r: getAngle('elbow', 'r'),
    knee_l: getAngle('knee', 'l'),
    knee_r: getAngle('knee', 'r'),
  };

  const formattedTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(2);
    return `${minutes.toString().padStart(2, '0')}:${seconds.padStart(5, '0')}`;
  };

  return (
    <div className="relative flex flex-col items-center w-full rounded-2xl bg-slate-950 p-4 border border-slate-850 shadow-2xl overflow-hidden">
      
      {/* Title & Speed HUD overlay */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-1 pointer-events-none">
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
          className="w-full h-full object-contain"
        />
        
        {/* Joint angles sidebar HUD */}
        <div className="absolute bottom-4 left-4 bg-slate-950/85 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-left flex flex-col gap-1.5 font-mono text-xs w-48 text-slate-300">
          <div className="text-[10px] text-slate-500 font-bold uppercase mb-0.5 tracking-wider">Live Joint Angles</div>
          <div className="flex justify-between items-center">
            <span>L Shoulder:</span>
            <span className="text-cyan-400 font-bold">{angles.shoulder_l}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>R Shoulder:</span>
            <span className="text-violet-400 font-bold">{angles.shoulder_r}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>L Elbow:</span>
            <span className="text-cyan-400 font-bold">{angles.elbow_l}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>R Elbow:</span>
            <span className="text-violet-400 font-bold">{angles.elbow_r}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>L Knee:</span>
            <span className="text-emerald-400 font-bold">{angles.knee_l}°</span>
          </div>
          <div className="flex justify-between items-center">
            <span>R Knee:</span>
            <span className="text-rose-400 font-bold">{angles.knee_r}°</span>
          </div>
        </div>

        {/* Selected joint telemetry HUD */}
        <div className="absolute bottom-4 right-4 bg-slate-950/85 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-right flex flex-col gap-1 font-mono text-xs text-slate-300">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Target Joint Angle</div>
          <div className="text-base font-extrabold text-white">
            {activeJoint.label}:
          </div>
          <div className="text-xl font-black text-cyan-400">
            {angles[activeJoint.keyR as keyof typeof angles] || 0}°
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
    </div>
  );
};
