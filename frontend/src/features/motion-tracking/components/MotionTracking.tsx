import React, { useEffect, useRef, useState } from 'react';
import { Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { calculateAngle, JointType } from '../utils/poseProcessor';

interface MotionTrackingProps {
  /** When true, the webcam and pose detection loop are running */
  cameraEnabled: boolean;
  mirror?: boolean;
  onPoseDetected?: (landmarks: any) => void;
  onCameraReady?: (ready: boolean) => void;
}

const MotionTracking: React.FC<MotionTrackingProps> = ({
  cameraEnabled,
  mirror = true,
  onPoseDetected,
  onCameraReady
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraCount, setCameraCount] = useState<number | null>(null);
  const [retryToggle, setRetryToggle] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poseInstance = useRef<any>(null);
  const requestRef = useRef<number | null>(null);

  // Scan connected camera input devices
  const runHardwareDiagnostics = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        setCameraCount(0);
        return;
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      setCameraCount(videoDevices.length);
    } catch (err) {
      console.warn('Failed to enumerate media devices', err);
      setCameraCount(0);
    }
  };

  // Re-run hardware scan automatically when camera connection fails
  useEffect(() => {
    if (cameraPermission === false) {
      runHardwareDiagnostics();
    }
  }, [cameraPermission]);

  const retryCameraConnection = () => {
    setCameraPermission(null);
    setCameraError(null);
    setRetryToggle(prev => !prev);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Enhanced skeleton renderer — color-coded by body side
  // Left  side: cyan arms   + emerald legs
  // Right side: violet arms + rose legs
  // Torso: slate-white
  // Face:  amber (thin)
  // ───────────────────────────────────────────────────────────────────────────
  const drawSkeleton = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;

    const px = (idx: number) => ({
      x: (landmarks[idx]?.x ?? 0) * W,
      y: (landmarks[idx]?.y ?? 0) * H,
    });
    const visible = (idx: number) => (landmarks[idx]?.visibility ?? 0) > 0.45;
    const bothVisible = (a: number, b: number) => visible(a) && visible(b);

    const drawBone = (a: number, b: number, color: string, width = 3.5) => {
      if (!bothVisible(a, b)) return;
      const pa = px(a);
      const pb = px(b);
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    };

    const drawJoint = (idx: number, fillColor: string, radius = 5) => {
      if (!visible(idx)) return;
      const p = px(idx);
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    };

    // ── Torso ──────────────────────────────────────────────────────────────
    ([[ 11, 12 ], [ 11, 23 ], [ 12, 24 ], [ 23, 24 ]] as [number,number][])
      .forEach(([a, b]) => drawBone(a, b, 'rgba(203,213,225,0.9)', 4));

    // ── Left arm (cyan) ────────────────────────────────────────────────────
    ([[ 11, 13 ], [ 13, 15 ], [ 15, 17 ], [ 15, 19 ], [ 15, 21 ], [ 17, 19 ]] as [number,number][])
      .forEach(([a, b]) => drawBone(a, b, '#22d3ee', 3.5));

    // ── Right arm (violet) ─────────────────────────────────────────────────
    ([[ 12, 14 ], [ 14, 16 ], [ 16, 18 ], [ 16, 20 ], [ 16, 22 ], [ 18, 20 ]] as [number,number][])
      .forEach(([a, b]) => drawBone(a, b, '#a78bfa', 3.5));

    // ── Left leg (emerald) ─────────────────────────────────────────────────
    ([[ 23, 25 ], [ 25, 27 ], [ 27, 29 ], [ 29, 31 ], [ 27, 31 ]] as [number,number][])
      .forEach(([a, b]) => drawBone(a, b, '#34d399', 3.5));

    // ── Right leg (rose) ───────────────────────────────────────────────────
    ([[ 24, 26 ], [ 26, 28 ], [ 28, 30 ], [ 30, 32 ], [ 28, 32 ]] as [number,number][])
      .forEach(([a, b]) => drawBone(a, b, '#fb7185', 3.5));

    // ── Face bones (amber, thin) ───────────────────────────────────────────
    ([[ 0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10]] as [number,number][])
      .forEach(([a, b]) => drawBone(a, b, 'rgba(251,191,36,0.65)', 1.5));

    // ── Head circle around nose ────────────────────────────────────────────
    if (visible(0)) {
      const nose = px(0);
      const radius = Math.min(W, H) * 0.045;
      ctx.beginPath();
      ctx.arc(nose.x, nose.y, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // ── Primary joint keypoints ────────────────────────────────────────────
    const primaryJoints: { idx: number; color: string; r: number }[] = [
      { idx: 11, color: '#22d3ee', r: 6   }, // L shoulder
      { idx: 12, color: '#a78bfa', r: 6   }, // R shoulder
      { idx: 13, color: '#22d3ee', r: 5.5 }, // L elbow
      { idx: 14, color: '#a78bfa', r: 5.5 }, // R elbow
      { idx: 15, color: '#67e8f9', r: 5   }, // L wrist
      { idx: 16, color: '#c4b5fd', r: 5   }, // R wrist
      { idx: 23, color: '#34d399', r: 6   }, // L hip
      { idx: 24, color: '#fb7185', r: 6   }, // R hip
      { idx: 25, color: '#34d399', r: 5.5 }, // L knee
      { idx: 26, color: '#fb7185', r: 5.5 }, // R knee
      { idx: 27, color: '#6ee7b7', r: 5   }, // L ankle
      { idx: 28, color: '#fda4af', r: 5   }, // R ankle
    ];
    primaryJoints.forEach(({ idx, color, r }) => drawJoint(idx, color, r));

    // Secondary joints (hands, feet)
    [17, 18, 19, 20, 21, 22, 29, 30, 31, 32].forEach(idx => {
      drawJoint(idx, 'rgba(148,163,184,0.8)', 3);
    });

    // ── Live Angle Badges Overlay ───────────────────────────────────────────
    const drawAngleBadge = (
      x: number,
      y: number,
      text: string,
      jointColor: string
    ) => {
      ctx.save();
      
      // Font settings
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      
      // Measure text
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const paddingX = 5;
      const badgeWidth = textWidth + paddingX * 2;
      const badgeHeight = 14;
      
      // Translate to badge location (draw slightly above the joint center)
      const badgeY = y - 14;
      ctx.translate(x, badgeY);
      
      // If canvas is CSS-mirrored, we must pre-flip the context horizontally 
      // so the browser's scaleX(-1) mirror effect makes it render normally.
      if (mirror) {
        ctx.scale(-1, 1);
      }
      
      // Draw badge background
      ctx.beginPath();
      const radius = 3;
      if (ctx.roundRect) {
        ctx.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, radius);
      } else {
        ctx.rect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight);
      }
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fill();
      
      // Draw badge border matching the joint's side color
      ctx.strokeStyle = jointColor;
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 0, 0);
      
      ctx.restore();
    };

    const angleJointConfigs = [
      { joint: 'shoulder' as JointType, side: 'left' as const, idx: 11, color: '#22d3ee', req: [23, 11, 13] },
      { joint: 'shoulder' as JointType, side: 'right' as const, idx: 12, color: '#a78bfa', req: [24, 12, 14] },
      { joint: 'elbow' as JointType, side: 'left' as const, idx: 13, color: '#22d3ee', req: [11, 13, 15] },
      { joint: 'elbow' as JointType, side: 'right' as const, idx: 14, color: '#a78bfa', req: [12, 14, 16] },
      { joint: 'hip' as JointType, side: 'left' as const, idx: 23, color: '#34d399', req: [11, 23, 25] },
      { joint: 'hip' as JointType, side: 'right' as const, idx: 24, color: '#fb7185', req: [12, 24, 26] },
      { joint: 'knee' as JointType, side: 'left' as const, idx: 25, color: '#34d399', req: [23, 25, 27] },
      { joint: 'knee' as JointType, side: 'right' as const, idx: 26, color: '#fb7185', req: [24, 26, 28] },
    ];

    angleJointConfigs.forEach(({ joint, side, idx, color, req }) => {
      const allVisible = req.every(i => visible(i));
      if (allVisible) {
        const angle = calculateAngle(joint, landmarks, side);
        const pt = px(idx);
        drawAngleBadge(pt.x, pt.y, `${angle}°`, color);
      }
    });
  };

  // 1. Dynamic import and initialize PoseLandmarker
  useEffect(() => {
    let active = true;

    async function initMediaPipeVision() {
      try {
        // @ts-ignore
        const visionModule = await import(/* @vite-ignore */ "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs");
        
        const vision = await visionModule.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );

        const landmarker = await visionModule.PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 1
        });

        if (active) {
          poseInstance.current = landmarker;
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Failed to initialize PoseLandmarker tasks-vision', err);
        if (active) {
          setError(`Could not boot joint recognition model: ${err?.message || String(err)}`);
          setLoading(false);
        }
      }
    }

    initMediaPipeVision();

    return () => {
      active = false;
      if (poseInstance.current) {
        poseInstance.current.close();
      }
    };
  }, []);

  // 2. Real-time draw loop triggered by browser frames
  const drawLoop = () => {
    if (!videoRef.current || !canvasRef.current || !poseInstance.current || !cameraEnabled) {
      requestRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const landmarker = poseInstance.current;

    if (video.readyState >= 2 && ctx) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw camera raw frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Perform Pose Detection
      try {
        const timestamp = performance.now();
        const result = landmarker.detectForVideo(video, timestamp);

        if (result.landmarks && result.landmarks.length > 0) {
          const landmarks = result.landmarks[0];
          drawSkeleton(ctx, landmarks);

          if (onPoseDetected) {
            onPoseDetected(landmarks);
          }
        }
      } catch (detErr) {
        console.error('Telemetry frame calculation skipped', detErr);
      }
      ctx.restore();
    }

    requestRef.current = requestAnimationFrame(drawLoop);
  };

  // 3. Request webcam stream and manage draw animation loop
  useEffect(() => {
    if (!cameraEnabled) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      setCameraPermission(null);
      return;
    }

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("getUserMedia is not supported on this browser context. Secure contexts (Localhost or HTTPS) are required.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraPermission(true);
          if (onCameraReady) onCameraReady(true);
          
          requestRef.current = requestAnimationFrame(drawLoop);
        }
      } catch (err: any) {
        console.error('Camera access permissions blocked or failed', err);
        setCameraError(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        setCameraPermission(false);
        if (onCameraReady) onCameraReady(false);
      }
    };

    if (!loading && !error && poseInstance.current) {
      startCamera();
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [cameraEnabled, loading, error, retryToggle]);

  return (
    <div className="relative w-full h-full min-h-[350px] bg-black rounded-3xl border border-slate-800 flex items-center justify-center overflow-hidden">
      
      {/* Hidden webcam stream input container */}
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
      />

      {/* Render Canvas Overlay */}
      {cameraEnabled && cameraPermission === true && !loading && !error && (
        <canvas
          ref={canvasRef}
          className={`w-full h-full object-cover transition-transform duration-200 ${mirror ? '-scale-x-100' : ''}`}
        />
      )}

      {/* Loading status */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 bg-black/90 z-20">
          <RefreshCw className="h-8 w-8 text-primary-500 animate-spin" />
          <span className="text-xs font-semibold uppercase tracking-wider">Loading Skeletal Capture Engine...</span>
        </div>
      )}

      {/* Initialize errors */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-3 bg-black/90 p-6 text-center z-20">
          <AlertCircle className="h-10 w-10 text-red-500" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      )}

      {/* Camera Permission Diagnostic Panel */}
      {cameraPermission === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/95 p-6 z-20 text-center overflow-y-auto">
          <div className="max-w-md w-full space-y-6 p-6 border border-red-500/20 bg-slate-900/60 rounded-3xl backdrop-blur-sm shadow-premium">
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                <Camera className="h-6 w-6" />
              </div>
              <h4 className="font-display font-bold text-base text-white">Camera Access Diagnostics</h4>
              <p className="text-2xs text-slate-400 max-w-xs">Chosen Motion could not connect to your webcam. Review the diagnostics below.</p>
            </div>

            {/* Diagnostics checklist */}
            <div className="text-left text-xs bg-slate-950/50 p-4 rounded-2xl border border-slate-800/80 space-y-3">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Exact Browser Error</span>
                <span className="font-mono text-red-400 block break-words text-2xs mt-1 leading-normal">{cameraError || 'NotAllowedError: Permission denied'}</span>
              </div>
              
              <hr className="border-slate-850" />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Secure Context Check</span>
                  <span className={`font-semibold text-2xs mt-1 block ${window.isSecureContext ? 'text-green-500' : 'text-red-500'}`}>
                    {window.isSecureContext ? 'Secure (Localhost/HTTPS)' : 'Insecure Context'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Protocol / Host</span>
                  <span className="font-semibold text-slate-400 text-2xs mt-1 block truncate">{window.location.protocol} // {window.location.hostname}</span>
                </div>
              </div>
              
              <hr className="border-slate-850" />

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Camera Hardware Check</span>
                <span className="font-semibold text-slate-350 text-2xs mt-1 block">
                  {cameraCount !== null ? `${cameraCount} video input device(s) found` : 'Scanning hardware...'}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={retryCameraConnection}
                className="flex-1 btn-primary py-2.5 text-xs font-bold"
              >
                Retry Connection
              </button>
              <button
                onClick={runHardwareDiagnostics}
                className="btn-secondary py-2.5 text-xs font-bold px-4"
              >
                Scan Hardware
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waiting for camera */}
      {cameraEnabled && cameraPermission === null && !loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-2 z-10">
          <RefreshCw className="h-10 w-10 text-primary-500 animate-spin" />
          <p className="text-sm font-medium">Starting camera calibration...</p>
        </div>
      )}

      {/* Skeleton color legend — visible when camera is live */}
      {cameraEnabled && cameraPermission === true && (
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 bg-slate-950/80 backdrop-blur-sm px-3 py-2.5 rounded-xl border border-slate-800/80">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Skeleton</span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-300"><span className="h-1.5 w-4 rounded bg-cyan-400 inline-block" /> Left arm</span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-300"><span className="h-1.5 w-4 rounded bg-violet-400 inline-block" /> Right arm</span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-300"><span className="h-1.5 w-4 rounded bg-emerald-400 inline-block" /> Left leg</span>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-300"><span className="h-1.5 w-4 rounded bg-rose-400 inline-block" /> Right leg</span>
        </div>
      )}

      {/* Real-time mirror tag indicator */}
      {cameraEnabled && cameraPermission === true && (
        <span className="absolute top-4 left-4 z-20 flex items-center gap-2 text-[10px] font-semibold bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800/80 backdrop-blur-sm text-slate-300">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          Capture Live {mirror ? '| Mirrored' : ''}
        </span>
      )}
    </div>
  );
};

export default MotionTracking;
