import React from 'react';
import { Activity, Gauge, RotateCcw, Footprints } from 'lucide-react';

interface MetricSummary {
  avg?: number;
  min?: number;
  max?: number;
  unit?: string;
}

interface PositionAnalysisProps {
  jointMetrics?: Record<string, MetricSummary>;
  pace?: {
    rep_duration_ms?: { avg?: number; min?: number; max?: number };
    tempo_ratio?: number;
    rep_count?: number;
  };
  rotation?: {
    hip_rotation_drift_deg?: number;
    shoulder_rotation_drift_deg?: number;
  };
}

const formatMetric = (m?: MetricSummary) => {
  if (!m) return '—';
  return `${m.avg ?? 0} ${m.unit || ''} (min ${m.min ?? 0}, max ${m.max ?? 0})`;
};

export const PositionAnalysis: React.FC<PositionAnalysisProps> = ({
  jointMetrics = {},
  pace = {},
  rotation = {},
}) => {
  const cards = [
    {
      icon: <Activity className="h-4 w-4 text-orange-400" />,
      label: 'Torso Lean',
      value: formatMetric(jointMetrics.torso_lean),
      hint: 'Forward lean from vertical during movement',
    },
    {
      icon: <Gauge className="h-4 w-4 text-rose-400" />,
      label: 'Knee Valgus',
      value: formatMetric(jointMetrics.knee_valgus),
      hint: 'Inward knee collapse relative to ankle',
    },
    {
      icon: <Footprints className="h-4 w-4 text-emerald-400" />,
      label: 'Foot Width Ratio',
      value: formatMetric(jointMetrics.foot_width_ratio),
      hint: 'Stance width vs hip width',
    },
    {
      icon: <Activity className="h-4 w-4 text-violet-400" />,
      label: 'Hand Height',
      value: formatMetric(jointMetrics.hand_height),
      hint: 'Wrist position relative to hip',
    },
  ];

  const avgRepMs = pace.rep_duration_ms?.avg ?? 0;
  const tempoRatio = pace.tempo_ratio ?? 1;

  return (
    <div className="space-y-4 text-left">
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted mb-3">
          Semantic Joint Metrics
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {cards.map((card) => (
            <div key={card.label} className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
              <div className="flex items-center gap-2 mb-1">
                {card.icon}
                <span className="text-xs font-bold text-chosen-text-primary">{card.label}</span>
              </div>
              <p className="text-sm font-mono font-bold text-gold-500">{card.value}</p>
              <p className="text-2xs text-chosen-text-muted mt-1">{card.hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted mb-3">
          Pace & Tempo
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
            <span className="text-2xs text-chosen-text-muted block">Avg Rep Duration</span>
            <span className="text-lg font-bold text-chosen-text-primary">{(avgRepMs / 1000).toFixed(2)}s</span>
          </div>
          <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
            <span className="text-2xs text-chosen-text-muted block">Tempo Ratio (slow/fast)</span>
            <span className="text-lg font-bold text-chosen-text-primary">{tempoRatio.toFixed(2)}×</span>
          </div>
          <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
            <span className="text-2xs text-chosen-text-muted block">Reps Detected</span>
            <span className="text-lg font-bold text-chosen-text-primary">{pace.rep_count ?? 0}</span>
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted mb-3 flex items-center gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Rotation Drift
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
            <span className="text-2xs text-chosen-text-muted block">Hip Rotation Drift</span>
            <span className="text-lg font-bold text-emerald-400">{rotation.hip_rotation_drift_deg ?? 0}°</span>
          </div>
          <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
            <span className="text-2xs text-chosen-text-muted block">Shoulder Rotation Drift</span>
            <span className="text-lg font-bold text-violet-400">{rotation.shoulder_rotation_drift_deg ?? 0}°</span>
          </div>
        </div>
      </div>
    </div>
  );
};
