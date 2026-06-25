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
  ChevronRight,
  BarChart3,
  PlayCircle,
  User,
  ShieldCheck,
  TrendingUp,
  Home,
  Target,
  Settings,
  Bell,
  Info,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatisticCard } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
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

  const calculateStreak = () => {
    if (!sessions || sessions.length === 0) return 0;
    const completedDates = sessions.map(s => {
      const d = new Date(s.completed_at || s.created_at);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const uniqueDates = Array.from(new Set(completedDates))
      .map(dateStr => new Date(dateStr + 'T00:00:00'))
      .sort((a, b) => b.getTime() - a.getTime());

    if (uniqueDates.length === 0) return 0;

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const mostRecent = uniqueDates[0];
    if (mostRecent.getTime() !== today.getTime() && mostRecent.getTime() !== yesterday.getTime()) {
      return 0;
    }

    let currentRef = mostRecent;
    streak = 1;

    for (let i = 1; i < uniqueDates.length; i++) {
      const nextDate = uniqueDates[i];
      const expectedDate = new Date(currentRef);
      expectedDate.setDate(expectedDate.getDate() - 1);
      if (nextDate.getTime() === expectedDate.getTime()) {
        streak++;
        currentRef = nextDate;
      } else {
        break;
      }
    }
    return streak;
  };

  const currentStreak = calculateStreak();

  const getExerciseMetadata = (name: string) => {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes('hinge')) {
      return {
        sets: 3,
        reps: 12,
        rest: '45s',
        difficulty: 'Medium',
        duration: '8 mins',
        bodyPart: 'Hips & Lower Back',
        category: 'Hip Mobility'
      };
    } else if (lowercaseName.includes('clamshell')) {
      return {
        sets: 3,
        reps: 15,
        rest: '45s',
        difficulty: 'Light',
        duration: '6 mins',
        bodyPart: 'Outer Hips & Glutes',
        category: 'Glute Activation'
      };
    } else if (lowercaseName.includes('glute') || lowercaseName.includes('bridge')) {
      return {
        sets: 3,
        reps: 12,
        rest: '30s',
        difficulty: 'Light',
        duration: '5 mins',
        bodyPart: 'Gluteus Maximus',
        category: 'Strength'
      };
    }
    return {
      sets: 3,
      reps: 10,
      rest: '30s',
      difficulty: 'Light',
      duration: '5 mins',
      bodyPart: 'Lower Body',
      category: 'Rehabilitation'
    };
  };

  const getDaysOfWeek = (refDate: Date) => {
    const days = [];
    const start = new Date(refDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);

    for (let i = 0; i < 7; i++) {
      days.push(new Date(start));
      start.setDate(start.getDate() + 1);
    }
    return days;
  };

  const daysOfWeek = getDaysOfWeek(new Date());

  if (loading) {
    return <LoadingState message="Loading your rehabilitation portal..." />;
  }

  const docLastName = clinicalProfile?.assigned_admin?.user?.last_name || 'Carter';
  const docFirstName = clinicalProfile?.assigned_admin?.user?.first_name || 'David';
  const clinicName = clinicalProfile?.assigned_admin?.clinic_name || 'Chelsea Clinic';

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

  const statsRow = (
    <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-1 gap-4 md:gap-6 w-full animate-fade-in">
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

  const calendarRow = (
    <div className="flex items-center gap-1.5 w-full overflow-x-auto py-2 select-none select-none scrollbar-none animate-fade-in">
      {daysOfWeek.map((date, idx) => {
        const isSelected = date.toDateString() === selectedDate.toDateString();
        const isToday = date.toDateString() === new Date().toDateString();
        
        const dayAssignments = assignments.filter(a => {
          if (!a.due_date) return new Date().toDateString() === date.toDateString();
          return new Date(a.due_date).toDateString() === date.toDateString();
        });
        const isDayDone = dayAssignments.length > 0 && dayAssignments.every(a => a.is_completed);

        return (
          <button
            key={idx}
            onClick={() => setSelectedDate(date)}
            className={cn(
              "flex flex-col items-center justify-between p-2.5 rounded-chosen-md w-12 h-14 shrink-0 transition-all duration-200 active:scale-90",
              isSelected 
                ? "bg-[#DFCFAC] dark:bg-charcoal-700 border border-[#A27B41] text-[#724F2E] dark:text-white shadow-sm"
                : isToday
                  ? "bg-[#A27B41]/10 border border-[#A27B41]/35 text-[#A27B41]"
                  : "bg-[#F5F5F5] dark:bg-charcoal-800 text-chosen-text-secondary hover:bg-[#E6E6E6] dark:hover:bg-charcoal-750"
            )}
          >
            <span className={cn(
              "text-[9px] font-bold uppercase tracking-wider",
              isSelected ? "text-[#8F6738] dark:text-slate-300" : "text-chosen-text-muted"
            )}>
              {date.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3)}
            </span>
            <span className="text-sm font-bold block mt-0.5 leading-none">
              {date.getDate()}
            </span>
            {isDayDone && (
              <span className="h-1.5 w-1.5 bg-[#4F995E] rounded-full mt-0.5" />
            )}
          </button>
        );
      })}
    </div>
  );

  const desktopCalendar = (
    <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 shadow-chosen-sm text-left">
      <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white mb-4">Select Plan Date</h3>
      <div className="flex flex-col gap-2">
        {daysOfWeek.map((date, idx) => {
          const isSelected = date.toDateString() === selectedDate.toDateString();
          const isToday = date.toDateString() === new Date().toDateString();
          
          const dayAssignments = assignments.filter(a => {
            if (!a.due_date) return new Date().toDateString() === date.toDateString();
            return new Date(a.due_date).toDateString() === date.toDateString();
          });
          const isDayDone = dayAssignments.length > 0 && dayAssignments.every(a => a.is_completed);

          return (
            <button
              key={idx}
              onClick={() => setSelectedDate(date)}
              className={cn(
                "flex items-center justify-between p-3.5 rounded-chosen-md w-full transition-all duration-200 active:scale-[0.98] border text-left",
                isSelected 
                  ? "bg-[#DFCFAC] dark:bg-charcoal-700 border-[#A27B41] text-[#724F2E] dark:text-white shadow-sm"
                  : isToday
                    ? "bg-[#A27B41]/10 border-[#A27B41]/35 text-[#A27B41]"
                    : "bg-[#FAFBFC] dark:bg-charcoal-900 border-[#E5E5E5] dark:border-charcoal-800 text-chosen-text-secondary hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800"
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold block leading-none w-6 text-center">
                  {date.getDate()}
                </span>
                <div className="flex flex-col">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider",
                    isSelected ? "text-[#8F6738] dark:text-slate-300" : "text-chosen-text-muted"
                  )}>
                    {date.toLocaleDateString(undefined, { weekday: 'long' })}
                  </span>
                  <span className="text-[10px] text-chosen-text-muted mt-0.5">
                    {dayAssignments.length} {dayAssignments.length === 1 ? 'exercise' : 'exercises'}
                  </span>
                </div>
              </div>
              {isDayDone ? (
                <span className="h-5 w-5 rounded-full bg-[#4F995E]/15 text-[#4F995E] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
              ) : dayAssignments.length > 0 ? (
                <span className="h-2 w-2 bg-[#A27B41] rounded-full shrink-0" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const assignmentsForDay = assignments.filter(a => {
    if (!a.due_date) return new Date().toDateString() === selectedDate.toDateString();
    return new Date(a.due_date).toDateString() === selectedDate.toDateString();
  });

  const completedForDay = assignmentsForDay.filter(a => a.is_completed).length;
  const totalForDay = assignmentsForDay.length;
  const progressPercentForDay = totalForDay > 0 ? Math.round((completedForDay / totalForDay) * 100) : 0;

  const radius = 28;
  const strokeWidth = 5;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercentForDay / 100) * circumference;

  const progressRingCard = (
    <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 text-left flex items-center justify-between gap-4 shadow-chosen-sm hover:shadow-chosen-md transition-all duration-300 animate-fade-in">
      <div className="space-y-1.5 min-w-0">
        <span className="text-2xs font-bold uppercase tracking-widest text-[#A27B41]">Day Progress Summary</span>
        <h4 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white truncate">
          {completedForDay} of {totalForDay} Completed
        </h4>
        <span className="text-[10px] text-chosen-text-secondary block font-medium">
          Daily Goal: {totalForDay} Exercises Prescribed
        </span>
      </div>
      
      <div className="relative shrink-0 flex items-center justify-center h-16 w-16 select-none">
        <svg className="transform -rotate-90 w-full h-full">
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-[#F5F5F5] dark:text-charcoal-800"
          />
          <circle
            cx="32"
            cy="32"
            r={radius}
            stroke="#A27B41"
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <span className="absolute text-[10px] font-bold text-chosen-text-primary">
          {progressPercentForDay}%
        </span>
      </div>
    </div>
  );

  const practitionerNotesCard = (
    <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-5 text-left space-y-3.5 shadow-chosen-sm animate-fade-in">
      <div className="flex items-center gap-2.5">
        <div className="h-8 w-8 bg-[#FAFBFC] dark:bg-charcoal-800 rounded-full flex items-center justify-center text-charcoal-500">
          <Heart className="h-4.5 w-4.5 text-red-500 fill-current" />
        </div>
        <div>
          <h4 className="font-display font-bold text-xs text-chosen-text-primary">
            Practitioner Instructions
          </h4>
          <span className="text-[9px] text-[#9F9F9F] font-medium block">
            Dr. {docFirstName} {docLastName}
          </span>
        </div>
      </div>
      <div className="text-[11px] bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/60 p-3 rounded-chosen-md text-chosen-text-secondary italic leading-relaxed">
        "Ensure you carry out the prescribed exercises slow and concentrate on matching the range of motion targets. Rest sufficiently between reps."
      </div>
    </div>
  );

  const renderMyPlanExercises = () => {
    if (totalForDay === 0) {
      return (
        <div className="text-center py-10 px-6 border border-dashed border-chosen rounded-chosen-lg bg-[#FAFBFC] dark:bg-charcoal-850/30 text-chosen-text-muted flex flex-col items-center justify-center gap-3 animate-fade-in">
          <Calendar className="h-8 w-8 mx-auto text-charcoal-400 dark:text-charcoal-600 animate-pulse" />
          <p className="font-bold text-xs text-chosen-text-primary">No Exercises Scheduled</p>
          <p className="text-[10px] text-chosen-text-secondary max-w-xs mx-auto leading-relaxed">
            There are no prescribed exercises due on {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.
          </p>
          <Button 
            variant="secondary"
            className="mt-1 font-bold text-[10px] py-1.5 px-3"
            onClick={() => setSelectedDate(new Date())}
          >
            Go to Today
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {completedForDay === totalForDay && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/30 text-emerald-850 dark:text-emerald-400 rounded-chosen-md flex items-center gap-2.5 text-left text-[11px] font-semibold animate-fade-in">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-500 fill-current shrink-0" />
            <span>Fantastic! You have completed all of your scheduled exercises for today.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-6">
          {assignmentsForDay.map((assignment) => {
            const ex = assignment.exercise;
            if (!ex) return null;
            const meta = getExerciseMetadata(ex.name);
            return (
              <div 
                key={assignment.id} 
                className="flex flex-col lg:flex-row border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl bg-[#FAFBFC] dark:bg-charcoal-850 overflow-hidden shadow-chosen-sm hover:shadow-chosen-md hover:border-gold-500/30 transition-all duration-300 text-left animate-fade-in group"
              >
                <div className="relative shrink-0">
                  <img
                    src={ex.thumbnail_url || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=300'}
                    alt={ex.name}
                    className="h-28 w-full lg:h-full lg:w-44 object-cover border-b lg:border-b-0 lg:border-r border-[#E5E5E5] dark:border-charcoal-800"
                  />
                  <div className="absolute top-2.5 right-2.5">
                    <Badge variant="info" styleType="solid">ROM: {ex.target_rom || 120}°</Badge>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <h4 className="font-display font-bold text-slate-900 dark:text-white text-sm truncate leading-snug">
                          {ex.name}
                        </h4>
                        <span className="text-[9px] text-[#A27B41] font-bold uppercase tracking-wider block">
                          {meta.category}
                        </span>
                      </div>
                      <div className="lg:hidden">
                        {assignment.is_completed ? (
                          <Badge variant="success">Completed</Badge>
                        ) : (
                          <Badge variant="neutral">Pending</Badge>
                        )}
                      </div>
                    </div>
 
                    <div className="grid grid-cols-3 gap-2 py-2 border-y border-[#F5F5F5] dark:border-charcoal-800/80 text-[10px] text-chosen-text-secondary font-medium">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[9px] text-chosen-text-muted block font-semibold uppercase tracking-wider truncate">Target Area</span>
                        <span className="truncate block font-bold text-slate-800 dark:text-slate-300">{meta.bodyPart}</span>
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[9px] text-chosen-text-muted block font-semibold uppercase tracking-wider truncate">Difficulty</span>
                        <span className="truncate block font-bold text-slate-800 dark:text-slate-300">{meta.difficulty}</span>
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[9px] text-chosen-text-muted block font-semibold uppercase tracking-wider truncate">Duration</span>
                        <span className="truncate block font-bold text-slate-800 dark:text-slate-300">{meta.duration}</span>
                      </div>
                    </div>
 
                    <div className="flex gap-4 text-[10px] font-bold text-chosen-text-muted select-none">
                      <span>Sets: <span className="text-[#A27B41]">{meta.sets}</span></span>
                      <span>Reps: <span className="text-[#A27B41]">{meta.reps}</span></span>
                      <span>Rest: <span className="text-[#A27B41]">{meta.rest}</span></span>
                    </div>
 
                    {ex.instructions && (
                      <div className="text-[10px] bg-chosen-surface border border-chosen p-2.5 rounded-chosen-md text-chosen-text-secondary italic leading-relaxed">
                        "{ex.instructions}"
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col lg:items-end justify-center gap-4 shrink-0 lg:border-l lg:border-[#F5F5F5] dark:lg:border-charcoal-800/80 lg:pl-6 lg:min-w-[160px] w-full lg:w-auto">
                    <div className="hidden lg:block">
                      {assignment.is_completed ? (
                        <Badge variant="success" styleType="soft">Completed</Badge>
                      ) : (
                        <Badge variant="neutral" styleType="soft">Pending</Badge>
                      )}
                    </div>

                    <div className="flex lg:flex-col gap-2 w-full pt-1.5 lg:pt-0">
                      <Button
                        variant="primary"
                        className="flex-1 flex items-center justify-center gap-1.5 font-bold py-2 text-xs btn-primary shadow-sm w-full"
                        onClick={() => navigate('/tracker', { state: { exerciseName: ex.name, rules: ex.rules } })}
                      >
                        <Play className="h-3 w-3 fill-current" /> Start
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1 flex items-center justify-center gap-1.5 font-bold py-2 text-xs hover:bg-gold-500/10 hover:text-[#A27B41] w-full"
                        onClick={() => alert(`Rehab Instructions:\n${ex.instructions || 'Standard recovery motions'}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const mobileProfileTab = (
    <div className="space-y-6 text-left animate-slide-up pb-10">
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

      <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-4 space-y-2 shadow-chosen-sm">
        {/* Profile Menu Items */}
        <button onClick={() => alert('Personal Information settings opening...')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
              <User className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-[#212121] dark:text-white block">Personal Information</span>
              <span className="text-xs text-[#626262] dark:text-chosen-text-muted block">Manage your name, date of birth, and email</span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button onClick={() => alert('Account Settings opening...')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
              <Settings className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-[#212121] dark:text-white block">Account Settings</span>
              <span className="text-xs text-[#626262] dark:text-chosen-text-muted block">Update passwords and linked clinic credentials</span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button onClick={() => alert('Notification Preferences opening...')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-[#212121] dark:text-white block">Notification Preferences</span>
              <span className="text-xs text-[#626262] dark:text-chosen-text-muted block">Configure workout reminders and updates</span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button onClick={() => alert('Privacy & Security opening...')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-[#212121] dark:text-white block">Privacy & Security</span>
              <span className="text-xs text-[#626262] dark:text-chosen-text-muted block">Manage clinic data consent and HIPAA rules</span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button onClick={() => alert('Help & Support opening...')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
              <Info className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-[#212121] dark:text-white block">Help & Support</span>
              <span className="text-xs text-[#626262] dark:text-chosen-text-muted block">Contact your clinic or read instructions</span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <button onClick={() => alert('About Chosen Life opening...')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
              <Activity className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-[#212121] dark:text-white block">About Chosen Life</span>
              <span className="text-xs text-[#626262] dark:text-chosen-text-muted block">Version 1.2.0 · Platform Terms & Rules</span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
        </button>

        <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/80 my-2" />

        <button onClick={signOut} className="w-full flex items-center justify-between p-3 hover:bg-red-500/5 dark:hover:bg-red-950/10 rounded-chosen-md transition-all group text-left">
          <div className="flex items-center gap-3.5">
            <div className="p-2 bg-red-500/10 text-red-500 rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
              <LogOut className="h-4.5 w-4.5" />
            </div>
            <div className="space-y-0.5">
              <span className="font-semibold text-sm text-red-500 block">Logout</span>
              <span className="text-xs text-red-500/70 block font-normal">Sign out of your active rehabilitation portal session</span>
            </div>
          </div>
          <ChevronRight className="h-4.5 w-4.5 text-red-500 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );

  const bottomNavigation = (
    <div className="fixed bottom-3 left-4 right-4 h-16 bg-[#0D0C18] border border-white/5 px-4 flex justify-between items-center z-30 shadow-[0_8px_30px_rgb(0,0,0,0.35)] rounded-[12px]">
      <button onClick={() => setMobileTab('overview')} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'overview' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
        <Home className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
      </button>
      <button onClick={() => setMobileTab('exercises')} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'exercises' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
        <FileSpreadsheet className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">My Plan</span>
      </button>
      <button onClick={() => setMobileTab('progress')} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'progress' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
        <Target className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Move</span>
      </button>
      <button onClick={() => setMobileTab('profile')} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'profile' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
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
        >
          <div className="hidden lg:flex items-center gap-6 text-sm font-semibold select-none">
            <button onClick={() => setMobileTab('overview')} className={cn("pb-1 transition-all border-b-2 hover:text-[#A27B41]", mobileTab === 'overview' ? "border-[#A27B41] text-[#A27B41] font-bold" : "border-transparent text-chosen-text-muted")}>Home</button>
            <button onClick={() => setMobileTab('exercises')} className={cn("pb-1 transition-all border-b-2 hover:text-[#A27B41]", mobileTab === 'exercises' ? "border-[#A27B41] text-[#A27B41] font-bold" : "border-transparent text-chosen-text-muted")}>My Plan</button>
            <button onClick={() => setMobileTab('progress')} className={cn("pb-1 transition-all border-b-2 hover:text-[#A27B41]", mobileTab === 'progress' ? "border-[#A27B41] text-[#A27B41] font-bold" : "border-transparent text-chosen-text-muted")}>Move</button>
            <button onClick={() => setMobileTab('profile')} className={cn("pb-1 transition-all border-b-2 hover:text-[#A27B41]", mobileTab === 'profile' ? "border-[#A27B41] text-[#A27B41] font-bold" : "border-transparent text-chosen-text-muted")}>Profile</button>
          </div>
        </Header>
      }
      bottomNav={bottomNavigation}
      className="pb-24 md:pb-0"
    >
      <ContentWrapper>
        <div className="hidden lg:block">
          {mobileTab === 'overview' && (
            <div className="grid grid-cols-3 gap-8 text-left items-start animate-fade-in">
              <div className="space-y-8">
                {greetingHeader}
                {todaysWorkoutCard}
                {quickStartCard}
              </div>
              <div className="space-y-8">
                {nextAppointmentCard}
                {clinicalProfileBanner}
                {upcomingSchedule}
              </div>
              <div className="space-y-8">
                {statsRow}
                {progressAnalytics}
                {quickActionsCard}
              </div>
            </div>
          )}

          {mobileTab === 'exercises' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 lg:py-8 text-left items-start animate-fade-in">
              {/* Header Row */}
              <div className="col-span-12 flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-4 mb-2">
                <div className="space-y-1">
                  <h1 className="text-2xl font-display font-bold text-[#0D0C18] dark:text-white">My Plan</h1>
                  <p className="text-xs text-chosen-text-muted">Review and execute your prescribed daily exercises.</p>
                </div>
                <div className="flex items-center gap-4 bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 px-4 py-2.5 rounded-chosen-xl shadow-chosen-sm">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-chosen-text-muted block">Weekly Progress</span>
                    <span className="text-xs font-bold text-[#A27B41] block mt-0.5">{assignments.filter(a => a.is_completed).length} of {assignments.length} Completed ({assignments.length > 0 ? Math.round((assignments.filter(a => a.is_completed).length / assignments.length) * 100) : 0}%)</span>
                  </div>
                  <div className="w-16 h-1.5 bg-[#F5F5F5] dark:bg-charcoal-800 rounded-full overflow-hidden shrink-0">
                    <div className="h-full bg-[#A27B41] rounded-full" style={{ width: `${assignments.length > 0 ? Math.round((assignments.filter(a => a.is_completed).length / assignments.length) * 100) : 0}%` }} />
                  </div>
                </div>
              </div>

              {/* Left Column - Sticky vertical calendar selection (col-span-3) */}
              <div className="col-span-1 lg:col-span-3 space-y-6 lg:sticky lg:top-24">
                {desktopCalendar}
              </div>

              {/* Center Column - Today's prescribed exercises list (col-span-6) */}
              <div className="col-span-1 lg:col-span-6 space-y-6">
                <div className="flex justify-between items-center pb-2">
                  <h2 className="font-display font-bold text-base text-[#0D0C18] dark:text-white">
                    Exercises for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h2>
                  <Badge variant={progressPercentForDay === 100 ? 'success' : 'warning'}>
                    {progressPercentForDay}% Done
                  </Badge>
                </div>
                {renderMyPlanExercises()}
              </div>

              {/* Right Column - Secondary information (col-span-3) */}
              <div className="col-span-1 lg:col-span-3 space-y-6">
                {/* Progress Summary Cards */}
                <div className="space-y-3">
                  <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Progress Summary</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {/* KPI 1 */}
                    <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-4 rounded-chosen-xl flex items-center justify-between shadow-chosen-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] text-chosen-text-muted block font-semibold">Completed Today</span>
                        <span className="text-xl font-bold text-[#4F995E] block">
                          {assignments.filter(a => {
                            const isToday = new Date().toDateString() === (a.due_date ? new Date(a.due_date).toDateString() : new Date().toDateString());
                            return isToday && a.is_completed;
                          }).length}
                        </span>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-[#4F995E]" />
                    </div>
                    {/* KPI 2 */}
                    <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-4 rounded-chosen-xl flex items-center justify-between shadow-chosen-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] text-chosen-text-muted block font-semibold">Remaining Today</span>
                        <span className="text-xl font-bold text-[#A27B41] block">
                          {assignments.filter(a => {
                            const isToday = new Date().toDateString() === (a.due_date ? new Date(a.due_date).toDateString() : new Date().toDateString());
                            return isToday && !a.is_completed;
                          }).length}
                        </span>
                      </div>
                      <Clock className="h-5 w-5 text-[#A27B41]" />
                    </div>
                    {/* KPI 3 */}
                    <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-4 rounded-chosen-xl flex items-center justify-between shadow-chosen-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] text-chosen-text-muted block font-semibold">Current Streak</span>
                        <span className="text-xl font-bold text-amber-500 block">{currentStreak} {currentStreak === 1 ? 'day' : 'days'}</span>
                      </div>
                      <TrendingUp className="h-5 w-5 text-amber-500" />
                    </div>
                    {/* KPI 4 */}
                    <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-4 rounded-chosen-xl flex items-center justify-between shadow-chosen-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] text-chosen-text-muted block font-semibold">Completion Rate</span>
                        <span className="text-xl font-bold text-slate-800 dark:text-white block">
                          {assignments.length > 0 ? Math.round((assignments.filter(a => a.is_completed).length / assignments.length) * 100) : 0}%
                        </span>
                      </div>
                      <Award className="h-5 w-5 text-indigo-500" />
                    </div>
                  </div>
                </div>

                {/* Practitioner Notes */}
                {practitionerNotesCard}

                {/* Upcoming Exercises */}
                {upcomingSchedule}
              </div>
            </div>
          )}

          {mobileTab === 'progress' && (
            <div className="grid grid-cols-3 gap-8 text-left items-start animate-fade-in">
              <div className="col-span-2 space-y-8">{progressAnalytics}</div>
              <div className="space-y-8">{statsRow}{practiceLogsHistory}</div>
            </div>
          )}

          {mobileTab === 'profile' && <div className="max-w-2xl mx-auto">{mobileProfileTab}</div>}
        </div>

        <div className="hidden md:block lg:hidden text-left">
          {mobileTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {greetingHeader}
              {clinicalProfileBanner}
              <div className="grid grid-cols-2 gap-8 items-start">
                <div className="space-y-8">{todaysWorkoutCard}{statsRow}{quickStartCard}</div>
                <div className="space-y-8">{nextAppointmentCard}{progressAnalytics}{upcomingSchedule}{practiceLogsHistory}</div>
              </div>
            </div>
          )}

          {mobileTab === 'exercises' && (
            <div className="space-y-6 animate-fade-in text-left">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-4">
                <h1 className="text-xl font-display font-bold text-[#0D0C18] dark:text-white">My Plan</h1>
                <span className="text-xs font-semibold text-[#A27B41]">
                  Weekly Progress: {assignments.length > 0 ? Math.round((assignments.filter(a => a.is_completed).length / assignments.length) * 100) : 0}%
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-6 items-start">
                {/* Column 1: Info and Calendar */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-5 space-y-4 shadow-chosen-sm">
                    <h4 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white">Select Plan Date</h4>
                    {calendarRow}
                  </div>
                  {progressRingCard}
                  {practitionerNotesCard}
                </div>

                {/* Column 2: Exercises list */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-6 space-y-6 shadow-chosen-sm">
                    <div className="flex justify-between items-center border-b border-[#F5F5F5] dark:border-charcoal-800/80 pb-3">
                      <h2 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white">
                        Exercises for {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                      </h2>
                    </div>
                    {renderMyPlanExercises()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mobileTab === 'progress' && (
            <div className="grid grid-cols-2 gap-8 items-start animate-fade-in">
              <div>{progressAnalytics}</div>
              <div className="space-y-8">
                {statsRow}
                {practiceLogsHistory}
              </div>
            </div>
          )}
          {mobileTab === 'profile' && <div className="max-w-2xl mx-auto">{mobileProfileTab}</div>}
        </div>

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
            <div className="space-y-6 animate-slide-up text-left">
              <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-4 space-y-3 shadow-chosen-sm">{calendarRow}</div>
              {progressRingCard}
              {renderMyPlanExercises()}
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
