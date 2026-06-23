import React from 'react';
import {
  Award,
  Zap,
  Activity,
  ShieldCheck,
  Repeat,
  Clock,
  Scale,
  Target,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

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
  score: number;
  status?: string;
  errorCount?: number;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  durationSeconds,
  score,
  status = 'completed',
  errorCount = 0
}) => {
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
  const romColor = getMetricColor((metrics.rom / 180) * 100);
  const smoothnessColor = getMetricColor(metrics.smoothness || 80);
  const symmetryPct = metrics.symmetry > 2 ? Math.round(metrics.symmetry) : Math.round(metrics.symmetry * 100);
  const symmetryColor = getMetricColor(symmetryPct);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}m ${secs}s`;
  };

  const tempoPerRep = metrics.repetitions > 0
    ? (durationSeconds / metrics.repetitions).toFixed(1)
    : '—';

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Primary score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
        <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${formColor.border} ${formColor.glow} shadow-lg`}>
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
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Landmark stability rating</span>
        </div>

        <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${accuracyColor.border} ${accuracyColor.glow} shadow-lg`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accuracy</span>
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
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Form corrections & compensation</span>
        </div>

        <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${romColor.border} ${romColor.glow} shadow-lg`}>
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
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Peak joint deflection</span>
        </div>

        <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${symmetryColor.border} ${symmetryColor.glow} shadow-lg`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Symmetry</span>
              <span className="text-3xl font-extrabold text-white mt-2">{symmetryPct}%</span>
            </div>
            <div className={`p-2.5 rounded-xl ${symmetryColor.bg} ${symmetryColor.text}`}>
              <Scale className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div className={`h-full ${symmetryColor.accent}`} style={{ width: `${symmetryPct}%` }} />
          </div>
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Left/right bilateral balance</span>
        </div>

        <div className={`flex flex-col p-5 rounded-2xl bg-slate-900 border ${smoothnessColor.border} ${smoothnessColor.glow} shadow-lg`}>
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
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Velocity stability rating</span>
        </div>

        <div className="flex flex-col p-5 rounded-2xl bg-slate-900 border border-cyan-500/30 shadow-cyan-500/15 shadow-lg">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Peak ROM</span>
              <span className="text-3xl font-extrabold text-white mt-2">
                {Math.round(metrics.max_rom || metrics.rom)}°
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-cyan-500"
              style={{ width: `${Math.min(100, ((metrics.max_rom || metrics.rom) / 180) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-500 mt-2 font-medium">Maximum angle achieved</span>
        </div>
      </div>

      {/* Secondary stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-850">
          <div className="p-2 bg-slate-800 text-cyan-400 rounded-lg">
            <Repeat className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Reps</span>
            <span className="text-sm font-bold text-white">{metrics.repetitions}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-850">
          <div className="p-2 bg-slate-800 text-violet-400 rounded-lg">
            <Clock className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Duration</span>
            <span className="text-sm font-bold text-white">{formatDuration(durationSeconds)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-850">
          <div className="p-2 bg-slate-800 text-emerald-400 rounded-lg">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Avg Speed</span>
            <span className="text-sm font-bold text-white">{Math.round(metrics.speed)}°/s</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-850">
          <div className="p-2 bg-slate-800 text-amber-400 rounded-lg">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tempo / Rep</span>
            <span className="text-sm font-bold text-white">{tempoPerRep}s</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-850">
          <div className="p-2 bg-slate-800 text-rose-400 rounded-lg">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Form Alerts</span>
            <span className={`text-sm font-bold ${errorCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {errorCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-850">
          <div className="p-2 bg-slate-800 text-slate-400 rounded-lg">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Status</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider w-fit ${
                status === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : status === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-slate-800 text-slate-400'
              }`}
            >
              {status}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
