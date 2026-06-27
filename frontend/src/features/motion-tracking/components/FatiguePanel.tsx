import React from 'react';
import { BatteryLow, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';

interface FatigueRep {
  rep: number;
  fatigue_score: number;
  joints?: Record<string, number>;
  rom?: number;
  duration_ms?: number;
  symmetry?: number;
}

interface FatigueData {
  overall_score?: number;
  fatigue_onset_rep?: number | null;
  most_tiring_joint?: string | null;
  per_rep?: FatigueRep[];
  joint_summary?: Record<string, { avg_fatigue: number; peak_rep: number; peak_fatigue: number }>;
}

interface FatiguePanelProps {
  fatigue?: FatigueData;
}

const JOINT_LABELS: Record<string, string> = {
  elbow_l: 'Left Elbow',
  elbow_r: 'Right Elbow',
  knee_l: 'Left Knee',
  knee_r: 'Right Knee',
  hip_l: 'Left Hip',
  hip_r: 'Right Hip',
  shoulder_l: 'Left Shoulder',
  shoulder_r: 'Right Shoulder',
};

const jointRegion = (key: string) => {
  if (key.includes('elbow') || key.includes('shoulder')) return 'upper';
  if (key.includes('hip')) return 'hip';
  if (key.includes('knee')) return 'knee';
  return 'other';
};

const fatigueColor = (score: number) => {
  if (score >= 60) return 'bg-error';
  if (score >= 35) return 'bg-gold-500';
  return 'bg-success';
};

export const FatiguePanel: React.FC<FatiguePanelProps> = ({ fatigue = {} }) => {
  const perRep = fatigue.per_rep || [];
  const jointSummary = fatigue.joint_summary || {};
  const mostTiring = fatigue.most_tiring_joint;

  const regionTotals = { elbow: 0, hip: 0, knee: 0, upper: 0 };
  Object.entries(jointSummary).forEach(([key, data]) => {
    const region = jointRegion(key);
    if (region === 'upper') {
      regionTotals.elbow += data.avg_fatigue;
    } else if (region === 'hip') {
      regionTotals.hip += data.avg_fatigue;
    } else if (region === 'knee') {
      regionTotals.knee += data.avg_fatigue;
    }
  });

  const topRegions = Object.entries(regionTotals)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4 text-left">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
          <span className="text-2xs text-chosen-text-muted block">Overall Fatigue</span>
          <span className="text-2xl font-bold text-chosen-text-primary flex items-center gap-1.5">
            <BatteryLow className="h-5 w-5 text-gold-500" />
            {fatigue.overall_score ?? 0}
          </span>
        </div>
        <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md">
          <span className="text-2xs text-chosen-text-muted block">Fatigue Onset Rep</span>
          <span className="text-2xl font-bold text-gold-500">
            {fatigue.fatigue_onset_rep ? `#${fatigue.fatigue_onset_rep}` : '—'}
          </span>
        </div>
        <div className="p-3 bg-chosen-surface border border-chosen rounded-chosen-md col-span-2 sm:col-span-1">
          <span className="text-2xs text-chosen-text-muted block">Most Tiring Joint</span>
          <span className="text-sm font-bold text-chosen-text-primary">
            {mostTiring ? (JOINT_LABELS[mostTiring] || mostTiring) : '—'}
          </span>
        </div>
      </div>

      {topRegions.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted mb-2">
            Fatigue by Body Region
          </h4>
          <div className="flex flex-wrap gap-2">
            {topRegions.map(([region, total]) => (
              <Badge key={region} variant={total >= 40 ? 'warning' : 'neutral'}>
                {region}: {total.toFixed(1)} pts
              </Badge>
            ))}
          </div>
        </div>
      )}

      {perRep.length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted mb-3 flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5" />
            Per-Rep Fatigue
          </h4>
          <div className="space-y-2">
            {perRep.map((rep) => (
              <div key={rep.rep} className="p-2.5 bg-chosen-surface border border-chosen rounded-chosen-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-chosen-text-primary">Rep {rep.rep}</span>
                  <span className="text-xs font-mono font-bold text-gold-500">{rep.fatigue_score} pts</span>
                </div>
                <div className="h-2 bg-chosen-raised rounded-full overflow-hidden">
                  <div
                    className={`h-full ${fatigueColor(rep.fatigue_score)} transition-all`}
                    style={{ width: `${Math.min(100, rep.fatigue_score)}%` }}
                  />
                </div>
                {rep.rep === fatigue.fatigue_onset_rep && (
                  <span className="text-2xs text-gold-500 font-bold mt-1 block">↑ Fatigue onset</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Object.keys(jointSummary).length > 0 && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-chosen-text-muted mb-2">
            Joint Fatigue Points
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-chosen-text-muted text-left">
                  <th className="pb-2 font-semibold">Joint</th>
                  <th className="pb-2 font-semibold">Avg</th>
                  <th className="pb-2 font-semibold">Peak</th>
                  <th className="pb-2 font-semibold">Peak Rep</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(jointSummary)
                  .sort((a, b) => b[1].avg_fatigue - a[1].avg_fatigue)
                  .map(([key, data]) => (
                    <tr key={key} className="border-t border-chosen">
                      <td className="py-2 font-medium text-chosen-text-primary">
                        {JOINT_LABELS[key] || key}
                        {key === mostTiring && (
                          <Badge variant="warning" className="ml-1.5 text-2xs">Most tiring</Badge>
                        )}
                      </td>
                      <td className="py-2 font-mono">{data.avg_fatigue}</td>
                      <td className="py-2 font-mono">{data.peak_fatigue}</td>
                      <td className="py-2 font-mono">#{data.peak_rep}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {perRep.length === 0 && (
        <p className="text-xs text-chosen-text-muted">No fatigue data for this session yet.</p>
      )}
    </div>
  );
};
