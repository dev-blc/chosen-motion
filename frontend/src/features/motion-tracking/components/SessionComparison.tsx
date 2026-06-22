import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCompare {
  current: number;
  previous: number;
  delta: number;
}

interface SessionComparisonProps {
  comparison: {
    current_session_id: number;
    previous_session_id: number | null;
    rom: MetricCompare;
    speed: MetricCompare;
    symmetry: MetricCompare;
    accuracy: MetricCompare;
    smoothness: MetricCompare;
    repetitions: MetricCompare;
  };
}

export const SessionComparison: React.FC<SessionComparisonProps> = ({ comparison }) => {
  const { previous_session_id, rom, speed, symmetry, accuracy, smoothness, repetitions } = comparison;

  if (!previous_session_id) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center gap-3">
        <TrendingUp className="h-10 w-10 text-cyan-400 animate-pulse" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white">First Session Recorded</span>
          <span className="text-xs text-slate-400 mt-1">Comparison metrics will populate once you record your next session of this exercise.</span>
        </div>
      </div>
    );
  }

  // Helper to render delta row
  const renderMetricRow = (
    label: string,
    data: MetricCompare,
    higherIsBetter = true,
    unit = ''
  ) => {
    const isImproved = higherIsBetter ? data.delta > 0 : data.delta < 0;
    const isNoChange = data.delta === 0;

    const getDeltaColor = () => {
      if (isNoChange) return 'text-slate-400 bg-slate-800/50';
      return isImproved 
        ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/10' 
        : 'text-rose-400 bg-rose-500/10 border border-rose-500/10';
    };

    const getDeltaIcon = () => {
      if (isNoChange) return <Minus className="h-3 w-3" />;
      return isImproved 
        ? <ArrowUpRight className="h-3 w-3" /> 
        : <ArrowDownRight className="h-3 w-3" />;
    };

    const formatVal = (val: number) => {
      return Number.isInteger(val) ? val.toString() : val.toFixed(1);
    };

    return (
      <div className="grid grid-cols-4 items-center py-3.5 border-b border-slate-850 last:border-b-0 hover:bg-slate-900/30 px-2 rounded-lg transition-all">
        {/* Metric Name */}
        <span className="text-xs font-bold text-slate-300 text-left">{label}</span>

        {/* Previous Session */}
        <span className="text-xs font-mono text-slate-400">{formatVal(data.previous)}{unit}</span>

        {/* Current Session */}
        <span className="text-xs font-mono text-white font-bold">{formatVal(data.current)}{unit}</span>

        {/* Comparison Delta */}
        <div className="flex justify-end">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${getDeltaColor()}`}>
            {getDeltaIcon()}
            {data.delta > 0 ? '+' : ''}{formatVal(data.delta)}{unit}
          </span>
        </div>
      </div>
    );
  };

  // Determine overall session progress
  const positiveDeltasCount = [rom, accuracy, smoothness, repetitions]
    .filter(m => m.delta > 0).length;

  const isOverallImprovement = positiveDeltasCount >= 2;

  return (
    <div className="flex flex-col gap-4 w-full bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-lg">
      
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4 text-left">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Progress Comparison</h4>
          <p className="text-xs text-slate-400">Comparing current session against your last attempt</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
          isOverallImprovement 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>
          {isOverallImprovement ? (
            <>
              <TrendingUp className="h-4 w-4" />
              <span>Overall Improvement</span>
            </>
          ) : (
            <>
              <TrendingDown className="h-4 w-4" />
              <span>Regression Detected</span>
            </>
          )}
        </div>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-4 text-slate-500 text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 border-b border-slate-850">
        <span className="text-left">Metric</span>
        <span className="text-left">Previous</span>
        <span className="text-left">Current</span>
        <span className="text-right">Delta</span>
      </div>

      {/* Table Body */}
      <div className="flex flex-col">
        {renderMetricRow('Range of Motion', rom, true, '°')}
        {renderMetricRow('Form Accuracy', accuracy, true, '%')}
        {renderMetricRow('Movement Smoothness', smoothness, true, '%')}
        {renderMetricRow('Repetitions Completed', repetitions, true, '')}
        {renderMetricRow('Average Speed', speed, false, '°/s')}
        {renderMetricRow('Bilateral Symmetry', symmetry, true, '%')}
      </div>
      
    </div>
  );
};
