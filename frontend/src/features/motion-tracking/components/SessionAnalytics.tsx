import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface MotionFrame {
  timestamp_millis: number;
  joint_coordinates: Record<string, number[]>;
}

interface HistoricalSession {
  id: number;
  completed_at: string;
  score: number;
  duration_seconds: number;
  range_of_motion: number;
  speed: number;
  symmetry: number;
}

interface SessionAnalyticsProps {
  frames?: MotionFrame[];
  history?: HistoricalSession[];
  exerciseName?: string;
}

export const SessionAnalytics: React.FC<SessionAnalyticsProps> = ({
  frames = [],
  history = [],
  exerciseName = 'Exercise'
}) => {
  
  // 1. Process current session frames for joint angle time series
  const activeJointKey = exerciseName.toLowerCase().includes('shoulder') 
    ? 'shoulder' 
    : exerciseName.toLowerCase().includes('knee') 
      ? 'knee' 
      : 'elbow';

  const calculateJointAngleDeg = (coords: Record<string, number[]>) => {
    const calculateAngle = (a: number[], b: number[], c: number[]) => {
      const baX = a[0] - b[0];
      const baY = a[1] - b[1];
      const bcX = c[0] - b[0];
      const bcY = c[1] - b[1];
      const dot = baX * bcX + baY * bcY;
      const magBA = Math.sqrt(baX * baX + baY * baY);
      const magBC = Math.sqrt(bcX * bcX + bcY * bcY);
      if (magBA === 0 || magBC === 0) return 0;
      const cos = dot / (magBA * magBC);
      return Math.round((Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI);
    };

    if (activeJointKey === 'shoulder') {
      const h = coords.hip_r;
      const s = coords.shoulder_r;
      const e = coords.elbow_r;
      if (h && s && e) return calculateAngle(h, s, e);
    } else if (activeJointKey === 'knee') {
      const h = coords.hip_r;
      const k = coords.knee_r;
      const a = coords.ankle_r;
      if (h && k && a) return calculateAngle(h, k, a);
    } else {
      const s = coords.shoulder_r;
      const e = coords.elbow_r;
      const w = coords.wrist_r;
      if (s && e && w) return calculateAngle(s, e, w);
    }
    return 0;
  };

  const currentSessionData = frames.map(f => ({
    time: (f.timestamp_millis / 1000).toFixed(1),
    Angle: calculateJointAngleDeg(f.joint_coordinates)
  }));

  // 2. Process history data for progress trend
  const trendData = [...history]
    .reverse() // show chronological order (oldest to newest)
    .map(s => ({
      date: new Date(s.completed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      ROM: Math.round(s.range_of_motion),
      Accuracy: Math.round(s.score),
      Speed: Math.round(s.speed),
      Symmetry: Math.round(s.symmetry * 100)
    }));


  return (
    <div className="flex flex-col gap-6 w-full">
      
      {/* Current Session Waveform Chart */}
      {currentSessionData.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col text-left shadow-lg">
          <div className="flex flex-col gap-1 mb-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">Joint Angle Waveform</h4>
            <p className="text-xs text-slate-400">Flexion / extension cycles tracked across the session duration (seconds)</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentSessionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} domain={[0, 180]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                  labelFormatter={(label) => `Time: ${label}s`}
                />
                <Line 
                  type="monotone" 
                  dataKey="Angle" 
                  stroke="#22d3ee" 
                  strokeWidth={2.5} 
                  dot={false}
                  activeDot={{ r: 6, strokeWidth: 0, fill: '#22d3ee' }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Historical Trends Charts */}
      {trendData.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* ROM & Accuracy Trend */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col text-left shadow-lg">
            <div className="flex flex-col gap-1 mb-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">ROM & Form Progress</h4>
              <p className="text-xs text-slate-400">Range of Motion angles and Form accuracy percentages over time</p>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="ROM" name="ROM (deg)" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="Accuracy" name="Accuracy (%)" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Speed & Symmetry Trend */}
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col text-left shadow-lg">
            <div className="flex flex-col gap-1 mb-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">Speed & Symmetry Trends</h4>
              <p className="text-xs text-slate-400">Mean movement speed and bilateral coordination symmetry percent</p>
            </div>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                  <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="Speed" name="Speed (deg/s)" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="Symmetry" name="Symmetry (%)" stroke="#fb7185" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
