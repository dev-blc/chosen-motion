import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadMotionSession, startSquatSession, submitSquatFrame, endSquatSession } from '@/services/api';
import MotionTracking from './MotionTracking';
import SkeletonMiniViewer from './SkeletonMiniViewer';
import { PoseBuffer, calculateAngle } from '../utils/poseProcessor';
import { ThumbsUpDetector } from '../utils/thumbsUpDetector';
import { 
  ArrowLeft, 
  Activity, 
  Square,
  RefreshCw,
  AlertCircle,
  ThumbsUp
} from 'lucide-react';

const TrackerSkeleton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const exerciseName = location.state?.exerciseName || 'Shoulder Abduction';
  
  const [active, setActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [gestureStatus, setGestureStatus] = useState<'waiting' | 'holding' | 'countdown' | 'active'>('waiting');
  const [gestureHoldProgress, setGestureHoldProgress] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
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
    torso: 0,
  });
  const [liveStatus, setLiveStatus] = useState<'success' | 'warning' | 'idle'>('idle');
  
  const squatSessionIdRef = useRef<number | null>(null);
  const frameCounterRef = useRef<number>(0);

  
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
  const speedsArray = useRef<number[]>([]);

  const timerRef = useRef<any>(null);
  const telemetryTimerRef = useRef<any>(null);
  const startTimeRef = useRef<number>(0);
  const poseBuffer = useRef<PoseBuffer>(new PoseBuffer());
  const lastLandmarks = useRef<any>(null);
  const repState = useRef<'flexed' | 'extended'>('extended');
  const prevRepsRef = useRef(0);
  const thumbsUpDetector = useRef<ThumbsUpDetector>(new ThumbsUpDetector());
  const gestureLockedRef = useRef(false);
  const countdownActiveRef = useRef(false);
  const handleStopRef = useRef<() => Promise<void>>(async () => {});
  const handleStartRef = useRef<() => Promise<void>>(async () => {});
  const activeRef = useRef(false);

  const speak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Auto-enable camera calibration on page load
  useEffect(() => {
    setCameraReady(true);
  }, []);

  useEffect(() => {
    activeRef.current = active;
    if (!countdownActiveRef.current) {
      setGestureStatus(active ? 'active' : 'waiting');
    }
  }, [active]);

  // 3-2-1 countdown after thumbs-up detected
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      countdownActiveRef.current = false;
      gestureLockedRef.current = false;
      thumbsUpDetector.current.reset();
      speak('Go!');
      handleStartRef.current();
      return;
    }

    speak(String(countdown));
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Announce rep count via browser text-to-speech
  useEffect(() => {
    if (!active || reps <= prevRepsRef.current) {
      prevRepsRef.current = reps;
      return;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(String(reps));
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
    prevRepsRef.current = reps;
  }, [reps, active]);

  // calculateJointAngle is imported from poseProcessor.ts

  // Real-time landmarks coordinates feedback handler
  const handlePoseDetected = (landmarks: any) => {
    if (!landmarks || landmarks.length === 0) return;
    lastLandmarks.current = landmarks;

    // Thumbs-up gesture for workout start (with countdown) / stop
    if (!gestureLockedRef.current && !saving) {
      const thumbsResult = thumbsUpDetector.current.detect(landmarks);
      setGestureHoldProgress(thumbsResult.holdProgress);

      if (thumbsResult.holding && !thumbsResult.detected) {
        setGestureStatus(countdownActiveRef.current ? 'countdown' : (activeRef.current ? 'active' : 'holding'));
      } else if (!thumbsResult.holding && !countdownActiveRef.current) {
        setGestureStatus(activeRef.current ? 'active' : 'waiting');
        setGestureHoldProgress(0);
      }

      if (thumbsResult.detected) {
        if (activeRef.current) {
          gestureLockedRef.current = true;
          thumbsUpDetector.current.reset();
          speak('Workout stopped');
          handleStopRef.current();
          setTimeout(() => { gestureLockedRef.current = false; }, 3000);
        } else if (!countdownActiveRef.current) {
          countdownActiveRef.current = true;
          gestureLockedRef.current = true;
          thumbsUpDetector.current.disarm();
          setGestureStatus('countdown');
          setCountdown(3);
        }
      }
    }
    
    // Calculate all 8 live angles (4 joints * 2 sides) + torso angle
    const angles = {
      shoulder_l: calculateAngle('shoulder', landmarks, 'left'),
      shoulder_r: calculateAngle('shoulder', landmarks, 'right'),
      elbow_l: calculateAngle('elbow', landmarks, 'left'),
      elbow_r: calculateAngle('elbow', landmarks, 'right'),
      hip_l: calculateAngle('hip', landmarks, 'left'),
      hip_r: calculateAngle('hip', landmarks, 'right'),
      knee_l: calculateAngle('knee', landmarks, 'left'),
      knee_r: calculateAngle('knee', landmarks, 'right'),
      torso: 0
    };
    
    const s_r = landmarks[12];
    const h_r = landmarks[24];
    if (s_r && h_r) {
      const dy = Math.abs(s_r.y - h_r.y);
      const dx = Math.abs(s_r.x - h_r.x);
      angles.torso = dy > 0 ? Math.round((Math.atan2(dx, dy) * 180) / Math.PI) : 0;
    }
    
    setLiveAngles(angles);

    let calculatedRom = 0;
    
    // Check which exercise is selected to track the corresponding joint vector
    if (exerciseName.toLowerCase().includes('squat')) {
      calculatedRom = Math.round((angles.knee_l + angles.knee_r) / 2);
    } else if (exerciseName.toLowerCase().includes('shoulder')) {
      calculatedRom = angles.shoulder_r;
      
      if (activeRef.current) {
        // Rep counting: flexion (lifted > 95 deg), extension (lowered < 40 deg)
        if (calculatedRom > 95 && repState.current === 'extended') {
          repState.current = 'flexed';
        } else if (calculatedRom < 40 && repState.current === 'flexed') {
          repState.current = 'extended';
          setReps(r => r + 1);
        }
      }
    } else if (exerciseName.toLowerCase().includes('knee') || exerciseName.toLowerCase().includes('lunge')) {
      calculatedRom = Math.round((angles.knee_l + angles.knee_r) / 2);
      
      if (activeRef.current) {
        // Rep counting for knee/lunge: extension (> 150 deg), flexion (< 100 deg)
        if (calculatedRom > 150 && repState.current === 'flexed') {
          repState.current = 'extended';
          setReps(r => r + 1);
        } else if (calculatedRom < 100 && repState.current === 'extended') {
          repState.current = 'flexed';
        }
      }
    } else if (exerciseName.toLowerCase().includes('hip')) {
      calculatedRom = Math.round((angles.hip_l + angles.hip_r) / 2);
    } else {
      // Default: Elbow Flexion
      calculatedRom = angles.elbow_r;
      
      if (activeRef.current) {
        // Rep counting: flexion (fully bent < 55 deg), extension (straightened > 130 deg)
        if (calculatedRom < 55 && repState.current === 'extended') {
          repState.current = 'flexed';
        } else if (calculatedRom > 130 && repState.current === 'flexed') {
          repState.current = 'extended';
          setReps(r => r + 1);
        }
      }
    }

    setRom(calculatedRom);

    const confidence = landmarks.reduce((acc: number, l: any) => acc + (l.visibility || 0), 0) / landmarks.length;
    setScore(Math.round(confidence * 100));

    // Skip coaching analysis when workout is not active
    if (!activeRef.current) {
      return;
    }

    // Skip client-side coaching for Squats since backend handles it
    if (exerciseName.toLowerCase().includes('squat')) {
      return;
    }

    // 1. Calculate live velocity (speed in deg/sec)
    const now = performance.now();
    let speedDegPerSec = 0;
    if (lastRomTime.current > 0) {
      const timeDiffSec = (now - lastRomTime.current) / 1000;
      if (timeDiffSec > 0.03) {
        const romDiff = Math.abs(calculatedRom - lastRomVal.current);
        const rawSpeed = romDiff / timeDiffSec;
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
      romPassed = calculatedRom >= targetROM;
      romMessage = romPassed ? 'Target ROM met' : 'Raise arm higher';
      alignmentPassed = angles.elbow_r >= 145;
      alignmentMessage = alignmentPassed ? 'Elbow straight' : 'Straighten elbow';
    } 
    else if (exerciseName.toLowerCase().includes('knee')) {
      romPassed = calculatedRom >= targetROM;
      romMessage = romPassed ? 'Leg straight' : 'Raise leg higher';
      alignmentPassed = angles.hip_r <= 125;
      alignmentMessage = alignmentPassed ? 'Torso aligned' : 'Keep back straight';
    } 
    else {
      romPassed = calculatedRom <= targetROM;
      romMessage = romPassed ? 'Full contraction met' : 'Curl arm higher';
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

    if (active) {
      speedsArray.current.push(speedDegPerSec);
    }

    // 3. Evaluate rules live
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
  };

  // Duration timer simulation loop
  useEffect(() => {
    if (active) {
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [active]);

  // Telemetry frame capture loop (5 fps / every 200ms)
  useEffect(() => {
    if (active) {
      startTimeRef.current = Date.now();
      telemetryTimerRef.current = setInterval(async () => {
        if (lastLandmarks.current) {
          const elapsed = Date.now() - startTimeRef.current;
          poseBuffer.current.pushFrame(elapsed, lastLandmarks.current);
          
          // Submit frame to Squat Engine if active
          if (exerciseName.toLowerCase().includes('squat') && squatSessionIdRef.current !== null) {
            const frames = poseBuffer.current.getFrames();
            const lastFrame = frames[frames.length - 1];
            if (lastFrame && lastFrame.joint_coordinates) {
              try {
                const feedback = await submitSquatFrame({
                  session_id: squatSessionIdRef.current,
                  frame_number: frameCounterRef.current,
                  timestamp_ms: elapsed,
                  joint_coordinates: lastFrame.joint_coordinates as Record<string, number[]>
                });
                frameCounterRef.current += 1;
                
                // Update live feedback from backend SquatEngine
                setReps(feedback.reps);
                setLiveStatus(feedback.status === 'success' ? 'success' : 'warning');
                
                // Map errors/posture warning codes to feedback elements
                let alignPassed = true;
                let alignMsg = "Good posture";
                let speedPassed = true;
                let speedMsg = "Controlled pace";
                let romPassed = true;
                let romMsg = "Good depth";
                
                if (feedback.feedback === "Good Depth") {
                  romMsg = "Good Depth!";
                } else if (feedback.feedback === "Go Lower") {
                  romPassed = false;
                  romMsg = "Go Lower";
                }
                
                if (feedback.current_error) {
                  const errType = feedback.current_error.type;
                  if (errType === "Knees Caving In") {
                    alignPassed = false;
                    alignMsg = "Push Your Knees Out";
                  } else if (errType === "Torso Lean") {
                    alignPassed = false;
                    alignMsg = "Keep Your Back Straight";
                  } else if (errType === "Uneven Weight Distribution") {
                    alignPassed = false;
                    alignMsg = "Maintain Balance";
                  } else if (errType === "Fast Descent" || errType === "Fast Ascent") {
                    speedPassed = false;
                    speedMsg = "Slow Down";
                  }
                }
                
                setFeedbackStatus({
                  allPassed: alignPassed && speedPassed && romPassed,
                  rom: { passed: romPassed, message: romMsg },
                  alignment: { passed: alignPassed, message: alignMsg },
                  speed: { passed: speedPassed, message: speedMsg }
                });
                
              } catch (err) {
                console.warn("Failed to stream frame coordinates to SquatEngine", err);
              }
            }
          }
        }
      }, 200);
    } else {
      if (telemetryTimerRef.current) {
        clearInterval(telemetryTimerRef.current);
      }
    }

    return () => {
      if (telemetryTimerRef.current) clearInterval(telemetryTimerRef.current);
    };
  }, [active]);

  const handleStart = async () => {
    setActive(true);
    poseBuffer.current.clear();
    speedsArray.current = [];
    setReps(0);
    setRom(0);
    setLiveStatus('idle');
    frameCounterRef.current = 0;
    squatSessionIdRef.current = null;
    prevRepsRef.current = 0;
    repState.current = 'extended';
    thumbsUpDetector.current.reset();
    gestureLockedRef.current = false;
    countdownActiveRef.current = false;
    setCountdown(null);
    setGestureStatus('active');
    setGestureHoldProgress(0);

    if (exerciseName.toLowerCase().includes('squat')) {
      try {
        const res = await startSquatSession();
        squatSessionIdRef.current = res.session_id;
        console.log("Initialized Squat session with ID:", res.session_id);
      } catch (err) {
        console.error("Failed to start Squat session:", err);
      }
    }
  };
  handleStartRef.current = handleStart;

  const handleStop = async () => {
    setActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (telemetryTimerRef.current) clearInterval(telemetryTimerRef.current);

    const frames = poseBuffer.current.getFrames();
    if (frames.length === 0) return;

    setSaving(true);
    
    // For Squat exercise, complete session via custom end endpoint
    if (exerciseName.toLowerCase().includes('squat') && squatSessionIdRef.current !== null) {
      try {
        await endSquatSession(squatSessionIdRef.current);

        alert('Squat tracking session finalized successfully!');
        navigate('/patient');
      } catch (err) {
        console.error('Failed to end Squat tracking session:', err);
        alert('Failed to finalize Squat session. Redirected to patient dashboard.');
        navigate('/patient');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      const stats = poseBuffer.current.getStats();
      const avgSpeed = speedsArray.current.length > 0
        ? Math.round(speedsArray.current.reduce((a, b) => a + b, 0) / speedsArray.current.length)
        : 0;
      
      await uploadMotionSession({
        title: `${exerciseName} - ${new Date().toLocaleDateString()}`,
        description: `Active camera session tracking joint movements for ${exerciseName}.`,
        duration_seconds: duration,
        avg_score: stats.avgConfidence,
        range_of_motion: rom,
        speed: avgSpeed,
        symmetry: 1.0,
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
  handleStopRef.current = handleStop;

  const handleReset = () => {
    setActive(false);
    setDuration(0);
    setReps(0);
    setScore(95);
    setRom(0);
    setLiveStatus('idle');
    poseBuffer.current.clear();
    speedsArray.current = [];
    lastLandmarks.current = null;
    frameCounterRef.current = 0;
    squatSessionIdRef.current = null;
    prevRepsRef.current = 0;
    repState.current = 'extended';
    thumbsUpDetector.current.reset();
    gestureLockedRef.current = false;
    countdownActiveRef.current = false;
    setCountdown(null);
    setGestureStatus('waiting');
    setGestureHoldProgress(0);
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
            cameraEnabled={cameraReady}
            mirror={mirror}
            onPoseDetected={handlePoseDetected}
            onCameraReady={setCameraReady}
          />

          {/* Thumbs-up gesture instruction overlay */}
          {cameraReady && !saving && countdown === null && (
            <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-20 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-premium flex items-center gap-3 transition-all duration-300 ${
              gestureStatus === 'holding'
                ? 'bg-accent-500/20 border-accent-400/50 text-accent-300'
                : active
                  ? 'bg-red-950/60 border-red-500/30 text-red-300'
                  : 'bg-primary-950/60 border-primary-500/30 text-primary-300'
            }`}>
              <ThumbsUp className={`h-5 w-5 ${gestureStatus === 'holding' ? 'animate-bounce' : ''}`} />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold uppercase tracking-wider">
                  {active
                    ? 'Hold thumbs up to stop workout'
                    : gestureStatus === 'holding'
                      ? 'Hold steady...'
                      : 'Hold thumbs up to start'}
                </span>
                {gestureStatus === 'holding' && !active && (
                  <div className="h-1 w-32 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-400 transition-all duration-75"
                      style={{ width: `${Math.round(gestureHoldProgress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3-2-1 countdown overlay */}
          {countdown !== null && countdown > 0 && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary-400">Get ready</span>
                <span className="font-display font-bold text-8xl text-white animate-pulse drop-shadow-lg">
                  {countdown}
                </span>
              </div>
            </div>
          )}

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

          {/* Mini skeleton viewer overlay */}
          <div className="absolute bottom-6 left-6 z-30">
            <SkeletonMiniViewer
              landmarksRef={lastLandmarks}
              active={active}
              mirror={mirror}
            />
          </div>

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
            
            {active && (
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
                      {rom > 0 ? `${rom}°` : (cameraReady ? 'Calibrating...' : 'Waiting...')}
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
                    exerciseName.toLowerCase().includes('hip') || exerciseName.toLowerCase().includes('lunge')
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
                    exerciseName.toLowerCase().includes('knee') || exerciseName.toLowerCase().includes('squat') || exerciseName.toLowerCase().includes('lunge')
                      ? 'bg-primary-950/20 border-primary-500/50' 
                      : 'bg-slate-950/40 border-slate-850/60'
                  }`}>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Knee</span>
                    <span className="font-mono text-sm font-bold text-slate-200">
                      {liveAngles.knee_l}° <span className="text-slate-600">/</span> {liveAngles.knee_r}°
                    </span>
                  </div>

                  {/* Torso (Squat Only) */}
                  {exerciseName.toLowerCase().includes('squat') && (
                    <div className="p-2 rounded-xl border transition-all bg-primary-950/20 border-primary-500/50 col-span-2 text-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold block mb-0.5">Torso Angle</span>
                      <span className="font-mono text-sm font-bold text-slate-200">
                        {liveAngles.torso}°
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850">
                <span className="text-xs text-slate-400 block font-medium uppercase tracking-wider">Alignment Confidence</span>
                <span className="font-display font-bold text-3xl mt-1 block text-yellow-500">
                  {rom > 0 ? `${score}%` : (cameraReady ? 'Calibrating...' : 'Waiting...')}
                </span>
              </div>
            </div>
          </div>

          {/* Safety instructions */}
          <div className="p-3.5 bg-indigo-950/20 border border-indigo-900/30 text-indigo-300 rounded-xl text-[10px] leading-relaxed flex gap-2.5 items-start">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 text-indigo-400" />
            <p>
              {exerciseName.toLowerCase().includes('squat')
                ? "Stand sideways to the camera for best accuracy. Hold a thumbs up to start — you'll get a 3-2-1 countdown. Thumbs up again to stop."
                : "Camera calibrates automatically. Hold a thumbs up to start (3-2-1 countdown), then thumbs up again to stop. Keep your full body visible. Rest immediately if you feel pain."
              }
            </p>
          </div>

        </div>

      </div>
    </div>
  );
};

export default TrackerSkeleton;
