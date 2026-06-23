import React, { useEffect, useRef } from 'react';
import type { Landmark } from '../utils/poseProcessor';

interface SkeletonMiniViewerProps {
  landmarksRef: React.MutableRefObject<Landmark[] | null>;
  active: boolean;
  mirror?: boolean;
}

const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
];

const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];

const SkeletonMiniViewer: React.FC<SkeletonMiniViewerProps> = ({
  landmarksRef,
  active,
  mirror = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const draw = () => {
      const landmarks = landmarksRef.current;
      ctx.clearRect(0, 0, W, H);

      if (!landmarks || landmarks.length === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const visible = (idx: number) => (landmarks[idx]?.visibility ?? 0) > 0.45;
      const px = (idx: number) => ({
        x: (landmarks[idx]?.x ?? 0) * W,
        y: (landmarks[idx]?.y ?? 0) * H,
      });

      if (mirror) {
        ctx.save();
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }

      ctx.lineCap = 'round';
      for (const [a, b] of BONES) {
        if (!visible(a) || !visible(b)) continue;
        const pa = px(a);
        const pb = px(b);
        ctx.beginPath();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      for (const idx of JOINTS) {
        if (!visible(idx)) continue;
        const p = px(idx);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      if (mirror) ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [active, mirror, landmarksRef]);

  if (!active) return null;

  return (
    <div className="bg-slate-950/85 backdrop-blur-sm border border-slate-800/80 rounded-xl p-2 shadow-lg">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
        Skeleton
      </span>
      <canvas
        ref={canvasRef}
        width={120}
        height={160}
        className="rounded-lg bg-slate-900/60"
      />
    </div>
  );
};

export default SkeletonMiniViewer;
