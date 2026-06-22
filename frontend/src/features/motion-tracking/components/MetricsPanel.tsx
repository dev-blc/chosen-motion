import React from 'react';
import { Award, Zap, Activity, ShieldCheck, Repeat, Clock, HelpCircle } from 'lucide-react';

interface MetricsSummary {
  rom: number;
  speed: number;
  symmetry: number;
  smoothness: number;
  repetitions: number;
  accuracy_score: number;
  max_rom: number;
}

interface MetricsPanelProps {
  metrics: MetricsSummary;
  durationSeconds: number;
  score: number; // accuracy / form score
  status?: string;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  durationSeconds,
  score,
  status = 'completed'
}) => {
  
  // Color helper based on thresholds: 90-100 = green, 75-89 = yellow, <75 = red
  const getMetricColor = (val: number) => {
    if (val >= 90) {
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        accent: 'bg-emerald-500',
        glow: 'shadow-emerald-500/15'
      };
    } else if (val >= 75) {
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        accent: 'bg-amber-500',
        glow: 'shadow-amber-500/15'
      };
    } else {
      return {
        text: 'text-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/30',
        accent: 'bg-rose-500',
        glow: 'shadow-rose-500/15'
      };
    }
  };

  const formColor = getMetricColor(score);
  const accuracyColor = getMetricColor(metrics.accuracy_score || score);
  const romColor = getMetricColor((metrics.rom / 180) * 100); // map angle ROM as percentage of 180 for coloring
  const smoothnessColor = getMetricColor(metrics.smoothness || 80);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
      
      {/* 1. Form Score Card */}
      <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${formColor.border} ${formColor.glow} shadow-lg transition-all hover:scale-[1.01]`}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Form Score</span>
            <span className="text-3xl font-extrabold text-white mt-2">{score}%</span>
          </div>
          <div className={`p-2.5 rounded-xl ${formColor.bg} ${formColor.text}`}>
            <Award className="h-5 w-5" />
          </div>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className={`h-full ${formColor.accent}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-[10px] text-slate-500 mt-2 font-medium">Derived from MediaPipe landmark stability</span>
      </div>

      {/* 2. Accuracy Score Card */}
      <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${accuracyColor.border} ${accuracyColor.glow} shadow-lg transition-all hover:scale-[1.01]`}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accuracy Score</span>
            <span className="text-3xl font-extrabold text-white mt-2">
              {metrics.accuracy_score !== undefined ? `${metrics.accuracy_score}%` : 'N/A'}
            </span>
          </div>
          <div className={`p-2.5 rounded-xl ${accuracyColor.bg} ${accuracyColor.text}`}>
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className={`h-full ${accuracyColor.accent}`} style={{ width: `${metrics.accuracy_score || score}%` }} />
        </div>
        <span className="text-[10px] text-slate-500 mt-2 font-medium">Form corrections & compensation checks</span>
      </div>

      {/* 3. Range of Motion Card */}
      <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${romColor.border} ${romColor.glow} shadow-lg transition-all hover:scale-[1.01]`}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Range of Motion</span>
            <span className="text-3xl font-extrabold text-white mt-2">{Math.round(metrics.rom)}°</span>
          </div>
          <div className={`p-2.5 rounded-xl ${romColor.bg} ${romColor.text}`}>
            <Activity className="h-5 w-5" />
          </div>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className={`h-full ${romColor.accent}`} style={{ width: `${Math.min(100, (metrics.rom / 180) * 100)}%` }} />
        </div>
        <span className="text-[10px] text-slate-500 mt-2 font-medium">Peak joint angle deflection captured</span>
      </div>

      {/* 4. Movement Smoothness Card */}
      <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${smoothnessColor.border} ${smoothnessColor.glow} shadow-lg transition-all hover:scale-[1.01]`}>
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Smoothness</span>
            <span className="text-3xl font-extrabold text-white mt-2">
              {metrics.smoothness !== undefined ? `${metrics.smoothness}%` : 'N/A'}
            </span>
          </div>
          <div className={`p-2.5 rounded-xl ${smoothnessColor.bg} ${smoothnessColor.text}`}>
            <Zap className="h-5 w-5" />
          </div>
        </div>
        <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
          <div className={`h-full ${smoothnessColor.accent}`} style={{ width: `${metrics.smoothness || 80}%` }} />
        </div>
        <span className="text-[10px] text-slate-500 mt-2 font-medium">Velocity stability & jitter reduction rating</span>
      </div>

      {/* Auxiliary Details Bar (Reps, Duration, Speed, Status) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 mt-1 bg-slate-900/40 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 text-cyan-400 rounded-lg">
            <Repeat className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Repetitions</span>
            <span className="text-sm font-bold text-white">{metrics.repetitions} reps</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 text-violet-400 rounded-lg">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Duration</span>
            <span className="text-sm font-bold text-white">{formatDuration(durationSeconds)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 text-emerald-400 rounded-lg">
            <Activity className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Speed</span>
            <span className="text-sm font-bold text-white">{Math.round(metrics.speed)}°/sec</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-800 text-amber-400 rounded-lg">
            <HelpCircle className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Assessment Status</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
              status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              status === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
              'bg-slate-800 text-slate-400'
            }`}>
              {status}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
