import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchMySessions, fetchPatientProfile, fetchMyAssignments } from '@/services/api';
import type { ExerciseAssignment, MotionSession } from '@/types/api';
import { 
  Play, 
  PlayCircle,
  Activity, 
  Clock, 
  TrendingUp, 
  LogOut, 
  Award,
  Calendar,
  History,
  FileSpreadsheet,
  Heart,
  Dumbbell,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  BarChart3
} from 'lucide-react';

interface ProgressData {
  label: string;
  rom: number;
  score: number;
}

const ProgressChart: React.FC<{ data: ProgressData[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
        <span className="text-xs">Not enough sessions to display analytics</span>
      </div>
    );
  }

  const width = 500;
  const height = 220;
  const padding = 40;
  
  const pointsROM = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / Math.max(1, data.length - 1);
    // ROM mapped out of 180 degrees
    const y = height - padding - ((d.rom || 0) / 180) * (height - 2 * padding);
    return { x, y };
  });

  const pointsScore = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / Math.max(1, data.length - 1);
    // Score mapped out of 100 percent
    const y = height - padding - ((d.score || 0) / 100) * (height - 2 * padding);
    return { x, y };
  });

  const pathROM = pointsROM.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const pathScore = pointsScore.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      {/* Grid Lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
        const y = padding + r * (height - 2 * padding);
        return (
          <line
            key={idx}
            x1={padding}
            y1={y}
            x2={width - padding}
            y2={y}
            stroke="currentColor"
            className="text-slate-200 dark:text-slate-800/60"
            strokeDasharray="4 4"
          />
        );
      })}
      
      {/* Line Paths */}
      {data.length > 1 && (
        <>
          {/* ROM Line with Indigo Gradient */}
          <path d={pathROM} fill="none" stroke="#6366f1" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {/* Score Line with Emerald Gradient */}
          <path d={pathScore} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}

      {/* Grid Circular Vertices */}
      {data.map((d, i) => {
        const pROM = pointsROM[i];
        const pScore = pointsScore[i];
        return (
          <g key={i}>
            {/* ROM circle dot */}
            <circle cx={pROM.x} cy={pROM.y} r="5" fill="#6366f1" stroke="#fff" strokeWidth="2.5" className="hover:scale-125 transition-all" />
            <title>{`ROM: ${d.rom}°`}</title>
            
            {/* Score circle dot */}
            <circle cx={pScore.x} cy={pScore.y} r="5" fill="#10b981" stroke="#fff" strokeWidth="2.5" className="hover:scale-125 transition-all" />
            <title>{`Form Accuracy: ${d.score}%`}</title>

            {/* X-Axis Labels */}
            <text
              x={pROM.x}
              y={height - 12}
              textAnchor="middle"
              className="text-[10px] fill-slate-400 dark:fill-slate-500 font-bold"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

const PatientDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [sessions, setSessions] = useState<MotionSession[]>([]);
  const [assignments, setAssignments] = useState<ExerciseAssignment[]>([]);
  const [clinicalProfile, setClinicalProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadPatientData() {
      try {
        const [patientData, sessionsData, assignmentsData] = await Promise.all([
          fetchPatientProfile(),
          fetchMySessions(),
          fetchMyAssignments(),
        ]);
        setClinicalProfile(patientData);
        setSessions(sessionsData);
        setAssignments(assignmentsData);
      } catch (err) {
        console.error('Failed to load patient data:', err);
        setClinicalProfile(null);
        setSessions([]);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    }
    loadPatientData();
  }, []);

  const totalDuration = sessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);
  const avgAccuracy = sessions.length 
    ? Math.round(sessions.reduce((acc, s) => acc + (s.avg_score || 0), 0) / sessions.length)
    : 0;

  // Process data for the SVG progress analytics chart
  const processedChartData: ProgressData[] = [...sessions]
    .slice(0, 7)
    .reverse()
    .map(s => ({
      label: new Date(s.completed_at || s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rom: s.range_of_motion || 0,
      score: s.avg_score || 0
    }));

  const activeAssignments = assignments;
  const upcomingAssignments = assignments;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-brand-dark flex flex-col transition-colors duration-200 text-slate-800 dark:text-slate-200">
      
      {/* Header */}
      <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-brand-cardDark/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/60 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-primary-500 rounded-xl flex items-center justify-center text-white shadow-premium">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <span className="font-display font-bold text-lg text-slate-900 dark:text-white leading-none block">Chosen Motion</span>
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary-500 mt-1 block">Patient Companion</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-semibold text-slate-800 dark:text-white">
              {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : profile?.email}
            </span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase mt-0.5">
              Patient Profile
            </span>
          </div>
          <button 
            onClick={signOut}
            className="p-2.5 bg-slate-100 hover:bg-red-50 dark:bg-slate-800 dark:hover:bg-red-950/20 text-slate-600 hover:text-red-500 dark:text-slate-300 rounded-xl transition-all duration-150"
            title="Sign Out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8 animate-slide-up">
        
        {/* Banner greeting */}
        <div className="bg-gradient-to-r from-primary-600 to-indigo-600 rounded-3xl p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-premium relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 -mr-8 -mb-8 w-48 h-48 bg-black/10 rounded-full blur-xl pointer-events-none" />

          <div className="space-y-2 relative z-10">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-300 fill-current" />
              <span className="text-xs uppercase font-bold tracking-widest text-primary-100">Welcome Back</span>
            </div>
            <h1 className="font-display font-bold text-2xl md:text-3xl">Hello, {profile?.firstName || 'Patient'}</h1>
            <p className="text-primary-100 text-sm max-w-md">
              Ready to recover? Select your assigned exercises below to launch real-time motion capture analysis and submit tracking telemetry.
            </p>
          </div>
          <div className="relative z-10 shrink-0">
            {activeAssignments.length > 0 ? (
              <button 
                onClick={() => navigate('/tracker', { state: { exerciseName: activeAssignments[0].exercise?.name, rules: activeAssignments[0].exercise?.rules } })}
                className="btn-accent py-4 px-6 shadow-lg hover:shadow-accent-500/20 text-base font-bold flex items-center gap-2"
              >
                <Play className="h-5 w-5 fill-current" />
                Start Today's Routine
              </button>
            ) : (
              <button 
                onClick={() => navigate('/tracker')}
                className="btn-accent py-4 px-6 shadow-lg hover:shadow-accent-500/20 text-base font-bold flex items-center gap-2"
              >
                <Play className="h-5 w-5 fill-current" />
                Quick Practice
              </button>
            )}
          </div>
        </div>

        {/* Clinical diagnosis banner */}
        {clinicalProfile?.diagnosis && (
          <div className="glass-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-primary-500">
            <div>
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Clinical Treatment Plan</span>
              <p className="font-semibold text-slate-800 dark:text-slate-100 mt-1">{clinicalProfile.diagnosis}</p>
            </div>
            <div className="text-sm">
              <span className="text-slate-400 dark:text-slate-500 block text-xs">Supervising Clinician</span>
              <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Heart className="h-4 w-4 text-red-500 fill-current" />
                Dr. {clinicalProfile.assigned_admin?.user?.last_name || 'David Carter'}
              </span>
            </div>
          </div>
        )}

        {/* Info Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="glass-card p-6 flex items-center gap-5">
            <div className="p-4 bg-primary-500/10 text-primary-500 rounded-2xl">
              <Calendar className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold block">Sessions Done</span>
              <span className="font-display font-bold text-2xl text-slate-900 dark:text-white mt-1 block">
                {loading ? '...' : sessions.length}
              </span>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-5">
            <div className="p-4 bg-accent-500/10 text-accent-500 rounded-2xl">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold block">Avg Form Accuracy</span>
              <span className="font-display font-bold text-2xl text-slate-900 dark:text-white mt-1 block">
                {loading ? '...' : `${avgAccuracy}%`}
              </span>
            </div>
          </div>

          <div className="glass-card p-6 flex items-center gap-5">
            <div className="p-4 bg-yellow-500/10 text-yellow-500 rounded-2xl">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold block">Practice Practice</span>
              <span className="font-display font-bold text-2xl text-slate-900 dark:text-white mt-1 block">
                {loading ? '...' : `${Math.round(totalDuration / 60)}m`}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Columns (Assigned Program and Metrics Graphs) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Assigned Exercises Grid */}
            <div className="glass-card p-6 space-y-6">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-slate-400" />
                  Assigned Rehabilitation Exercises
                </h3>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Exercises prescribed specifically for your rehab program</p>
              </div>

              {loading ? (
                <p className="text-sm text-slate-400 text-center py-8">Loading program...</p>
              ) : activeAssignments.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                  <Dumbbell className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
                  <p className="font-medium">No exercises assigned yet.</p>
                  <p className="text-xs mt-1">Your clinician will assign exercise templates shortly.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeAssignments.map((assignment) => {
                    const ex = assignment.exercise;
                    if (!ex) return null;
                    return (
                      <div key={assignment.id} className="border border-slate-200/60 dark:border-slate-800/80 rounded-2xl overflow-hidden bg-slate-50/40 dark:bg-slate-900/10 flex flex-col justify-between hover:border-primary-500 dark:hover:border-primary-500 transition-all duration-200">
                        <div>
                          <div className="relative">
                            <img 
                              src={ex.thumbnail_url || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=150'} 
                              alt={ex.name} 
                              className="h-32 w-full object-cover border-b border-slate-200 dark:border-slate-800"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=150';
                              }}
                            />
                          </div>
                          
                          <div className="p-5 space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">{ex.name}</h4>
                              <span className="text-[10px] bg-primary-50 dark:bg-primary-950/20 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                                ROM: {ex.target_rom || 120}°
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{ex.description}</p>
                            
                            {ex.instructions && (
                              <div className="text-[11px] bg-slate-100/50 dark:bg-slate-900/40 p-2.5 rounded-xl text-slate-600 dark:text-slate-350 italic">
                                "{ex.instructions}"
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="p-5 pt-0">
                          <button
                            onClick={() => navigate('/tracker', { state: { exerciseName: ex.name, rules: ex.rules } })}
                            className="w-full btn-secondary text-xs py-2 flex items-center justify-center gap-1.5 font-bold hover:bg-primary-500 hover:text-white dark:hover:bg-primary-600 transition-all"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" /> Start Exercise Session
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Progress Metrics Section */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-slate-400" />
                    Recovery Progress Analytics
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Range of Motion (ROM) & alignment scores trends</p>
                </div>
                
                {/* Custom Legends */}
                <div className="flex gap-4 text-xs font-semibold self-start sm:self-auto">
                  <span className="flex items-center gap-1.5 text-indigo-500">
                    <span className="h-2.5 w-2.5 bg-indigo-500 rounded-full inline-block" />
                    ROM Achieved (°)
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-500">
                    <span className="h-2.5 w-2.5 bg-emerald-500 rounded-full inline-block" />
                    Accuracy Score (%)
                  </span>
                </div>
              </div>

              <div className="bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-800/60 rounded-3xl p-6 relative">
                <ProgressChart data={processedChartData} />
              </div>
            </div>

          </div>

          {/* Right Columns (Upcoming Tasks and Recording History Logs) */}
          <div className="space-y-8">
            
            {/* Upcoming Sessions Calendar */}
            <div className="glass-card p-6 space-y-6">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-4.5 w-4.5 text-slate-400" />
                  Upcoming Sessions Schedule
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Assigned workouts due shortly</p>
              </div>

              {loading ? (
                <p className="text-xs text-slate-400">Loading schedule...</p>
              ) : upcomingAssignments.length === 0 ? (
                <div className="p-4 bg-slate-50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/30 text-slate-500 dark:text-slate-400 rounded-2xl flex gap-2.5 items-start">
                  <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold block">No Assigned Exercises</span>
                    <span className="text-[10px] opacity-80 mt-0.5 block">Your clinician will assign exercises to your program.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAssignments.map((assignment) => (
                    <div key={assignment.id} className="p-4 bg-slate-55 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800/80 rounded-2xl flex justify-between items-center hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                      <div className="space-y-1">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white block">
                          {assignment.exercise?.name}
                        </span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'Today'}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate('/tracker', { state: { exerciseName: assignment.exercise?.name, rules: assignment.exercise?.rules } })}
                        className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-950/30 text-primary-500 rounded-xl transition-all"
                        title="Start workout"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recording Logs timeline list */}
            <div className="glass-card p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="h-4.5 w-4.5 text-slate-400" />
                    Completed Practice Logs
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Logs of completed rehab exercises</p>
                </div>
                <button 
                  onClick={() => alert('Feature coming soon: Telemetry CSV exported.')}
                  className="text-xs font-semibold text-primary-500 hover:text-primary-600 flex items-center gap-0.5"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
                </button>
              </div>

              {loading ? (
                <p className="text-xs text-slate-400 text-center py-4">Loading logs...</p>
              ) : sessions.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No sessions recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/20 border border-slate-100/50 dark:border-slate-800/40 rounded-xl hover:translate-x-0.5 transition-all text-xs">
                      <div className="flex items-center gap-3">
                        <div className="h-8.5 w-8.5 bg-primary-50 dark:bg-primary-950/20 text-primary-500 rounded-lg flex items-center justify-center font-bold">
                          <TrendingUp className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <h5 className="font-semibold text-slate-900 dark:text-white block max-w-[120px] truncate">
                            {session.title || 'Workout'}
                          </h5>
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                            {new Date(session.completed_at || session.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-bold text-slate-800 dark:text-slate-200 block">
                            {session.avg_score || session.score}% Form
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                            {Math.round(session.range_of_motion || 0)}° ROM | {session.duration_seconds || 0}s
                          </span>
                        </div>
                        <button
                          onClick={() => navigate(`/patient/session/${session.id}`)}
                          className="p-1.5 bg-slate-100 hover:bg-primary-100 dark:bg-slate-800 dark:hover:bg-primary-950/40 text-slate-500 hover:text-primary-500 dark:text-slate-400 dark:hover:text-primary-400 rounded-lg transition-all font-bold"
                          title="Replay Session"
                        >
                          <PlayCircle className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>

      </main>

    </div>
  );
};

export default PatientDashboard;
