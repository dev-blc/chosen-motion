import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchMySessions, fetchPatientProfile, fetchMyAssignments } from '@/services/api';
import type { ExerciseAssignment, MotionSession } from '@/types/api';
import { 
  Play, 
  Activity, 
  Clock, 
  LogOut, 
  Award,
  Calendar,
  History,
  FileSpreadsheet,
  Heart,
  Dumbbell,
  ChevronRight,
  BarChart3,
  PlayCircle,
  User,
  ShieldCheck,
  TrendingUp,
  Home,
  Target,
  Bell,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatisticCard, ExerciseCard } from '@/components/ui/Card';
import { 
  PageContainer, 
  Header, 
  ContentWrapper, 
  LoadingState,
  cn 
} from '@/components/layout/LayoutComponents';

interface ProgressData {
  label: string;
  rom: number;
  score: number;
}

const ProgressChart: React.FC<{ data: ProgressData[] }> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center border border-dashed border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg text-chosen-text-muted">
        <span className="text-xs">Not enough sessions to display analytics</span>
      </div>
    );
  }

  const width = 500;
  const height = 220;
  const padding = 40;
  
  const pointsROM = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / Math.max(1, data.length - 1);
    const y = height - padding - ((d.rom || 0) / 180) * (height - 2 * padding);
    return { x, y };
  });

  const pointsScore = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding)) / Math.max(1, data.length - 1);
    const y = height - padding - ((d.score || 0) / 100) * (height - 2 * padding);
    return { x, y };
  });

  const pathROM = pointsROM.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const pathScore = pointsScore.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
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
            className="text-[#E5E5E5] dark:text-[#2d3139]"
            strokeDasharray="4 4"
          />
        );
      })}
      {data.length > 1 && (
        <>
          <path d={pathROM} fill="none" stroke="#A27B41" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={pathScore} fill="none" stroke="#4F995E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {data.map((d, i) => {
        const pROM = pointsROM[i];
        const pScore = pointsScore[i];
        return (
          <g key={i}>
            <circle cx={pROM.x} cy={pROM.y} r="4.5" fill="#A27B41" stroke="#fff" strokeWidth="2" className="hover:scale-125 transition-all" />
            <title>{`ROM: ${d.rom}°`}</title>
            <circle cx={pScore.x} cy={pScore.y} r="4.5" fill="#4F995E" stroke="#fff" strokeWidth="2" className="hover:scale-125 transition-all" />
            <title>{`Form Accuracy: ${d.score}%`}</title>
            <text x={pROM.x} y={height - 12} textAnchor="middle" className="text-[9px] fill-chosen-text-muted font-bold">
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
  const [mobileTab, setMobileTab] = useState<'overview' | 'exercises' | 'progress' | 'profile'>('overview');
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

  const processedChartData: ProgressData[] = [...sessions]
    .slice(0, 7)
    .reverse()
    .map(s => ({
      label: new Date(s.completed_at || s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      rom: s.range_of_motion || 0,
      score: s.avg_score || 0
    }));

  if (loading) {
    return <LoadingState message="Loading your rehabilitation portal..." />;
  }

  // ==========================================
  // REDESIGNED COMPONENTS MAPPED TO FIGMA
  // ==========================================

  // 1. Greeting Header (Figma Frame 1360)
  const greetingHeader = (
    <div className="flex justify-between items-center w-full py-4 text-left select-none animate-fade-in">
      <div className="space-y-1">
        <span className="text-sm font-semibold text-[#A3A3A3] block uppercase tracking-wider">Good morning!</span>
        <h2 className="font-display font-bold text-xl text-[#0D0C18] dark:text-white leading-tight">
          {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : profile?.email}
        </h2>
      </div>
      <button 
        onClick={() => setMobileTab('profile')}
        className="h-11 w-11 rounded-full overflow-hidden border border-[#E5E5E5] dark:border-charcoal-800 transition-all hover:scale-105 hover:shadow-chosen-md active:scale-95 shrink-0"
        title="View Profile Settings"
      >
        <div className="h-full w-full bg-[#E6E6E6] dark:bg-charcoal-800 flex items-center justify-center text-chosen-text-secondary font-bold text-base uppercase">
          {profile?.firstName?.[0] || 'P'}
        </div>
      </button>
    </div>
  );

  // 2. Next Appointment Card (Figma Frame 1370)
  const docLastName = clinicalProfile?.assigned_admin?.user?.last_name || 'Carter';
  const docFirstName = clinicalProfile?.assigned_admin?.user?.first_name || 'David';
  const clinicName = clinicalProfile?.assigned_admin?.clinic_name || 'Chelsea Clinic';

  const nextAppointmentCard = (
    <div className="bg-ai-gradient dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-xl p-6 shadow-chosen-lg relative overflow-hidden text-left w-full transition-all duration-300 hover:shadow-chosen-xl hover:translate-y-[-1px] animate-fade-in">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 -mr-8 -mb-8 w-48 h-48 bg-[#A27B41]/5 rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-2xs font-bold uppercase tracking-widest text-[#525252] dark:text-slate-400">Next Appointment</span>
          <span className="text-[10px] bg-white/80 dark:bg-charcoal-800/80 border border-[#E5E5E5] dark:border-charcoal-700/50 px-2.5 py-1 rounded-full font-bold text-[#A27B41] shadow-sm select-none">
            In 3d
          </span>
        </div>
        
        <div>
          <h3 className="font-display font-bold text-lg md:text-xl text-[#0D0C18] dark:text-white leading-tight">
            Thursday, 19 Jun · 2:00 PM
          </h3>
        </div>

        {/* Divider line */}
        <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/60 my-2" />

        <div className="flex items-start gap-3">
          <div className="h-9 w-9 bg-white/70 dark:bg-charcoal-800/70 border border-[#E5E5E5] dark:border-charcoal-700 rounded-chosen-md flex items-center justify-center text-charcoal-500 dark:text-slate-300 shrink-0">
            <Heart className="h-4.5 w-4.5 text-red-500 fill-current" />
          </div>
          <div className="space-y-0.5">
            <span className="font-bold text-xs text-[#0D0C18] dark:text-white block">Dr. {docFirstName} {docLastName}</span>
            <span className="text-[10px] text-[#525252] dark:text-slate-400 block font-medium">Follow-up session · {clinicName}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[10px] text-[#A27B41] font-bold bg-[#A27B41]/10 px-2.5 py-1 rounded-full uppercase tracking-wider select-none flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 fill-current" /> Active supervision
          </span>
          <button 
            onClick={() => alert('Reschedule requested. Our patient coordinator will reach out shortly.')}
            className="px-4 py-2 bg-white dark:bg-charcoal-800 border border-[#E5E5E5] dark:border-charcoal-700 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-750 text-[#0D0C18] dark:text-white text-xs font-semibold rounded-chosen-md shadow-chosen-sm transition-all duration-150 active:scale-95"
          >
            Reschedule
          </button>
        </div>
      </div>
    </div>
  );

  // 3. Today's Workout Card (Figma Frame 1388)
  const completedCount = sessions.filter(s => {
    const compDate = new Date(s.completed_at || s.created_at).toDateString();
    const todayDate = new Date().toDateString();
    return compDate === todayDate;
  }).length;

  const totalExercises = assignments.length || 3;
  const progressPercent = Math.min(100, Math.round((completedCount / totalExercises) * 100));

  const todaysWorkoutCard = (
    <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-6 text-left space-y-4 shadow-chosen-sm hover:shadow-chosen-md transition-all duration-300 hover:translate-y-[-1px] animate-fade-in">
      <div className="flex justify-between items-center">
        <span className="text-2xs font-bold uppercase tracking-widest text-[#A27B41]">Today's Routine</span>
        <span className="text-[10px] bg-[#FAFBFC] border border-[#E5E5E5] dark:bg-charcoal-800 dark:border-charcoal-700 px-2.5 py-1 rounded-full font-bold text-chosen-text-secondary select-none">
          {totalExercises} exercises due
        </span>
      </div>

      <div className="space-y-1">
        <h4 className="font-display font-bold text-base text-[#0D0C18] dark:text-white leading-tight">
          Progress Overview
        </h4>
        <span className="text-xs text-[#A3A3A3] block font-medium">
          {completedCount} of {totalExercises} completed
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-2 bg-[#F5F5F5] dark:bg-charcoal-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#A27B41] rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-chosen-text-muted font-bold">
          <span>0%</span>
          <span>{progressPercent}% Complete</span>
          <span>100%</span>
        </div>
      </div>

      <div className="pt-2">
        {assignments.length > 0 ? (
          <Button
            variant="primary"
            className="w-full flex items-center justify-center gap-2 font-bold py-3 text-sm btn-primary"
            onClick={() => navigate('/tracker', { state: { exerciseName: assignments[0].exercise?.name, rules: assignments[0].exercise?.rules } })}
            leftIcon={<Play className="h-4 w-4 fill-current" />}
          >
            Start Workout Session
          </Button>
        ) : (
          <Button
            variant="primary"
            className="w-full flex items-center justify-center gap-2 font-bold py-3 text-sm btn-primary"
            onClick={() => navigate('/tracker')}
            leftIcon={<Play className="h-4 w-4 fill-current" />}
          >
            Quick Practice Session
          </Button>
        )}
      </div>
    </div>
  );

  // 4. Quick Start calibration card for left column (Desktop only)
  const quickStartCard = (
    <div className="bg-[#141414] dark:bg-[#121122] text-white rounded-chosen-lg p-6 text-left space-y-4 shadow-chosen-lg relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-[#A27B41]/10 rounded-full blur-xl pointer-events-none" />
      <div className="space-y-1">
        <h4 className="font-display font-bold text-base text-white leading-tight">
          Ready for a Practice Session?
        </h4>
        <p className="text-xs text-slate-300">
          Launch the tracking system in training mode to calibrate camera and test your body positions.
        </p>
      </div>
      <button 
        onClick={() => navigate('/tracker')}
        className="w-full py-2.5 bg-white text-[#141414] hover:bg-[#F5F5F5] font-bold text-xs rounded-chosen-md shadow-chosen-sm transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
      >
        <Activity className="h-4 w-4" /> Start Calibration Practice
      </button>
    </div>
  );

  // 5. Quick Actions Panel card (Desktop only)
  const quickActionsCard = (
    <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-6 space-y-4 text-left shadow-chosen-sm">
      <div>
        <h3 className="font-display font-bold text-base text-chosen-text-primary">
          Quick Actions
        </h3>
        <p className="text-xs text-chosen-text-muted mt-1">Common tasks and portal settings shortcuts</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <button 
          onClick={() => {
            if (assignments.length > 0) {
              navigate('/tracker', { state: { exerciseName: assignments[0].exercise?.name, rules: assignments[0].exercise?.rules } });
            } else {
              navigate('/tracker');
            }
          }}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 hover:border-gold-500/30 rounded-chosen-md text-xs font-semibold transition-all hover:translate-x-0.5"
        >
          <span className="flex items-center gap-2">
            <Play className="h-4 w-4 text-[#A27B41]" /> Start Active Session
          </span>
          <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
        </button>
        <button 
          onClick={() => setMobileTab('exercises')}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 hover:border-gold-500/30 rounded-chosen-md text-xs font-semibold transition-all hover:translate-x-0.5"
        >
          <span className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-[#A27B41]" /> View Treatment Plan
          </span>
          <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
        </button>
        <button 
          onClick={() => navigate('/tracker')}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 hover:border-gold-500/30 rounded-chosen-md text-xs font-semibold transition-all hover:translate-x-0.5"
        >
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#A27B41]" /> Open Camera Tracker
          </span>
          <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
        </button>
        <button 
          onClick={() => setMobileTab('profile')}
          className="w-full flex items-center justify-between px-4 py-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 hover:border-gold-500/30 rounded-chosen-md text-xs font-semibold transition-all hover:translate-x-0.5"
        >
          <span className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#A27B41]" /> Open Portal Settings
          </span>
          <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
        </button>
      </div>
    </div>
  );

  // 6. Clinical treatment plan diagnostics card
  const clinicalProfileBanner = clinicalProfile?.diagnosis && (
    <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-[#A27B41] text-left shadow-chosen-sm animate-fade-in">
      <div>
        <span className="text-2xs font-bold text-[#A27B41] uppercase tracking-wider">Treatment Plan diagnosis</span>
        <p className="font-bold text-chosen-text-primary text-sm mt-1">{clinicalProfile.diagnosis}</p>
      </div>
      <div className="text-xs shrink-0">
        <span className="text-chosen-text-muted block text-2xs font-bold uppercase tracking-wider">Supervising Clinician</span>
        <span className="font-bold text-[#0D0C18] dark:text-white flex items-center gap-1.5 mt-0.5">
          <Heart className="h-4 w-4 text-red-500 fill-current animate-pulse" />
          Dr. {docFirstName} {docLastName}
        </span>
      </div>
    </div>
  );

  // 7. General statistics row
  const statsRow = (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 w-full animate-fade-in">
      <StatisticCard
        label="Sessions Done"
        value={sessions.length}
        icon={<Calendar className="h-5 w-5 text-[#A27B41]" />}
        iconBg="bg-[#A27B41]/10 text-[#A27B41]"
      />
      <StatisticCard
        label="Avg Form Accuracy"
        value={`${avgAccuracy}%`}
        icon={<Award className="h-5 w-5 text-[#A27B41]" />}
        iconBg="bg-[#A27B41]/10 text-[#A27B41]"
      />
      <StatisticCard
        label="Practice Time"
        value={`${Math.round(totalDuration / 60)}m`}
        icon={<Clock className="h-5 w-5 text-[#A27B41]" />}
        iconBg="bg-[#A27B41]/10 text-[#A27B41]"
      />
    </div>
  );

  // 8. Exercises Grid component
  const exercisesGrid = (
    <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-6 space-y-6 text-left shadow-chosen-sm animate-fade-in">
      <div>
        <h3 className="font-display font-bold text-base text-chosen-text-primary flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-chosen-text-muted" />
          Prescribed Rehabilitation Exercises
        </h3>
        <p className="text-xs text-chosen-text-muted mt-1">Exercises prescribed specifically for your rehab program</p>
      </div>
      {assignments.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-[#E5E5E5] dark:border-charcoal-850 rounded-chosen-lg text-chosen-text-muted">
          <Dumbbell className="h-10 w-10 mx-auto text-charcoal-350 dark:text-charcoal-600 mb-3 animate-bounce" />
          <p className="font-bold text-sm text-chosen-text-primary">No exercises assigned yet.</p>
          <p className="text-xs mt-1">Your clinician will assign exercise templates shortly.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {assignments.map((assignment) => {
            const ex = assignment.exercise;
            if (!ex) return null;
            return (
              <ExerciseCard
                key={assignment.id}
                name={ex.name}
                thumbnailUrl={ex.thumbnail_url || undefined}
                targetRom={ex.target_rom || undefined}
                description={ex.description || undefined}
                instructions={ex.instructions || undefined}
                actionButton={
                  <Button
                    variant="secondary"
                    className="w-full flex items-center justify-center gap-2 font-bold py-2 hover:bg-gold-500/10 hover:text-[#A27B41]"
                    onClick={() => navigate('/tracker', { state: { exerciseName: ex.name, rules: ex.rules } })}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" /> Start Exercise
                  </Button>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );

  // 9. Progress Analytics SVG container card
  const progressAnalytics = (
    <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-6 space-y-6 text-left shadow-chosen-sm animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-display font-bold text-base text-chosen-text-primary flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-chosen-text-muted" />
            Recovery Progress Analytics
          </h3>
          <p className="text-xs text-chosen-text-muted mt-1">Range of Motion (ROM) & alignment scores trends</p>
        </div>
        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider self-start sm:self-auto select-none">
          <span className="flex items-center gap-1.5 text-[#A27B41]">
            <span className="h-2.5 w-2.5 bg-[#A27B41] rounded-full inline-block" />
            ROM Achieved (°)
          </span>
          <span className="flex items-center gap-1.5 text-[#4F995E]">
            <span className="h-2.5 w-2.5 bg-[#4F995E] rounded-full inline-block" />
            Accuracy Score (%)
          </span>
        </div>
      </div>
      <div className="bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-lg p-6 relative">
        <ProgressChart data={processedChartData} />
      </div>
    </div>
  );

  // 10. Upcoming Sessions schedule component
  const upcomingSchedule = (
    <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-6 space-y-6 text-left shadow-chosen-sm animate-fade-in">
      <div>
        <h3 className="font-display font-bold text-base text-chosen-text-primary flex items-center gap-2">
          <Calendar className="h-4.5 w-4.5 text-chosen-text-muted" />
          Upcoming Sessions Schedule
        </h3>
        <p className="text-[10px] text-chosen-text-muted mt-1">Assigned workouts due shortly</p>
      </div>
      {assignments.length === 0 ? (
        <div className="p-4 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-md flex gap-2.5 items-start">
          <ShieldCheck className="h-4.5 w-4.5 text-[#4F995E] shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-chosen-text-primary block">No Assigned Exercises</span>
            <span className="text-[10px] text-chosen-text-muted mt-0.5 block">Your clinician will assign exercises to your program.</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="p-4 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/60 rounded-chosen-md flex justify-between items-center hover:border-gold-500/30 transition-all hover:translate-y-[-1px]">
              <div className="space-y-1 min-w-0">
                <span className="font-bold text-xs text-chosen-text-primary block truncate">
                  {assignment.exercise?.name}
                </span>
                <span className="text-[10px] text-chosen-text-muted flex items-center gap-1 font-semibold">
                  <Clock className="h-3 w-3 shrink-0" />
                  Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'Today'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => navigate('/tracker', { state: { exerciseName: assignment.exercise?.name, rules: assignment.exercise?.rules } })}
                leftIcon={<ChevronRight className="h-4.5 w-4.5 text-[#A27B41]" />}
                title="Start workout"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // 11. Completed practice logs history component
  const practiceLogsHistory = (
    <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-6 space-y-6 text-left shadow-chosen-sm animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base text-chosen-text-primary flex items-center gap-2">
            <History className="h-4.5 w-4.5 text-chosen-text-muted" />
            Completed Practice Logs
          </h3>
          <p className="text-[10px] text-chosen-text-muted mt-1">Logs of completed rehab exercises</p>
        </div>
        <button 
          onClick={() => alert('Feature coming soon: Telemetry CSV exported.')}
          className="text-xs font-bold text-[#A27B41] hover:underline flex items-center gap-0.5"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className="text-xs text-chosen-text-muted text-center py-4">No sessions recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between p-3.5 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/60 rounded-chosen-md hover:translate-x-0.5 transition-all text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-8 w-8 bg-[#FAFBFC] dark:bg-charcoal-850 text-[#A27B41] border border-chosen rounded-chosen-md flex items-center justify-center font-bold shrink-0">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0 text-left">
                  <h5 className="font-bold text-chosen-text-primary block truncate max-w-[120px]">
                    {session.title || 'Workout'}
                  </h5>
                  <span className="text-[9px] text-chosen-text-muted block mt-0.5 font-mono font-semibold">
                    {new Date(session.completed_at || session.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="font-bold text-chosen-text-primary block">
                    {session.avg_score || session.score}% Form
                  </span>
                  <span className="text-[9px] text-chosen-text-muted block mt-0.5 font-mono font-semibold">
                    {Math.round(session.range_of_motion || 0)}° ROM | {session.duration_seconds || 0}s
                  </span>
                </div>
                <button
                  onClick={() => navigate(`/patient/session/${session.id}`)}
                  className="p-1.5 bg-[#F5F5F5] hover:bg-gold-500/10 dark:bg-charcoal-800 dark:hover:bg-charcoal-700 text-charcoal-500 hover:text-[#A27B41] rounded-chosen-sm transition-all"
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
  );

  // 12. Redesigned Profile view matching Figma screen details
  const profileMenuItems = [
    { id: 'personal', title: 'Personal Information', description: 'Name, email, and diagnostic information', icon: <User className="h-4.5 w-4.5" /> },
    { id: 'account', title: 'Account Settings', description: 'Manage credentials and account status', icon: <ShieldCheck className="h-4.5 w-4.5" /> },
    { id: 'notifications', title: 'Notification Preferences', description: 'Configure workout reminders and alerts', icon: <Bell className="h-4.5 w-4.5" /> },
    { id: 'privacy', title: 'Privacy & Security', description: 'Manage data sharing and local storage', icon: <ShieldCheck className="h-4.5 w-4.5" /> },
    { id: 'help', title: 'Help & Support', description: 'Contact support team or view FAQs', icon: <Info className="h-4.5 w-4.5" /> },
    { id: 'about', title: 'About Chosen Life', description: 'Version 1.0.0 · Licensing and terms', icon: <Info className="h-4.5 w-4.5" /> },
  ];

  const mobileProfileTab = (
    <div className="space-y-6 text-left animate-slide-up pb-10">
      {/* Figma Ellipse 23 & Frame 1480 */}
      <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-6 flex flex-col items-center text-center space-y-4 shadow-chosen-sm">
        <div className="h-20 w-20 rounded-full bg-[#D9D9D9] dark:bg-charcoal-800 border-2 border-white dark:border-charcoal-700 shadow-chosen-md flex items-center justify-center font-bold text-2xl text-[#0D0C18] dark:text-white uppercase select-none">
          {profile?.firstName?.[0] || 'P'}
        </div>
        <div className="space-y-1">
          <h3 className="font-display font-bold text-lg text-[#0D0C18] dark:text-white leading-tight">
            {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : profile?.email}
          </h3>
          <span className="text-xs text-[#9F9F9F] font-bold block">
            Patient since 04 Jun
          </span>
        </div>
      </div>

      {/* Figma settings entries using Rate Item layout with chevrons */}
      <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-4 space-y-2 shadow-chosen-sm">
        {profileMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => alert(`Settings page requested: ${item.title}`)}
            className="w-full flex items-center justify-between p-3 hover:bg-[#FAFBFC] dark:hover:bg-charcoal-900 rounded-chosen-md transition-all group"
          >
            <div className="flex items-start gap-3.5 text-left">
              <div className="p-2 bg-gold-500/10 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center group-hover:scale-105 transition-all">
                {item.icon}
              </div>
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-[#212121] dark:text-white block group-hover:text-[#A27B41] transition-colors">
                  {item.title}
                </span>
                <span className="text-[10px] text-[#626262] dark:text-slate-400 block font-medium leading-relaxed">
                  {item.description}
                </span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-chosen-text-muted group-hover:translate-x-0.5 transition-all" />
          </button>
        ))}

        <div className="border-t border-[#F5F5F5] dark:border-charcoal-850 my-2" />

        {/* Logout checklist row */}
        <button
          onClick={signOut}
          className="w-full flex items-center justify-between p-3 hover:bg-red-500/5 dark:hover:bg-red-950/10 rounded-chosen-md transition-all group"
        >
          <div className="flex items-start gap-3.5 text-left">
            <div className="p-2 bg-red-500/10 text-red-500 rounded-chosen-md shrink-0 flex items-center justify-center">
              <LogOut className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-bold text-xs text-red-500 block">
                Logout
              </span>
              <span className="text-[10px] text-red-500/70 block font-medium">
                Sign out and end session
              </span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-red-500/50 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>
    </div>
  );

  // 13. Floating bottom navigation matching Figma Frame 1381 bar dimensions
  const bottomNavigation = (
    <div className="fixed bottom-3 left-4 right-4 h-16 bg-[#0D0C18] border border-white/5 px-4 flex justify-between items-center z-30 shadow-[0_8px_30px_rgb(0,0,0,0.35)] rounded-[12px]">
      <button 
        onClick={() => setMobileTab('overview')} 
        className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'overview' ? "text-[#A27B41]" : "text-[#A3A3A3]")}
      >
        <Home className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
      </button>
      <button 
        onClick={() => setMobileTab('exercises')} 
        className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'exercises' ? "text-[#A27B41]" : "text-[#A3A3A3]")}
      >
        <FileSpreadsheet className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">My Plan</span>
      </button>
      <button 
        onClick={() => setMobileTab('progress')} 
        className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'progress' ? "text-[#A27B41]" : "text-[#A3A3A3]")}
      >
        <Target className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Move</span>
      </button>
      <button 
        onClick={() => setMobileTab('profile')} 
        className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'profile' ? "text-[#A27B41]" : "text-[#A3A3A3]")}
      >
        <User className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Profile</span>
      </button>
    </div>
  );

  return (
    <PageContainer
      header={
        <Header
          title="Chosen Life"
          subtitle="Patient Companion"
          profileName={profile?.firstName ? `${profile.firstName} ${profile.lastName}` : profile?.email}
          profileRole="Patient Profile"
          onSignOut={signOut}
          logo={<Activity className="h-5 w-5" />}
        />
      }
      bottomNav={bottomNavigation}
      className="pb-24 md:pb-0"
    >
      <ContentWrapper>
        {/* Desktop Layout (>1024px) - 3-column dashboard */}
        <div className="hidden lg:grid grid-cols-3 gap-8 text-left items-start">
          {/* Left Column: Today's Workout, Assigned Exercises, Quick Start */}
          <div className="space-y-8">
            {greetingHeader}
            {todaysWorkoutCard}
            {exercisesGrid}
            {quickStartCard}
          </div>
          {/* Middle Column: Next Appointment, Upcoming Schedule */}
          <div className="space-y-8">
            {nextAppointmentCard}
            {clinicalProfileBanner}
            {upcomingSchedule}
          </div>
          {/* Right Column: Recovery Progress, Recent Activity, Quick Actions */}
          <div className="space-y-8">
            {statsRow}
            {progressAnalytics}
            {practiceLogsHistory}
            {quickActionsCard}
          </div>
        </div>

        {/* Tablet Layout (768px-1024px) - 2-column dashboard */}
        <div className="hidden md:block lg:hidden space-y-8 text-left">
          {greetingHeader}
          {clinicalProfileBanner}
          <div className="grid grid-cols-2 gap-8 items-start">
            <div className="space-y-8">
              {todaysWorkoutCard}
              {exercisesGrid}
              {statsRow}
              {quickStartCard}
            </div>
            <div className="space-y-8">
              {nextAppointmentCard}
              {progressAnalytics}
              {upcomingSchedule}
              {practiceLogsHistory}
            </div>
          </div>
        </div>

        {/* Mobile Layout (<768px) - Tabbed view */}
        <div className="block md:hidden space-y-6">
          {mobileTab === 'overview' && (
            <div className="space-y-6 text-left animate-slide-up">
              {greetingHeader}
              {clinicalProfileBanner}
              {nextAppointmentCard}
              {todaysWorkoutCard}
              {statsRow}
            </div>
          )}
          {mobileTab === 'exercises' && (
            <div className="animate-slide-up">
              {exercisesGrid}
            </div>
          )}
          {mobileTab === 'progress' && (
            <div className="space-y-6 text-left animate-slide-up">
              {progressAnalytics}
              {practiceLogsHistory}
            </div>
          )}
          {mobileTab === 'profile' && mobileProfileTab}
        </div>
      </ContentWrapper>
    </PageContainer>
  );
};

export default PatientDashboard;

