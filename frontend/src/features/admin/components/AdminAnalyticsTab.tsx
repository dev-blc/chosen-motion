import React, { useEffect, useState } from 'react';
import { AnalyticsCard } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Status';
import { fetchClinicAnalytics } from '@/services/api';

interface WeeklyPoint {
  label: string;
  avg_rom: number;
  session_count: number;
}

interface AlignmentPoint {
  label: string;
  score: number;
  session_count: number;
}

export const AdminAnalyticsTab: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [romProgress, setRomProgress] = useState<WeeklyPoint[]>([]);
  const [alignmentScores, setAlignmentScores] = useState<AlignmentPoint[]>([]);
  const [stats, setStats] = useState({ total_sessions: 0, average_session_score: 0, active_patients: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchClinicAnalytics();
        setRomProgress(data.rom_progress || []);
        setAlignmentScores(data.alignment_scores || []);
        setStats({
          total_sessions: data.total_sessions || 0,
          average_session_score: data.average_session_score || 0,
          active_patients: data.active_patients || 0,
        });
      } catch (err) {
        console.warn('Analytics API unavailable, showing empty state', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  const maxRom = Math.max(...romProgress.map((w) => w.avg_rom), 1);

  return (
    <div className="space-y-8 animate-slide-up text-left">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-chosen-surface border border-chosen rounded-chosen-lg">
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Total Sessions</span>
          <span className="text-2xl font-bold text-chosen-text-primary">{stats.total_sessions}</span>
        </div>
        <div className="p-4 bg-chosen-surface border border-chosen rounded-chosen-lg">
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Avg Form Score</span>
          <span className="text-2xl font-bold text-gold-500">{stats.average_session_score}%</span>
        </div>
        <div className="p-4 bg-chosen-surface border border-chosen rounded-chosen-lg">
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Active Patients</span>
          <span className="text-2xl font-bold text-chosen-text-primary">{stats.active_patients}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <AnalyticsCard title="Flexion (ROM) Recovery Progress" subtitle="Average degrees — last 4 weeks">
          {romProgress.length === 0 ? (
            <p className="text-sm text-chosen-text-muted py-8 text-center">No session data yet.</p>
          ) : (
            <div className="h-64 flex items-end gap-4 justify-between pt-6 border-b border-l border-chosen px-4">
              {romProgress.map((week, i) => (
                <div key={week.label} className="flex flex-col items-center w-full gap-2">
                  <div
                    className={`w-full rounded-t-lg transition-all duration-500 ${i === romProgress.length - 1 ? 'bg-gold-500' : 'bg-[#A27B41]/80'}`}
                    style={{ height: `${Math.max(20, (week.avg_rom / maxRom) * 180)}px` }}
                  />
                  <span className="text-[10px] font-bold text-chosen-text-muted text-center">
                    {week.label} ({week.avg_rom}°)
                  </span>
                </div>
              ))}
            </div>
          )}
        </AnalyticsCard>

        <AnalyticsCard title="Form Alignment Scores" subtitle="By exercise type">
          {alignmentScores.length === 0 ? (
            <p className="text-sm text-chosen-text-muted py-8 text-center">No alignment data yet.</p>
          ) : (
            <div className="space-y-4 pt-4">
              {alignmentScores.map((item) => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-chosen-text-secondary truncate pr-2">{item.label}</span>
                    <span className="text-chosen-text-primary shrink-0">{item.score}%</span>
                  </div>
                  <div className="w-full bg-chosen-surface h-2 rounded-full overflow-hidden">
                    <div className="bg-gold-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, item.score)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </AnalyticsCard>
      </div>
    </div>
  );
};
