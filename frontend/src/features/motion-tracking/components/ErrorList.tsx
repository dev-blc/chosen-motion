import React from 'react';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2, Clock } from 'lucide-react';

interface SessionError {
  type: string;
  severity: string;
  timestamp_ms: number;
  description: string;
}

interface ErrorListProps {
  errors: SessionError[];
}

export const ErrorList: React.FC<ErrorListProps> = ({ errors }) => {
  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/25';
      case 'medium':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
      case 'low':
      default:
        return 'bg-blue-500/15 text-blue-400 border-blue-500/25';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return <ShieldAlert className="h-5 w-5 text-rose-400" />;
      case 'medium':
        return <AlertTriangle className="h-5 w-5 text-amber-400" />;
      case 'low':
      default:
        return <Info className="h-5 w-5 text-blue-400" />;
    }
  };

  const getSeverityBorder = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high':
        return 'border-l-rose-500/60';
      case 'medium':
        return 'border-l-amber-500/60';
      case 'low':
      default:
        return 'border-l-blue-500/60';
    }
  };

  const formatTimestamp = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const severityCounts = errors.reduce(
    (acc, e) => {
      const s = e.severity.toLowerCase();
      if (s === 'high') acc.high += 1;
      else if (s === 'medium') acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-10 rounded-2xl bg-slate-900/60 border border-slate-800 text-center gap-4">
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-base font-bold text-white">Flawless Session</span>
          <span className="text-sm text-slate-400 max-w-xs">
            No deviations or form errors were detected in your movement.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col gap-3 px-1">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
            Detected Form Corrections
          </h4>
          <span className="text-xs text-cyan-400 font-mono bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
            {errors.length} {errors.length === 1 ? 'Alert' : 'Alerts'}
          </span>
        </div>

        {/* Severity summary chips */}
        <div className="flex flex-wrap gap-2">
          {severityCounts.high > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
              {severityCounts.high} High
            </span>
          )}
          {severityCounts.medium > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {severityCounts.medium} Medium
            </span>
          )}
          {severityCounts.low > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {severityCounts.low} Low
            </span>
          )}
        </div>
      </div>

      {/* Alert cards — scroll handled by parent panel */}
      <div className="flex flex-col gap-3">
        {errors.map((error) => (
            <div
              key={`${error.type}-${error.timestamp_ms}-${error.description.slice(0, 20)}`}
              className={`flex items-start gap-4 p-4 rounded-xl bg-slate-900/80 border border-slate-800 border-l-[3px] ${getSeverityBorder(error.severity)} hover:bg-slate-850 hover:border-slate-750 transition-colors`}
            >
              <div className="mt-0.5 flex-shrink-0 p-2 rounded-lg bg-slate-950/60">
                {getSeverityIcon(error.severity)}
              </div>

              <div className="flex-1 flex flex-col text-left min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{error.type}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded-md">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(error.timestamp_ms)}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getSeverityBadge(error.severity)}`}
                    >
                      {error.severity}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  {error.description}
                </p>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};
