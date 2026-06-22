import React from 'react';
import { ShieldAlert, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface SessionError {
  type: string;
  severity: string; // 'low' | 'medium' | 'high'
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
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'low':
      default:
        return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
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

  const formatTimestamp = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white">Flawless Session!</span>
          <span className="text-xs text-slate-400 mt-1">No deviations or form errors were detected in your movement.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex justify-between items-center px-1">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Detected Form Corrections</h4>
        <span className="text-xs text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          {errors.length} {errors.length === 1 ? 'Alert' : 'Alerts'}
        </span>
      </div>

      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto pr-1">
        {errors.map((error, idx) => (
          <div 
            key={idx} 
            className="flex items-start gap-4 p-4 rounded-xl bg-slate-900 border border-slate-850 hover:border-slate-800 transition-all hover:scale-[1.005]"
          >
            <div className="mt-0.5 flex-shrink-0">
              {getSeverityIcon(error.severity)}
            </div>
            
            <div className="flex-1 flex flex-col text-left">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-bold text-white">{error.type}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    Timestamp: {formatTimestamp(error.timestamp_ms)}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${getSeverityBadge(error.severity)}`}>
                    {error.severity}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                {error.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
