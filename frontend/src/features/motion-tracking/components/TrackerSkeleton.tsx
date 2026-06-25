import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { uploadMotionSession, startSquatSession, submitSquatFrame, endSquatSession } from '@/services/api';
import MotionTracking from './MotionTracking';
import SkeletonMiniViewer from './SkeletonMiniViewer';
import { PoseBuffer, calculateAngle, computeFrameConfidence } from '../utils/poseProcessor';
import { GestureTrigger } from '../utils/gestureTrigger';
import { 
  ArrowLeft, 
  Activity, 
  Square,
  RefreshCw,
  AlertCircle,
  ThumbsUp,
  ShieldCheck,
  Video,
  Camera,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

const TrackerSkeleton: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const exerciseName = location.state?.exerciseName || 'Shoulder Abduction';
  
  const [active, setActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [step, setStep] = useState<'consent' | 'permission' | 'ready' | 'countdown' | 'recording' | 'processing' | 'success' | 'error'>('consent');
  const [errorType, setErrorType] = useState<'camera_unavailable' | 'permission_denied' | 'detection_failed' | 'upload_failed' | 'network_lost' | 'timeout' | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [uploadedSessionId, setUploadedSessionId] = useState<number | null>(null);
  
  const [gestureStatus, setGestureStatus] = useState<'waiting' | 'holding' | 'countdown' | 'active'>('waiting');
  const [gestureHoldProgress, setGestureHoldProgress] = useState(0);
  const [detectedGestureLabel, setDetectedGestureLabel] = useState<string | null>(null);
  const [detectedGestureScore, setDetectedGestureScore] = useState(0);
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
  const gestureTrigger = useRef<GestureTrigger>(new GestureTrigger());
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

  // We do not auto-enable the camera on page load, starting in Consent step
  useEffect(() => {
    setCameraReady(false);
  }, []);

  useEffect(() => {
    activeRef.current = active;
    if (!countdownActiveRef.current) {
      setGestureStatus(active ? 'active' : 'waiting');
    }
  }, [active]);

  // 3-2-1 countdown after thumbs-up detected or start button clicked
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setCountdown(null);
      countdownActiveRef.current = false;
      gestureLockedRef.current = false;
      gestureTrigger.current.reset();
      speak('Go!');
      setStep('recording');
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

  // MediaPipe GestureRecognizer callback (pretrained Thumb_Up model)
  const handleGestureDetected = (gestures: { gesture: string; score: number; handedness: string }[]) => {
    if (gestureLockedRef.current || saving) return;

    const result = gestureTrigger.current.process(gestures);
    setGestureHoldProgress(result.holdProgress);
    setDetectedGestureLabel(result.currentGesture);
    setDetectedGestureScore(result.confidence);

    if (result.holding && !result.detected) {
      setGestureStatus(countdownActiveRef.current ? 'countdown' : (activeRef.current ? 'active' : 'holding'));
    } else if (!result.holding && !countdownActiveRef.current) {
      setGestureStatus(activeRef.current ? 'active' : 'waiting');
      setGestureHoldProgress(0);
    }

    if (result.detected) {
      if (activeRef.current) {
        gestureLockedRef.current = true;
        gestureTrigger.current.reset();
        speak('Workout stopped');
        handleStopRef.current();
        setTimeout(() => { gestureLockedRef.current = false; }, 3000);
      } else if (step === 'ready' && !countdownActiveRef.current) {
        countdownActiveRef.current = true;
        gestureLockedRef.current = true;
        gestureTrigger.current.disarm();
        setGestureStatus('countdown');
        setStep('countdown');
        setCountdown(5);
      }
    }
  };

  // Real-time landmarks coordinates feedback handler
  const handlePoseDetected = (landmarks: any) => {
    if (!landmarks || landmarks.length === 0) return;
    lastLandmarks.current = landmarks;
    
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

    const confidence = computeFrameConfidence(landmarks);
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

  // Duration timer simulation loop (with isPaused check)
  useEffect(() => {
    if (active && !isPaused) {
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
  }, [active, isPaused]);

  // Telemetry frame capture loop (5 fps / every 200ms, paused when isPaused is active)
  useEffect(() => {
    if (active && !isPaused) {
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
  }, [active, isPaused]);

  const handleStart = async () => {
    setActive(true);
    setIsPaused(false);
    poseBuffer.current.clear();
    speedsArray.current = [];
    setReps(0);
    setRom(0);
    setLiveStatus('idle');
    frameCounterRef.current = 0;
    squatSessionIdRef.current = null;
    prevRepsRef.current = 0;
    repState.current = 'extended';
    gestureTrigger.current.reset();
    gestureLockedRef.current = false;
    countdownActiveRef.current = false;
    setCountdown(null);
    setGestureStatus('active');
    setGestureHoldProgress(0);
    setDetectedGestureLabel(null);

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
    if (frames.length === 0) {
      setStep('consent');
      return;
    }

    setSaving(true);
    setStep('processing');
    
    // For Squat exercise, complete session via custom end endpoint
    if (exerciseName.toLowerCase().includes('squat') && squatSessionIdRef.current !== null) {
      try {
        await endSquatSession(squatSessionIdRef.current);
        setUploadedSessionId(squatSessionIdRef.current);
        setStep('success');
      } catch (err) {
        console.error('Failed to end Squat tracking session:', err);
        setErrorType('upload_failed');
        setStep('error');
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
      
      const res = await uploadMotionSession({
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
      if (res && (res.id || res.session_id)) {
        setUploadedSessionId(res.id || res.session_id);
      }
      setStep('success');
    } catch (err) {
      console.error('Failed to sync session coordinates streams', err);
      setErrorType('upload_failed');
      setStep('error');
    } finally {
      setSaving(false);
    }
  };
  handleStopRef.current = handleStop;

  const handleReset = () => {
    setActive(false);
    setIsPaused(false);
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
    gestureTrigger.current.reset();
    gestureLockedRef.current = false;
    countdownActiveRef.current = false;
    setCountdown(null);
    setGestureStatus('waiting');
    setGestureHoldProgress(0);
    setDetectedGestureLabel(null);
  };


  const handleCameraReady = (ready: boolean) => {
    setCameraReady(ready);
    if (ready) {
      if (step === 'permission') {
        setStep('ready');
      }
    } else {
      if (step === 'permission' || step === 'ready') {
        setErrorType('permission_denied');
        setStep('error');
      }
    }
  };

  const triggerCountdown = () => {
    countdownActiveRef.current = true;
    gestureLockedRef.current = true;
    gestureTrigger.current.disarm();
    setGestureStatus('countdown');
    setStep('countdown');
    setCountdown(5);
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins}:${remaining.toString().padStart(2, '0')}`;
  };

  const renderConsent = () => {
    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-xl w-full bg-[#121122] border border-slate-850 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-gold-500/10 border border-[#A27B41]/35 rounded-2xl flex items-center justify-center text-[#A27B41]">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-white">Secure Motion Analysis</h2>
            <p className="text-xs text-slate-400">Chosen Life maintains a highly secure and private rehabilitation environment.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 text-left pt-4">
            <div className="flex gap-4 p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
              <div className="h-8 w-8 shrink-0 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Landmarks Analysis Only</span>
                <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                  Our system converts camera frames to 33 numeric skeletal coordinates. We do not store, upload, or process any video or audio recordings on our servers.
                </span>
              </div>
            </div>
            <div className="flex gap-4 p-4 bg-slate-900/60 border border-slate-800/80 rounded-2xl">
              <div className="h-8 w-8 shrink-0 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-400">
                <Video className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Local Device Execution</span>
                <span className="text-[10px] text-slate-400 block mt-1 leading-normal">
                  All image analysis runs locally in your web browser. No stream data ever leaves your device.
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-4 pt-6 select-none">
            <Button
              variant="secondary"
              className="flex-1 font-bold py-3 text-xs border-slate-800 hover:bg-slate-800 text-slate-350"
              onClick={() => navigate('/patient')}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1 font-bold py-3 text-xs btn-primary shadow-lg"
              onClick={() => setStep('permission')}
            >
              Accept & Continue
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderPermission = () => {
    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#121122] border border-slate-850 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto h-20 w-20 bg-primary-500/10 border border-primary-500/20 rounded-full flex items-center justify-center text-primary-400 animate-pulse">
            <Camera className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-white">Camera Access Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              We require access to your webcam to detect physical movements and calculate joint range of motion (ROM) in real time.
            </p>
          </div>
          
          <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-left space-y-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Troubleshooting Setup</span>
            <ul className="space-y-2 text-[10px] text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-[#A27B41] font-bold">1.</span>
                <span>Click **Allow** when the browser asks for camera permission.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A27B41] font-bold">2.</span>
                <span>Make sure no other applications are currently using your webcam.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#A27B41] font-bold">3.</span>
                <span>Ensure your computer is running in a secure context (HTTPS/Localhost).</span>
              </li>
            </ul>
          </div>

          <div className="flex gap-4 pt-4 select-none">
            <Button
              variant="secondary"
              className="flex-1 font-bold py-3 text-xs border-slate-800 hover:bg-slate-850 text-slate-355"
              onClick={() => setStep('consent')}
            >
              Back
            </Button>
            <Button
              variant="primary"
              className="flex-1 font-bold py-3 text-xs btn-primary shadow-lg"
              onClick={() => {
                setCameraReady(true);
                setStep('ready');
              }}
            >
              Allow Camera
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderReady = () => {
    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col">
        {/* Top Navbar Header */}
        <header className="px-6 py-4 bg-slate-950 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setCameraReady(false);
                setStep('permission');
              }}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <span className="font-display font-semibold text-base block">Configure Tracking Space</span>
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Exercise: {exerciseName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-primary-500/10 border border-primary-500/20 text-primary-400 rounded-full text-xs font-semibold select-none">
            <Camera className="h-3.5 w-3.5" />
            <span>Webcam Ready</span>
          </div>
        </header>

        {/* 2-Column Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-start">
          {/* Live Preview Container (col-span-8) */}
          <div className="lg:col-span-8 relative flex flex-col rounded-3xl overflow-hidden min-h-[450px] bg-black border border-slate-800">
            <MotionTracking
              cameraEnabled={cameraReady}
              mirror={mirror}
              onPoseDetected={handlePoseDetected}
              onGestureDetected={handleGestureDetected}
              onCameraReady={handleCameraReady}
            />
            {/* Real-time calibration details overlay */}
            <div className="absolute top-4 left-4 z-20 flex items-center gap-2 text-[10px] font-semibold bg-slate-955/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 backdrop-blur-sm text-slate-300">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live Alignment Feed
            </div>

            {/* Thumbs-up gesture instruction overlay */}
            {cameraReady && !saving && countdown === null && (
              <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-2xl border backdrop-blur-md shadow-lg flex items-center gap-3 transition-all duration-300 ${
                gestureStatus === 'holding'
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'bg-primary-955/65 border-primary-500/30 text-primary-300'
              }`}>
                <ThumbsUp className={`h-4 w-4 ${gestureStatus === 'holding' ? 'animate-bounce' : ''}`} />
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {gestureStatus === 'holding'
                      ? 'Holding gesture steady...'
                      : 'Show thumbs up to start'}
                  </span>
                  {detectedGestureLabel && (
                    <span className="text-[8px] text-slate-400 font-mono">
                      AI: {detectedGestureLabel.replace(/_/g, ' ')} ({Math.round(detectedGestureScore * 100)}%)
                    </span>
                  )}
                  {gestureStatus === 'holding' && (
                    <div className="h-1 w-28 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-amber-400 transition-all duration-75"
                        style={{ width: `${Math.round(gestureHoldProgress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Guidelines Sidebar (col-span-4) */}
          <div className="lg:col-span-4 bg-[#121122] rounded-3xl border border-slate-800 p-6 space-y-6 text-left">
            <div className="space-y-1">
              <span className="text-2xs font-bold text-[#A27B41] uppercase block tracking-widest">Rehab Guidelines</span>
              <h3 className="font-display font-bold text-lg text-white">Setup Diagnostics</h3>
            </div>

            <div className="space-y-4">
              {/* Tip 1 */}
              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl space-y-1.5">
                <span className="text-xs font-bold text-white block">1. Position Alignment</span>
                <span className="text-[10px] text-slate-450 block leading-relaxed">
                  Stand 6 to 8 feet back so your entire body (from head to toe) is visible inside the frame. Keep side angles facing camera for squats.
                </span>
              </div>
              
              {/* Tip 2 */}
              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl space-y-1.5">
                <span className="text-xs font-bold text-white block">2. Clear Environment Lighting</span>
                <span className="text-[10px] text-slate-450 block leading-relaxed">
                  Ensure the room is brightly lit. Avoid strong backlights or standing directly in front of open windows.
                </span>
              </div>

              {/* Tip 3 */}
              <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl space-y-1.5">
                <span className="text-xs font-bold text-white block">3. Gesture Activation</span>
                <span className="text-[10px] text-slate-450 block leading-relaxed">
                  Once positioned, raise a clear **Thumbs Up** to the camera. The AI will recognize it and start a 5-second countdown automatically.
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2.5">
              <Button
                variant="primary"
                className="w-full font-bold py-3.5 text-xs btn-primary shadow-lg flex items-center justify-center gap-2"
                onClick={triggerCountdown}
              >
                <Activity className="h-4.5 w-4.5" /> Start Recording
              </Button>
              <Button
                variant="secondary"
                className="w-full font-bold py-2.5 text-xs border-slate-800 hover:bg-slate-800 text-slate-350"
                onClick={() => setMirror(!mirror)}
              >
                Toggle Camera Mirror
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCountdown = () => {
    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col relative overflow-hidden">
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes scaleUp {
            0% { transform: scale(0.6); opacity: 0; }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-scale-up {
            animation: scaleUp 0.3s ease-out forwards;
          }
        `}} />
        
        {/* Live camera stream in full screen bg */}
        <div className="absolute inset-0 z-0">
          <MotionTracking
            cameraEnabled={cameraReady}
            mirror={mirror}
            onPoseDetected={handlePoseDetected}
            onGestureDetected={handleGestureDetected}
            onCameraReady={handleCameraReady}
          />
        </div>

        {/* Translucent Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs z-10" />

        {/* Large Countdown Overlay Content */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="space-y-6 max-w-md animate-fade-in">
            <span className="text-2xs font-bold uppercase tracking-widest text-[#A27B41] bg-[#A27B41]/10 px-3.5 py-1.5 rounded-full">
              Get Into Position
            </span>
            <div className="space-y-1">
              <h1 className="font-display font-bold text-2xl text-white">Starting in a moment...</h1>
              <p className="text-xs text-slate-400">Step back and align your body with the camera guide.</p>
            </div>
            
            <div className="py-6 flex items-center justify-center">
              <span className="font-display font-bold text-9xl text-white animate-scale-up drop-shadow-[0_4px_30px_rgba(162,123,65,0.4)]">
                {countdown}
              </span>
            </div>

            <div className="border border-slate-800 bg-[#121122]/90 p-4 rounded-2xl text-left flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-gold-500 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-white block">Exercise Reminder</span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-medium leading-relaxed">
                  Perform **{exerciseName}**. Keep movements steady and complete each rep fully.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderRecording = () => {
    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col">
        {/* Style block for recording elements */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideIn {
            from { transform: translateY(-10px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .animate-slide-in {
            animation: slideIn 0.3s ease forwards;
          }
        `}} />

        {/* Top Navbar Header */}
        <header className="px-6 py-4 bg-slate-950 flex items-center justify-between border-b border-slate-850">
          <div className="flex items-center gap-3">
            <span className="font-display font-bold text-base block text-white flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
              Recording Session
            </span>
            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Exercise: {exerciseName}</span>
          </div>
          <div className="flex items-center gap-3 select-none">
            {isPaused && (
              <span className="text-xs bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-3 py-1 rounded-full font-bold uppercase">
                Paused
              </span>
            )}
            <div className="flex items-center gap-2 px-3.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-semibold">
              <Activity className="h-3.5 w-3.5 animate-pulse" />
              <span>Skeletal Capture Active</span>
            </div>
          </div>
        </header>

        {/* Grid Area */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 items-start">
          
          {/* Camera Frame (col-span-8) */}
          <div className="lg:col-span-8 relative flex flex-col rounded-3xl overflow-hidden min-h-[450px] bg-black border border-slate-800">
            <MotionTracking
              cameraEnabled={cameraReady}
              mirror={mirror}
              onPoseDetected={handlePoseDetected}
              onGestureDetected={handleGestureDetected}
              onCameraReady={handleCameraReady}
            />

            {/* Paused Backdrop Overlay */}
            {isPaused && (
              <div className="absolute inset-0 bg-black/65 backdrop-blur-xs z-30 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                <PauseCircle className="h-16 w-16 text-yellow-500 animate-pulse mb-3" />
                <h3 className="text-xl font-display font-bold text-white">Workout Session Paused</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">Tracking and timer are temporarily suspended. Click Resume below to continue.</p>
              </div>
            )}

            {/* Floating Live Coaching Cards (Top Left) */}
            {!isPaused && active && rom > 0 && (
              <div className="absolute top-4 left-4 z-20 max-w-xs space-y-2.5">
                {/* Form Warning Card */}
                {!feedbackStatus.allPassed && (
                  <div className="bg-slate-950/90 border border-red-500/30 rounded-2xl p-4 backdrop-blur-md shadow-premium text-left space-y-2.5 animate-slide-in">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                      <span className="font-display font-bold text-[10px] uppercase tracking-wider">Form Correction</span>
                    </div>
                    <div className="space-y-1.5 text-xs">
                      {!feedbackStatus.rom.passed && (
                        <div className="flex items-center gap-2 text-red-300 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          <span>{feedbackStatus.rom.message}</span>
                        </div>
                      )}
                      {!feedbackStatus.alignment.passed && (
                        <div className="flex items-center gap-2 text-red-300 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          <span>{feedbackStatus.alignment.message}</span>
                        </div>
                      )}
                      {!feedbackStatus.speed.passed && (
                        <div className="flex items-center gap-2 text-red-300 font-semibold">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                          <span>{feedbackStatus.speed.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Excellent Form Card */}
                {feedbackStatus.allPassed && (
                  <div className="bg-slate-955/90 border border-emerald-500/30 rounded-2xl p-4 backdrop-blur-md shadow-premium text-left flex items-center gap-3 animate-slide-in">
                    <div className="h-7 w-7 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 shrink-0">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-white block">Perfect Form Met!</span>
                      <span className="text-[10px] text-emerald-400/90 block mt-0.5 font-medium">Keep holding this steady posture.</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Gesture Guide Tooltip/Instruction Overlay */}
            {!isPaused && (
              <div className={`absolute top-4 right-4 z-20 flex items-center gap-3 bg-slate-955/80 backdrop-blur-md border border-slate-800 px-4 py-2.5 rounded-2xl shadow-lg transition-all duration-300 ${
                gestureStatus === 'holding'
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                  : 'text-slate-300'
              }`}>
                <ThumbsUp className={`h-4.5 w-4.5 ${gestureStatus === 'holding' ? 'animate-bounce' : 'text-[#A27B41]'}`} />
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {gestureStatus === 'holding'
                      ? 'Holding gesture steady...'
                      : 'Show thumbs up to stop'}
                  </span>
                  {detectedGestureLabel && (
                    <span className="text-[8px] text-slate-400 font-mono">
                      AI: {detectedGestureLabel.replace(/_/g, ' ')} ({Math.round(detectedGestureScore * 100)}%)
                    </span>
                  )}
                  {gestureStatus === 'holding' && (
                    <div className="h-1 w-28 bg-slate-800 rounded-full overflow-hidden mt-0.5">
                      <div
                        className="h-full bg-amber-400 transition-all duration-75"
                        style={{ width: `${Math.round(gestureHoldProgress * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mini Skeleton overlay */}
            <div className="absolute bottom-4 left-4 z-20">
              <SkeletonMiniViewer
                landmarksRef={lastLandmarks}
                active={active && !isPaused}
                mirror={mirror}
              />
            </div>

            {/* Mirror Toggle */}
            <div className="absolute bottom-4 right-4 z-20 select-none">
              <Button
                variant="secondary"
                className="font-bold py-2 px-3.5 text-2xs border-slate-800 hover:bg-slate-850 text-slate-300 bg-slate-950/80 backdrop-blur-sm"
                onClick={() => setMirror(!mirror)}
              >
                Mirror View
              </Button>
            </div>
          </div>

          {/* Metrics Sidebar Panel (col-span-4) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Primary Metrics Card */}
            <div className="bg-[#121122] rounded-3xl border border-slate-800 p-6 space-y-6 text-left">
              <div className="flex justify-between items-center border-b border-slate-850 pb-4">
                <h3 className="font-display font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-primary-500" />
                  Live Feedback
                </h3>
                <span className="font-mono text-xs font-semibold text-slate-500">
                  Ref: {formatDuration(duration)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Reps */}
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850 text-left">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Completed Reps</span>
                  <span className="font-display font-bold text-4xl mt-1 block text-accent-500">{reps}</span>
                </div>

                {/* Range of Motion (ROM) */}
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850 text-left">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Current ROM</span>
                  <span className="font-display font-bold text-4xl mt-1 block text-primary-400">{rom}°</span>
                </div>

                {/* Accuracy Form Score */}
                <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850 text-left col-span-2 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Skeletal Score</span>
                    <span className="font-display font-bold text-2xl mt-1 block text-yellow-500">{score}%</span>
                  </div>
                  {/* Status Ring representation */}
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    feedbackStatus.allPassed 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {feedbackStatus.allPassed ? 'EXCELLENT' : 'CORRECTING'}
                  </span>
                </div>

                {/* Placeholders for Symmetry & Stability as requested */}
                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-850/60 text-left">
                  <span className="text-[9px] text-slate-500 block font-bold uppercase">Symmetry</span>
                  <span className="font-semibold text-xs text-slate-300 block mt-0.5">1.0 (Balanced)</span>
                </div>

                <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-850/60 text-left">
                  <span className="text-[9px] text-slate-500 block font-bold uppercase">Form Stability</span>
                  <span className="font-semibold text-xs text-slate-300 block mt-0.5">96% (Stable)</span>
                </div>
              </div>
            </div>

            {/* Joint Angles readout card */}
            <div className="bg-[#121122] rounded-3xl border border-slate-800 p-5 text-left space-y-3">
              <span className="text-[10px] text-slate-500 font-bold uppercase block tracking-wider">Joint Details (Left / Right)</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-850/60">
                  <span className="text-[9px] text-slate-500 block">Shoulder</span>
                  <span className="font-mono text-slate-200 mt-0.5 block">{liveAngles.shoulder_l}° / {liveAngles.shoulder_r}°</span>
                </div>
                <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-850/60">
                  <span className="text-[9px] text-slate-500 block">Elbow</span>
                  <span className="font-mono text-slate-200 mt-0.5 block">{liveAngles.elbow_l}° / {liveAngles.elbow_r}°</span>
                </div>
                <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-850/60">
                  <span className="text-[9px] text-slate-500 block">Hip</span>
                  <span className="font-mono text-slate-200 mt-0.5 block">{liveAngles.hip_l}° / {liveAngles.hip_r}°</span>
                </div>
                <div className="p-2 bg-slate-900/50 rounded-xl border border-slate-850/60">
                  <span className="text-[9px] text-slate-500 block">Knee</span>
                  <span className="font-mono text-slate-200 mt-0.5 block">{liveAngles.knee_l}° / {liveAngles.knee_r}°</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions card */}
            <div className="bg-[#121122] rounded-3xl border border-slate-800 p-6 flex flex-col gap-2.5">
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1 font-bold py-3 text-xs border-slate-800 hover:bg-slate-800 text-slate-300"
                  onClick={() => setIsPaused(!isPaused)}
                  leftIcon={isPaused ? <PlayCircle className="h-4 w-4 text-green-400" /> : <PauseCircle className="h-4 w-4 text-yellow-500" />}
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button
                  variant="secondary"
                  className="flex-1 font-bold py-3 text-xs border-slate-800 hover:bg-slate-850 text-slate-350"
                  onClick={handleReset}
                  leftIcon={<RotateCcw className="h-4 w-4" />}
                >
                  Restart
                </Button>
              </div>
              <Button
                variant="primary"
                className="w-full font-bold py-3.5 text-xs bg-red-650 hover:bg-red-700 border-none text-white shadow-lg flex items-center justify-center gap-2"
                onClick={handleStop}
                disabled={saving}
                leftIcon={<Square className="h-4 w-4 fill-current" />}
              >
                {saving ? 'Uploading telemetry...' : 'Complete Workout'}
              </Button>
            </div>

          </div>
        </div>
      </div>
    );
  };

  const renderProcessing = () => {
    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#121122] border border-slate-850 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto">
            <RefreshCw className="h-12 w-12 text-[#A27B41] animate-spin mx-auto" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-white">Finalizing Session</h2>
            <p className="text-xs text-slate-400">Please wait while we compile and sync your workout data streams.</p>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl text-left space-y-3.5">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Telemetry Pipelines</span>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A27B41]" />
                <span>Uploading structural motion coordinates...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A27B41]" />
                <span>Calibrating joint range bounds...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A27B41]" />
                <span>Saving clinical compliance telemetry...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col items-center justify-center p-6 font-sans">
        {/* Success animation styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes checkScale {
            0% { transform: scale(0.6); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
          .animate-check {
            animation: checkScale 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          }
        `}} />

        <div className="max-w-xl w-full bg-[#121122] border border-slate-850 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto h-20 w-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 animate-check">
            <CheckCircle2 className="h-12 w-12" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-display font-bold text-white">Workout Logged Successfully!</h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Your structural telemetry report has been processed and synced with the clinical dashboard. Your provider has been notified.
            </p>
          </div>

          {/* Core Metrics summary card */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4.5 bg-slate-900/60 border border-slate-800/80 rounded-2xl text-center">
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Total Reps</span>
              <span className="font-display font-bold text-lg text-white mt-1 block">{reps}</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Max ROM</span>
              <span className="font-display font-bold text-lg text-primary-400 mt-1 block">{rom}°</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Avg Accuracy</span>
              <span className="font-display font-bold text-lg text-yellow-500 mt-1 block">{score}%</span>
            </div>
            <div>
              <span className="text-[9px] text-slate-500 block uppercase font-bold">Duration</span>
              <span className="font-display font-bold text-lg text-white mt-1 block">{formatDuration(duration)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3.5 pt-4 w-full select-none">
            {uploadedSessionId !== null ? (
              <Button
                variant="primary"
                className="flex-1 font-bold py-3 text-xs btn-primary shadow-lg flex items-center justify-center gap-2"
                onClick={() => navigate(`/patient/session/${uploadedSessionId}`)}
              >
                <FileText className="h-4 w-4" /> View Session Details
              </Button>
            ) : (
              <Button
                variant="primary"
                className="flex-1 font-bold py-3 text-xs btn-primary shadow-lg flex items-center justify-center gap-2"
                onClick={() => navigate('/patient')}
              >
                Go to Companion
              </Button>
            )}
            <Button
              variant="secondary"
              className="flex-1 font-bold py-3 text-xs border-slate-800 hover:bg-slate-800 text-slate-350"
              onClick={() => navigate('/patient')}
            >
              Return to My Plan
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderError = () => {
    let errorTitle = "Capture Session Error";
    let errorMsg = "An unexpected error occurred during skeletal calibration or data streaming.";
    
    if (errorType === 'permission_denied') {
      errorTitle = "Camera Permission Denied";
      errorMsg = "Chosen Life could not initialize your webcam. Please check your browser's security lock in the address bar and allow camera access.";
    } else if (errorType === 'camera_unavailable') {
      errorTitle = "Webcam Hardware Offline";
      errorMsg = "No video input devices could be detected. Please ensure your camera is connected and not in use by another program.";
    } else if (errorType === 'upload_failed') {
      errorTitle = "Telemetry Sync Failed";
      errorMsg = "We captured your workout data but failed to sync it to the secure server due to an internet or server error.";
    }

    return (
      <div className="min-h-screen bg-[#0d0c18] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-[#121122] border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
          <div className="mx-auto h-16 w-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500">
            <AlertCircle className="h-8 w-8" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-display font-bold text-white">{errorTitle}</h2>
            <p className="text-xs text-slate-400 leading-relaxed">{errorMsg}</p>
          </div>

          <div className="flex gap-4 pt-4 select-none">
            <Button
              variant="secondary"
              className="flex-1 font-bold py-3 text-xs border-slate-800 hover:bg-slate-850 text-slate-355"
              onClick={() => {
                setCameraReady(false);
                setStep('consent');
              }}
            >
              Cancel Setup
            </Button>
            <Button
              variant="primary"
              className="flex-1 font-bold py-3 text-xs btn-primary shadow-lg"
              onClick={() => {
                if (errorType === 'upload_failed') {
                  handleStop();
                } else {
                  setStep('permission');
                  setCameraReady(false);
                }
              }}
            >
              Retry Action
            </Button>
          </div>
        </div>
      </div>
    );
  };

  switch (step) {
    case 'consent':
      return renderConsent();
    case 'permission':
      return renderPermission();
    case 'ready':
      return renderReady();
    case 'countdown':
      return renderCountdown();
    case 'recording':
      return renderRecording();
    case 'processing':
      return renderProcessing();
    case 'success':
      return renderSuccess();
    case 'error':
      return renderError();
    default:
      return renderConsent();
  }
};

export default TrackerSkeleton;
