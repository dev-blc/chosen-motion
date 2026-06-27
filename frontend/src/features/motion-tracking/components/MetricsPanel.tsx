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
import { Badge } from '@/components/ui/Badge';

interface MetricsSummary {
  rom: number;
  speed: number;
  symmetry: number;
  smoothness: number;
  repetitions: number;
  accuracy_score: number;
  max_rom: number;
  fatigue?: {
    overall_score?: number;
    fatigue_onset_rep?: number | null;
    most_tiring_joint?: string | null;
  };
}

interface MetricsPanelProps {
  metrics: MetricsSummary;
  durationSeconds: number;
  score: number;
  status?: string;
  errorCount?: number;
  fatigue?: MetricsSummary['fatigue'];
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({
  metrics,
  durationSeconds,
  score,
  status = 'completed',
  errorCount = 0,
  fatigue,
}) => {
  const getMetricColor = (val: number) => {
    if (val >= 90) {
      return {
        text: 'text-success',
        bg: 'bg-success-light',
        border: 'border-success/20',
        accent: 'bg-success',
        glow: 'shadow-chosen-sm'
      };
    } else if (val >= 75) {
      return {
        text: 'text-gold-500',
        bg: 'bg-gold-500/10',
        border: 'border-gold-500/20',
        accent: 'bg-gold-500',
        glow: 'shadow-chosen-sm'
      };
    } else {
      return {
        text: 'text-error',
        bg: 'bg-error-light',
        border: 'border-error/20',
        accent: 'bg-error',
        glow: 'shadow-chosen-sm'
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
    <div className="flex flex-col gap-4 w-full text-left">
      {/* Primary score cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 w-full">
        <div className={`flex flex-col p-5 rounded-chosen-lg bg-chosen-raised border ${formColor.border} ${formColor.glow} shadow-chosen-sm`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-chosen-text-muted uppercase tracking-wider">Form Score</span>
              <span className="text-3xl font-extrabold text-chosen-text-primary mt-2">{score}%</span>
            </div>
            <div className={`p-2.5 rounded-chosen-md ${formColor.bg} ${formColor.text}`}>
              <Award className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-chosen-surface h-1.5 rounded-full mt-4 overflow-hidden">
            <div className={`h-full ${formColor.accent}`} style={{ width: `${score}%` }} />
          </div>
          <span className="text-[10px] text-chosen-text-muted mt-2 font-medium">Landmark stability rating</span>
        </div>

        <div className={`flex flex-col p-5 rounded-chosen-lg bg-chosen-raised border ${accuracyColor.border} ${accuracyColor.glow} shadow-chosen-sm`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-chosen-text-muted uppercase tracking-wider">Accuracy</span>
              <span className="text-3xl font-extrabold text-chosen-text-primary mt-2">
                {metrics.accuracy_score !== undefined ? `${metrics.accuracy_score}%` : 'N/A'}
              </span>
            </div>
            <div className={`p-2.5 rounded-chosen-md ${accuracyColor.bg} ${accuracyColor.text}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-chosen-surface h-1.5 rounded-full mt-4 overflow-hidden">
            <div className={`h-full ${accuracyColor.accent}`} style={{ width: `${metrics.accuracy_score || score}%` }} />
          </div>
          <span className="text-[10px] text-chosen-text-muted mt-2 font-medium">Form corrections & compensation</span>
        </div>

        <div className={`flex flex-col p-5 rounded-chosen-lg bg-chosen-raised border ${romColor.border} ${romColor.glow} shadow-chosen-sm`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-chosen-text-muted uppercase tracking-wider">Range of Motion</span>
              <span className="text-3xl font-extrabold text-chosen-text-primary mt-2">{Math.round(metrics.rom)}°</span>
            </div>
            <div className={`p-2.5 rounded-chosen-md ${romColor.bg} ${romColor.text}`}>
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-chosen-surface h-1.5 rounded-full mt-4 overflow-hidden">
            <div className={`h-full ${romColor.accent}`} style={{ width: `${Math.min(100, (metrics.rom / 180) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-chosen-text-muted mt-2 font-medium">Peak joint deflection</span>
        </div>

        <div className={`flex flex-col p-5 rounded-chosen-lg bg-chosen-raised border ${symmetryColor.border} ${symmetryColor.glow} shadow-chosen-sm`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-chosen-text-muted uppercase tracking-wider">Symmetry</span>
              <span className="text-3xl font-extrabold text-chosen-text-primary mt-2">{symmetryPct}%</span>
            </div>
            <div className={`p-2.5 rounded-chosen-md ${symmetryColor.bg} ${symmetryColor.text}`}>
              <Scale className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-chosen-surface h-1.5 rounded-full mt-4 overflow-hidden">
            <div className={`h-full ${symmetryColor.accent}`} style={{ width: `${symmetryPct}%` }} />
          </div>
          <span className="text-[10px] text-chosen-text-muted mt-2 font-medium">Left/right bilateral balance</span>
        </div>

        <div className={`flex flex-col p-5 rounded-chosen-lg bg-chosen-raised border ${smoothnessColor.border} ${smoothnessColor.glow} shadow-chosen-sm`}>
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-chosen-text-muted uppercase tracking-wider">Smoothness</span>
              <span className="text-3xl font-extrabold text-chosen-text-primary mt-2">
                {metrics.smoothness !== undefined ? `${metrics.smoothness}%` : 'N/A'}
              </span>
            </div>
            <div className={`p-2.5 rounded-chosen-md ${smoothnessColor.bg} ${smoothnessColor.text}`}>
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-chosen-surface h-1.5 rounded-full mt-4 overflow-hidden">
            <div className={`h-full ${smoothnessColor.accent}`} style={{ width: `${metrics.smoothness || 80}%` }} />
          </div>
          <span className="text-[10px] text-chosen-text-muted mt-2 font-medium">Velocity stability rating</span>
        </div>

        <div className="flex flex-col p-5 rounded-chosen-lg bg-chosen-raised border border-chosen shadow-chosen-sm">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-chosen-text-muted uppercase tracking-wider">Peak ROM</span>
              <span className="text-3xl font-extrabold text-chosen-text-primary mt-2">
                {Math.round(metrics.max_rom || metrics.rom)}°
              </span>
            </div>
            <div className="p-2.5 rounded-chosen-md bg-gold-500/10 text-gold-500">
              <Target className="h-5 w-5" />
            </div>
          </div>
          <div className="w-full bg-chosen-surface h-1.5 rounded-full mt-4 overflow-hidden">
            <div
              className="h-full bg-gold-500"
              style={{ width: `${Math.min(100, ((metrics.max_rom || metrics.rom) / 180) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] text-chosen-text-muted mt-2 font-medium">Maximum angle achieved</span>
        </div>
      </div>

      {/* Secondary stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 bg-chosen-surface p-4 rounded-chosen-lg border border-chosen">
        <div className="flex items-center gap-3 p-3 rounded-chosen-md bg-chosen-raised border border-chosen">
          <div className="p-2 bg-chosen-surface text-gold-500 rounded-chosen-sm">
            <Repeat className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Reps</span>
            <span className="text-sm font-bold text-chosen-text-primary">{metrics.repetitions}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-chosen-md bg-chosen-raised border border-chosen">
          <div className="p-2 bg-chosen-surface text-indigo-500 rounded-chosen-sm">
            <Clock className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Duration</span>
            <span className="text-sm font-bold text-chosen-text-primary">{formatDuration(durationSeconds)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-chosen-md bg-chosen-raised border border-chosen">
          <div className="p-2 bg-chosen-surface text-success rounded-chosen-sm">
            <Activity className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Avg Speed</span>
            <span className="text-sm font-bold text-chosen-text-primary">{Math.round(metrics.speed)}°/s</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-chosen-md bg-chosen-raised border border-chosen">
          <div className="p-2 bg-chosen-surface text-gold-500 rounded-chosen-sm">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Tempo / Rep</span>
            <span className="text-sm font-bold text-chosen-text-primary">{tempoPerRep}s</span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-chosen-md bg-chosen-raised border border-chosen">
          <div className="p-2 bg-chosen-surface text-error rounded-chosen-sm">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Form Alerts</span>
            <span className={`text-sm font-bold ${errorCount > 0 ? 'text-error' : 'text-success'}`}>
              {errorCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-chosen-md bg-chosen-raised border border-chosen">
          <div className="p-2 bg-chosen-surface text-chosen-text-secondary rounded-chosen-sm">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Status</span>
            <div className="mt-1">
              <Badge variant={status === 'success' || status === 'completed' ? 'success' : status === 'warning' ? 'warning' : 'error'}>
                {status}
              </Badge>
            </div>
          </div>
        </div>

        {fatigue && (fatigue.overall_score !== undefined || fatigue.fatigue_onset_rep) && (
          <div className="flex items-center gap-3 p-3 rounded-chosen-md bg-chosen-raised border border-chosen col-span-2">
            <div className="p-2 bg-gold-500/10 text-gold-500 rounded-chosen-sm">
              <Activity className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Fatigue</span>
              <span className="text-sm font-bold text-chosen-text-primary">
                {fatigue.overall_score ?? 0} pts
                {fatigue.fatigue_onset_rep ? ` · onset rep #${fatigue.fatigue_onset_rep}` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
