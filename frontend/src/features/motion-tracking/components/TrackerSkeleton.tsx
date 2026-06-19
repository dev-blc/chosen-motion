import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadMotionSession } from '@/services/api';
import MotionTracking from './MotionTracking';
import { PoseBuffer, calculateAngle } from '../utils/poseProcessor';
import { 
  ArrowLeft, 
  Activity, 
  Play, 
  Square,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const TrackerSkeleton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const exerciseName = location.state?.exerciseName || 'Shoulder Abduction';
  
  const [active, setActive] = useState(false);
  const [_cameraReady, setCameraReady] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [duration, setDuration] = useState(0);
  const [reps, setReps] = useState(0);
  const [score, setScore] = useState(95);
  const [rom, setRom] = useState(0); // Range of Motion in degrees
  const [saving, setSaving] = useState(false);
  const [liveAngles, setLiveAngles] = useState({
    shoulder_l: 0,
    shoulder_r: 0,
    elbow_l: 0,
    elbow_r: 0,
    hip_l: 0,
    hip_r: 0,
    knee_l: 0,
    knee_r: 0,
  });
  const [liveStatus, setLiveStatus] = useState<'success' | 'warning' | 'idle'>('idle');
  
  // Rules setup (use passed rules or construct fallback default rules)
  const rules = location.state?.rules || [
    {
      rule_name: `${exerciseName} Target ROM`,
      rule_type: "threshold_comparison",
      parameters: {
        joint: exerciseName.toLowerCase().includes('shoulder') ? 'shoulder' : (exerciseName.toLowerCase().includes('knee') ? 'knee' : 'elbow'),
        side: 'right',
        parameter: 'angle',
        operator: exerciseName.toLowerCase().includes('elbow') ? '<=' : '>=',
        value: exerciseName.toLowerCase().includes('shoulder') 
          ? (exerciseName.toLowerCase().includes('raise') ? 150 : 120)
          : (exerciseName.toLowerCase().includes('knee') ? 140 : 55)
      },
      status_on_success: "success",
      status_on_fail: "warning"
    }
  ];
  
  const [feedbackStatus, setFeedbackStatus] = useState({
    allPassed: false,
    rom: { passed: false, message: 'Calibrating ROM...' },
    alignment: { passed: false, message: 'Calibrating alignment...' },
    speed: { passed: false, message: 'Calibrating speed...' }
  });

  const lastRomVal = useRef<number>(0);
  const lastRomTime = useRef<number>(0);
  const lastSpeedVal = useRef<number>(0);

  const timerRef = useRef<any>(null);
  const poseBuffer = useRef<PoseBuffer>(new PoseBuffer());
  const lastLandmarks = useRef<any>(null);
  const repState = useRef<'flexed' | 'extended'>('extended');

  // calculateJointAngle is imported from poseProcessor.ts

  // Real-time landmarks coordinates feedback handler
  const handlePoseDetected = (landmarks: any) => {
    if (!landmarks || landmarks.length === 0) return;
    lastLandmarks.current = landmarks;
    
    // Calculate all 8 live angles (4 joints * 2 sides)
    const angles = {
      shoulder_l: calculateAngle('shoulder', landmarks, 'left'),
      shoulder_r: calculateAngle('shoulder', landmarks, 'right'),
      elbow_l: calculateAngle('elbow', landmarks, 'left'),
      elbow_r: calculateAngle('elbow', landmarks, 'right'),
      hip_l: calculateAngle('hip', landmarks, 'left'),
      hip_r: calculateAngle('hip', landmarks, 'right'),
      knee_l: calculateAngle('knee', landmarks, 'left'),
      knee_r: calculateAngle('knee', landmarks, 'right'),
    };
    setLiveAngles(angles);

    let calculatedRom = 0;
    
    // Check which exercise is selected to track the corresponding joint vector
    if (exerciseName.toLowerCase().includes('shoulder')) {
      calculatedRom = angles.shoulder_r;
      
      // Rep counting: flexion (lifted > 95 deg), extension (lowered < 40 deg)
      if (calculatedRom > 95 && repState.current === 'extended') {
        repState.current = 'flexed';
      } else if (calculatedRom < 40 && repState.current === 'flexed') {
        repState.current = 'extended';
        setReps(r => r + 1);
      }
    } else if (exerciseName.toLowerCase().includes('knee')) {
      calculatedRom = angles.knee_r;
      
      // Rep counting: extension (straightened > 140 deg), flexion (bent < 90 deg)
      if (calculatedRom > 140 && repState.current === 'flexed') {
        repState.current = 'extended';
        setReps(r => r + 1);
      } else if (calculatedRom < 90 && repState.current === 'extended') {
        repState.current = 'flexed';
      }
    } else {
      // Default: Elbow Flexion
      calculatedRom = angles.elbow_r;
      
      // Rep counting: flexion (fully bent < 55 deg), extension (straightened > 130 deg)
      if (calculatedRom < 55 && repState.current === 'extended') {
        repState.current = 'flexed';
      } else if (calculatedRom > 130 && repState.current === 'flexed') {
        repState.current = 'extended';
        setReps(r => r + 1);
      }
    }

    setRom(calculatedRom);

    // 1. Calculate live velocity (speed in deg/sec)
    const now = performance.now();
    let speedDegPerSec = 0;
    if (lastRomTime.current > 0) {
      const timeDiffSec = (now - lastRomTime.current) / 1000;
      if (timeDiffSec > 0.03) { // limit updates to >30ms intervals to prevent noise
        const romDiff = Math.abs(calculatedRom - lastRomVal.current);
        const rawSpeed = romDiff / timeDiffSec;
        
        // Apply exponential moving average to smooth out high frequency tracking noise
        speedDegPerSec = Math.round(lastSpeedVal.current * 0.7 + rawSpeed * 0.3);
        lastSpeedVal.current = speedDegPerSec;
        
        lastRomVal.current = calculatedRom;
        lastRomTime.current = now;
      } else {
        speedDegPerSec = lastSpeedVal.current;
      }
    } else {
      lastRomVal.current = calculatedRom;
      lastRomTime.current = now;
      lastSpeedVal.current = 0;
    }

    // 2. Perform Form Coaching analysis
    let romPassed = false;
    let romMessage = 'Raise arm higher';
    let alignmentPassed = false;
    let alignmentMessage = 'Straighten elbow';
    let speedPassed = speedDegPerSec <= 60;
    let speedMessage = speedPassed ? 'Controlled pace' : 'Slow down movement';

    const targetROM = (rules && rules[0] && rules[0].parameters && rules[0].parameters.value) || 120;

    if (exerciseName.toLowerCase().includes('shoulder')) {
      // ROM Check (Shoulder Abduction / Raise target)
      romPassed = calculatedRom >= targetROM;
      romMessage = romPassed ? 'Target ROM met' : 'Raise arm higher';
      
      // Alignment Check (Shoulder Abduction requires straight arm)
      alignmentPassed = angles.elbow_r >= 145;
      alignmentMessage = alignmentPassed ? 'Elbow straight' : 'Straighten elbow';
    } 
    else if (exerciseName.toLowerCase().includes('knee')) {
      // ROM Check (Knee Extension target)
      romPassed = calculatedRom >= targetROM;
      romMessage = romPassed ? 'Leg straight' : 'Raise leg higher';
      
      // Alignment Check (Knee Extension: sits straight, hip angle <= 125)
      alignmentPassed = angles.hip_r <= 125;
      alignmentMessage = alignmentPassed ? 'Torso aligned' : 'Keep back straight';
    } 
    else {
      // Default / Elbow Flexion:
      // ROM Check (flexion fully bent means angle <= target)
      romPassed = calculatedRom <= targetROM;
      romMessage = romPassed ? 'Full contraction met' : 'Curl arm higher';
      
      // Alignment Check (Elbow Flexion: keep shoulder stable, shoulder-hip angle <= 35)
      alignmentPassed = angles.shoulder_r <= 35;
      alignmentMessage = alignmentPassed ? 'Shoulder steady' : 'Keep shoulder steady';
    }

    const allFeedbackPassed = romPassed && alignmentPassed && speedPassed;
    setFeedbackStatus({
      allPassed: allFeedbackPassed,
      rom: { passed: romPassed, message: romMessage },
      alignment: { passed: alignmentPassed, message: alignmentMessage },
      speed: { passed: speedPassed, message: speedMessage }
    });

    // 3. Evaluate rules live against calculatedRom (overall ROM check)
    let currentStatus: 'success' | 'warning' | 'idle' = 'idle';
    if (calculatedRom > 0 && rules && rules.length > 0) {
      let allRulesPassed = true;
      rules.forEach((rule: any) => {
        if (rule.rule_type === 'threshold_comparison') {
          const params = rule.parameters || {};
          const operator = params.operator || '>=';
          const val = params.value || 0;
          
          let passed = false;
          if (operator === '>=') {
            passed = calculatedRom >= val;
          } else if (operator === '<=') {
            passed = calculatedRom <= val;
          } else if (operator === '>') {
            passed = calculatedRom > val;
          } else if (operator === '<') {
            passed = calculatedRom < val;
          } else if (operator === '==') {
            passed = calculatedRom === val;
          }
          
          if (!passed) {
            allRulesPassed = false;
          }
        }
      });
      currentStatus = allRulesPassed ? 'success' : 'warning';
    }
    setLiveStatus(currentStatus);

    // Calculate dynamic form score based on landmark track confidence
    const confidence = landmarks.reduce((acc: number, l: any) => acc + (l.visibility || 0), 0) / landmarks.length;
    setScore(Math.round(confidence * 100));
  };

  // Duration timer simulation loop
  useEffect(() => {
    if (active) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);

        // Record telemetry frame using PoseBuffer
        if (lastLandmarks.current) {
          poseBuffer.current.pushFrame(Date.now(), lastLandmarks.current);
        }

      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active, duration]);

  const handleStart = () => {
    setActive(true);
    poseBuffer.current.clear();
    setReps(0);
    setRom(0);
    setLiveStatus('idle');
  };

  const handleStop = async () => {
    setActive(false);
    const frames = poseBuffer.current.getFrames();
    if (frames.length === 0) return;

    setSaving(true);
    try {
      const stats = poseBuffer.current.getStats();
      await uploadMotionSession({
        title: `${exerciseName} - ${new Date().toLocaleDateString()}`,
        description: `Active camera session tracking joint movements for ${exerciseName}.`,
        duration_seconds: duration,
        avg_score: stats.avgConfidence,
        range_of_motion: rom,
        status: liveStatus,
        metrics_summary: {
          repetitions: reps,
          final_score: score,
          max_rom: rom
        },
        telemetry_data: frames
      });
      alert('Tracking session telemetry synced successfully!');
      navigate('/patient');
    } catch (err) {
      console.error('Failed to sync session coordinates streams', err);
      alert('Failed to upload telemetry to database. Redirected to companion.');
      navigate('/patient');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setActive(false);
    setDuration(0);
    setReps(0);
    setScore(95);
    setRom(0);
    setLiveStatus('idle');
    poseBuffer.current.clear();
    lastLandmarks.current = null;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top Navbar Header */}
      <header className="px-6 py-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/patient')}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="font-display font-semibold text-base block">Active Motion Analysis</span>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Exercise: {exerciseName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-semibold">
          <Activity className="h-3.5 w-3.5 animate-pulse" />
          <span>Skeletal Capture Engine</span>
        </div>
      </header>

      {/* Grid Container */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
        
        {/* Camera Tracking Component */}
        <div className="lg:col-span-3 relative flex flex-col rounded-3xl overflow-hidden min-h-[400px]">
          <MotionTracking
            isActive={active}
            mirror={mirror}
            onPoseDetected={handlePoseDetected}
            onCameraReady={setCameraReady}
          />

          {/* Real-time coaching feedback overlay */}
          {active && rom > 0 && (
            <div className="absolute top-6 left-6 z-20 max-w-xs bg-slate-950/90 border border-slate-800 rounded-2xl p-4 backdrop-blur-md shadow-premium space-y-3">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${feedbackStatus.allPassed ? 'bg-green-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-slate-300">Live Coaching Cues</span>
              </div>
              
              <div className="space-y-2 text-2xs">
                {/* ROM Indicator */}
                <div className="flex items-center justify-between gap-6 p-2 rounded-xl bg-slate-900/40 border border-slate-850/60">
                  <div className="flex items-center gap-2">
                    <span className={`h-4.5 w-4.5 rounded-lg flex items-center justify-center font-bold text-xs ${
                      feedbackStatus.rom.passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {feedbackStatus.rom.passed ? '✓' : '✗'}
                    </span>
                    <span className={`font-semibold ${feedbackStatus.rom.passed ? 'text-green-400/90' : 'text-red-400/90'}`}>
                      {feedbackStatus.rom.message}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">{rom}°</span>
                </div>

                {/* Alignment Indicator */}
                <div className="flex items-center justify-between gap-6 p-2 rounded-xl bg-slate-900/40 border border-slate-850/60">
                  <div className="flex items-center gap-2">
                    <span className={`h-4.5 w-4.5 rounded-lg flex items-center justify-center font-bold text-xs ${
                      feedbackStatus.alignment.passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {feedbackStatus.alignment.passed ? '✓' : '✗'}
                    </span>
                    <span className={`font-semibold ${feedbackStatus.alignment.passed ? 'text-green-400/90' : 'text-red-400/90'}`}>
                      {feedbackStatus.alignment.message}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">
                    {exerciseName.toLowerCase().includes('shoulder') 
                      ? `${liveAngles.elbow_r}°` 
                      : (exerciseName.toLowerCase().includes('knee') ? `${liveAngles.hip_r}°` : `${liveAngles.shoulder_r}°`)
                    }
                  </span>
                </div>

                {/* Speed Indicator */}
                <div className="flex items-center justify-between gap-6 p-2 rounded-xl bg-slate-900/40 border border-slate-850/60">
                  <div className="flex items-center gap-2">
                    <span className={`h-4.5 w-4.5 rounded-lg flex items-center justify-center font-bold text-xs ${
                      feedbackStatus.speed.passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {feedbackStatus.speed.passed ? '✓' : '✗'}
                    </span>
                    <span className={`font-semibold ${feedbackStatus.speed.passed ? 'text-green-400/90' : 'text-red-400/90'}`}>
                      {feedbackStatus.speed.message}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px]">controlled</span>
                </div>
              </div>
            </div>
          )}

          {/* Overlaid UI action controls */}
          <div className="absolute bottom-6 right-6 z-20 flex items-center gap-3">
            <button
              onClick={() => setMirror(!mirror)}
              className={`px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-150 ${
                mirror 
                  ? 'bg-primary-600 border-primary-500 text-white shadow-premium' 
                  : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white backdrop-blur-sm'
              }`}
              title="Mirror Mode Toggle"
            >
              Toggle Mirror
            </button>
            
            {!active ? (
              <button 
                onClick={handleStart}
                className="btn-accent py-2.5 px-5 shadow-lg hover:shadow-accent-500/10 text-xs font-bold"
              >
                <Play className="h-4 w-4 fill-current" /> Initialize Calibration
              </button>
            ) : (
              <button 
                onClick={handleStop}
                disabled={saving}
                className="py-2.5 px-5 bg-red-650 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg"
              >
                <Square className="h-4 w-4 fill-current" /> {saving ? 'Syncing...' : 'Complete Workout'}
              </button>
            )}
            
            <button 
              onClick={handleReset}
              className="p-3 bg-slate-950/80 hover:bg-slate-850 text-slate-350 hover:text-white rounded-xl border border-slate-800 transition-colors backdrop-blur-sm"
              title="Reset Calibration"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Live Metrics Sidebar Panel */}
        <div className="bg-slate-950 rounded-3xl border border-slate-800 p-6 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            <h3 className="font-display font-semibold text-lg text-slate-100 flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary-500" /> Live Data
            </h3>

            {/* Metrics */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Duration</span>
                <span className="font-display font-bold text-3xl mt-1 block">
                  {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
                </span>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Reps Count</span>
                <span className="font-display font-bold text-3xl mt-1 block text-accent-500">{reps}</span>
              </div>

              <div className={`p-4 rounded-2xl border transition-all duration-200 ${
                rom > 0 && liveStatus === 'success' 
                  ? 'bg-green-950/20 border-green-500/30' 
                  : (rom > 0 && liveStatus === 'warning' 
                      ? 'bg-yellow-950/10 border-yellow-500/20' 
                      : 'bg-slate-900 border-slate-850')
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Flexion Range (ROM)</span>
                    <span className="font-display font-bold text-3xl mt-1 block text-primary-400">
                      {rom > 0 ? `${rom}°` : 'Calibrating...'}
                    </span>
                  </div>
                  {rom > 0 && liveStatus !== 'idle' && (
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      liveStatus === 'success' 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                        : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                    }`}>
                      {liveStatus === 'success' ? 'Success' : 'Warning'}
                    </span>
                  )}
                </div>
                {rom > 0 && rules && rules[0] && (
                  <div className="mt-2.5 pt-2 border-t border-slate-850/40 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Target: {rules[0].parameters.value}°</span>
                    <span className={`font-semibold ${liveStatus === 'success' ? 'text-green-400' : 'text-yellow-500'}`}>
                      {liveStatus === 'success' ? 'Target Met!' : 'Keep extending'}
                    </span>
                  </div>
                )}
              </div>

              {/* Joint Angles Live Metrics Grid */}
              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850 space-y-3">
                <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Joint Angles (L / R)</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* Shoulder */}
                  <div className={`p-2 rounded-xl border transition-all ${
                    exerciseName.toLowerCase().includes('shoulder') 
                      ? 'bg-primary-950/20 border-primary-500/50' 
                      : 'bg-slate-950/40 border-slate-850/60'
                  }`}>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Shoulder</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {liveAngles.shoulder_l}° <span className="text-slate-600">/</span> {liveAngles.shoulder_r}°
                    </span>
                  </div>

                  {/* Elbow */}
                  <div className={`p-2 rounded-xl border transition-all ${
                    exerciseName.toLowerCase().includes('elbow') || (!exerciseName.toLowerCase().includes('shoulder') && !exerciseName.toLowerCase().includes('knee') && !exerciseName.toLowerCase().includes('hip'))
                      ? 'bg-primary-950/20 border-primary-500/50' 
                      : 'bg-slate-950/40 border-slate-850/60'
                  }`}>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Elbow</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {liveAngles.elbow_l}° <span className="text-slate-600">/</span> {liveAngles.elbow_r}°
                    </span>
                  </div>

                  {/* Hip */}
                  <div className={`p-2 rounded-xl border transition-all ${
                    exerciseName.toLowerCase().includes('hip') 
                      ? 'bg-primary-950/20 border-primary-500/50' 
                      : 'bg-slate-950/40 border-slate-850/60'
                  }`}>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Hip</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {liveAngles.hip_l}° <span className="text-slate-600">/</span> {liveAngles.hip_r}°
                    </span>
                  </div>

                  {/* Knee */}
                  <div className={`p-2 rounded-xl border transition-all ${
                    exerciseName.toLowerCase().includes('knee') 
                      ? 'bg-primary-950/20 border-primary-500/50' 
                      : 'bg-slate-950/40 border-slate-850/60'
                  }`}>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Knee</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {liveAngles.knee_l}° <span className="text-slate-600">/</span> {liveAngles.knee_r}°
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Alignment Confidence</span>
                <span className="font-display font-bold text-3xl mt-1 block text-yellow-500">
                  {rom > 0 ? `${score}%` : 'Calibrating...'}
                </span>
              </div>
            </div>
          </div>

          {/* Safety instructions */}
          <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 text-indigo-300 rounded-xl text-[10px] leading-relaxed flex gap-2.5 items-start">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-indigo-400" />
            <p>Ensure your target joint limb is fully visible in the camera view window. Rest immediately if you feel pain.</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default TrackerSkeleton;
