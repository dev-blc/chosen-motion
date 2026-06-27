import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchMySessions, fetchPatientProfile, fetchMyAssignments, fetchMyRecords, fetchAssignmentPrescription } from '@/services/api';
import type { ExerciseAssignment, MotionSession, PatientExerciseRecord, Prescription } from '@/types/api';
import { metadataFromPrescription, guideFromPrescription } from '@/features/patient/utils/prescriptionHelpers';
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
  CheckCircle2,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MapPin,
  Video,
  MessageSquare,
  CalendarPlus,
  XCircle
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
  const [mobileTab, setMobileTab] = useState<'overview' | 'exercises' | 'progress' | 'appointments' | 'profile'>('overview');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedAssignment, setSelectedAssignment] = useState<ExerciseAssignment | null>(null);
  const [tipsOpen, setTipsOpen] = useState(true);
  const [mistakesOpen, setMistakesOpen] = useState(false);
  const [musclesOpen, setMusclesOpen] = useState(false);
  const [exerciseRecords, setExerciseRecords] = useState<Record<number, PatientExerciseRecord>>({});
  const [detailPrescription, setDetailPrescription] = useState<Prescription | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedAssignment?.id) {
      setDetailPrescription(null);
      return;
    }
    fetchAssignmentPrescription(selectedAssignment.id)
      .then(setDetailPrescription)
      .catch(() => setDetailPrescription(null));
  }, [selectedAssignment?.id]);

  const startTracker = (assignment?: ExerciseAssignment | null) => {
    if (!assignment?.exercise) {
      navigate('/tracker');
      return;
    }
    navigate('/tracker', {
      state: {
        exerciseName: assignment.exercise.name,
        rules: assignment.exercise.rules,
        assignmentId: assignment.id,
        exerciseId: assignment.exercise_id,
      },
    });
  };

  // Mock appointments telemetry list
  const [appointmentsList, setAppointmentsList] = useState<any[]>([
    {
      id: 1,
      date: '2026-06-25', // Today
      time: '2:00 PM',
      practitioner: 'Dr. Luis R',
      clinic: 'Chelsea Clinic',
      status: 'upcoming',
      type: 'Follow-up session',
      notes: 'Today\'s focus: Review joint Range of Motion (ROM) bounds, discuss motion tracking feedback stability levels, and calibrate camera distance settings.',
      joinUrl: 'https://zoom.us/j/123456789'
    },
    {
      id: 2,
      date: '2026-06-29',
      time: '10:00 AM',
      practitioner: 'Dr. Luis R',
      clinic: 'Chelsea Clinic',
      status: 'upcoming',
      type: 'Progress review',
      notes: 'Bi-weekly evaluation of motion capturing telemetry data streams uploaded during practice.',
      joinUrl: 'https://zoom.us/j/123456789'
    },
    {
      id: 3,
      date: '2026-07-03',
      time: '4:00 PM',
      practitioner: 'Dr. Luis R',
      clinic: 'Chelsea Clinic',
      status: 'rescheduled',
      type: 'Video check-in',
      notes: 'Follow-up consultation regarding exercise comfort levels and lunge skeleton feedback.',
      joinUrl: 'https://zoom.us/j/987654321'
    },
    {
      id: 4,
      date: '2026-06-20', // Past
      time: '12:30 PM',
      practitioner: 'Dr. Luis R',
      clinic: 'Nottingham Clinic',
      status: 'completed',
      type: 'Follow-up session',
      notes: 'Patient is making good progress with shoulder abduction exercises. Target range increased to 135 degrees. Continue daily tracking.'
    },
    {
      id: 5,
      date: '2026-06-19', // Past
      time: '9:00 AM',
      practitioner: 'Dr. Luis R',
      clinic: 'Nottingham Clinic',
      status: 'completed',
      type: 'Initial evaluation',
      notes: 'Initial intake completed. Evaluated base shoulder ROM at 85 degrees. Routine rules established.'
    },
    {
      id: 6,
      date: '2026-06-10', // Past
      time: '11:00 AM',
      practitioner: 'Dr. Luis R',
      clinic: 'Chelsea Clinic',
      status: 'cancelled',
      type: 'Follow-up session',
      notes: 'Rescheduled due to practitioner travel.'
    },
    {
      id: 7,
      date: '2026-06-03', // Past
      time: '3:00 PM',
      practitioner: 'Dr. Luis R',
      clinic: 'Chelsea Clinic',
      status: 'missed',
      type: 'Video check-in',
      notes: 'Patient did not attend check-in call.'
    }
  ]);

  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
  const [isReschedulingApptId, setIsReschedulingApptId] = useState<number | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleTime, setRescheduleTime] = useState<string>('');
  const [showRescheduleSuccess, setShowRescheduleSuccess] = useState<boolean>(false);

  // Profile settings and sub-modals states
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState<boolean>(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [showNotificationSettingsModal, setShowNotificationSettingsModal] = useState<boolean>(false);
  const [showPrivacySettingsModal, setShowPrivacySettingsModal] = useState<boolean>(false);
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>('system');
  const [languagePreference, setLanguagePreference] = useState<'english' | 'spanish' | 'french'>('english');
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);

  const [editableFirstName, setEditableFirstName] = useState<string>('');
  const [editableLastName, setEditableLastName] = useState<string>('');
  const [editableEmail, setEditableEmail] = useState<string>('');
  const [editablePhone, setEditablePhone] = useState<string>('');

  useEffect(() => {
    if (profile) {
      setEditableFirstName(profile.firstName || '');
      setEditableLastName(profile.lastName || '');
      setEditableEmail(profile.email || '');
    }
  }, [profile]);

  useEffect(() => {
    if (clinicalProfile) {
      setEditablePhone(clinicalProfile.phone || '+1 (555) 019-2831');
    }
  }, [clinicalProfile]);

  // Initialize selected appointment focus on mount
  useEffect(() => {
    const todayAppt = appointmentsList.find(a => a.date === '2026-06-25' && a.status === 'upcoming');
    setSelectedAppointment(todayAppt || appointmentsList[0] || null);
  }, []);

  useEffect(() => {
    async function loadPatientData() {
      try {
        const [patientData, sessionsData, assignmentsData, recordsData] = await Promise.all([
          fetchPatientProfile(),
          fetchMySessions(),
          fetchMyAssignments(),
          fetchMyRecords().catch(() => []),
        ]);
        setClinicalProfile(patientData);
        setSessions(sessionsData);
        setAssignments(assignmentsData);
        const recordMap: Record<number, PatientExerciseRecord> = {};
        (recordsData as PatientExerciseRecord[]).forEach((r) => {
          recordMap[r.exercise_id] = r;
        });
        setExerciseRecords(recordMap);
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
            onClick={() => startTracker(assignments[0])}
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
          onClick={() => { setMobileTab('exercises'); setSelectedAssignment(null); }}
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
                onClick={() => startTracker(assignment)}
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


  // ==========================================
  // Patient Appointments Redesign Helpers & Layouts
  // ==========================================
  const getStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      upcoming: { label: 'Upcoming', className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' },
      completed: { label: 'Completed', className: 'bg-green-500/10 text-green-400 border-green-500/20' },
      cancelled: { label: 'Cancelled', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
      rescheduled: { label: 'Rescheduled', className: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      missed: { label: 'Missed', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
    };
    const config = configs[status] || { label: status, className: 'bg-slate-500/10 text-slate-400' };
    return (
      <span className={cn("text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border shadow-2xs select-none", config.className)}>
        {config.label}
      </span>
    );
  };

  const formatApptDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
  };

  const handleMockRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleDate || !rescheduleTime || isReschedulingApptId === null) return;
    
    setAppointmentsList(prev => prev.map(a => {
      if (a.id === isReschedulingApptId) {
        return {
          ...a,
          date: rescheduleDate,
          time: rescheduleTime,
          status: 'rescheduled',
          notes: `Rescheduled to ${rescheduleDate} at ${rescheduleTime}. ${a.notes || ''}`
        };
      }
      return a;
    }));
    
    setSelectedAppointment((prev: any) => {
      if (prev && prev.id === isReschedulingApptId) {
        return {
          ...prev,
          date: rescheduleDate,
          time: rescheduleTime,
          status: 'rescheduled',
          notes: `Rescheduled to ${rescheduleDate} at ${rescheduleTime}. ${prev.notes || ''}`
        };
      }
      return prev;
    });

    setShowRescheduleSuccess(true);
    setTimeout(() => {
      setShowRescheduleSuccess(false);
      setIsReschedulingApptId(null);
      setRescheduleDate('');
      setRescheduleTime('');
    }, 1500);
  };

  const renderRescheduleModal = () => {
    if (isReschedulingApptId === null) return null;
    const appt = appointmentsList.find(a => a.id === isReschedulingApptId);
    if (!appt) return null;

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
        <div className="bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-6 text-left shadow-2xl">
          <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-3">
            <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white flex items-center gap-2">
              <CalendarPlus className="h-4.5 w-4.5 text-[#A27B41]" />
              Reschedule Session
            </h3>
            <button 
              onClick={() => setIsReschedulingApptId(null)}
              className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-slate-800 rounded-lg text-chosen-text-muted transition-all"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>

          {showRescheduleSuccess ? (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-2.5">
              <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-[#0D0C18] dark:text-white">Date Changed Successfully!</span>
              <span className="text-[10px] text-chosen-text-muted">Resynced with care coordinator.</span>
            </div>
          ) : (
            <form onSubmit={handleMockRescheduleSubmit} className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1.5">Select New Date</span>
                <input 
                  type="date"
                  required
                  value={rescheduleDate}
                  min="2026-06-25"
                  onChange={e => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:ring-1 focus:ring-gold-500 focus:outline-none"
                />
              </div>

              <div>
                <span className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1.5">Select Time Slot</span>
                <select
                  required
                  value={rescheduleTime}
                  onChange={e => setRescheduleTime(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:ring-1 focus:ring-gold-500 focus:outline-none"
                >
                  <option value="">Choose time...</option>
                  <option value="9:00 AM">9:00 AM</option>
                  <option value="10:30 AM">10:30 AM</option>
                  <option value="12:00 PM">12:00 PM</option>
                  <option value="2:00 PM">2:00 PM</option>
                  <option value="3:30 PM">3:30 PM</option>
                  <option value="5:00 PM">5:00 PM</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 text-2xs py-2 border-none"
                  onClick={() => setIsReschedulingApptId(null)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 text-2xs py-2 btn-accent"
                  type="submit"
                >
                  Confirm Change
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  const renderAppointmentsMobile = () => {
    const upcoming = appointmentsList.filter(a => a.status === 'upcoming' || a.status === 'rescheduled');
    const past = appointmentsList.filter(a => a.status === 'completed' || a.status === 'cancelled' || a.status === 'missed');

    return (
      <div className="space-y-6 text-left animate-slide-up pb-10">
        {/* Mobile Header Block */}
        <div className="flex justify-between items-center pb-4 border-b border-[#E5E5E5] dark:border-charcoal-800">
          <h1 className="text-xl font-display font-bold text-[#0D0C18] dark:text-white">Appointments</h1>
          <button 
            onClick={() => setMobileTab('profile')}
            className="p-2 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md text-chosen-text-secondary border border-[#E5E5E5] dark:border-charcoal-800"
            title="Profile Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>

        {/* Upcoming appointments list */}
        <div className="space-y-3.5">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Upcoming Sessions</h3>
          {upcoming.length === 0 ? (
            <div className="p-6 bg-white dark:bg-charcoal-850 border border-chosen rounded-chosen-xl text-center text-xs text-chosen-text-muted">
              No upcoming appointments scheduled.
            </div>
          ) : (
            <div className="space-y-3.5">
              {upcoming.map(appt => (
                <div key={appt.id} className="p-4 bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl shadow-chosen-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="font-display font-bold text-sm text-[#0D0C18] dark:text-white block">
                        {formatApptDate(appt.date)}
                      </span>
                      <span className="text-2xs text-[#A27B41] font-bold block flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {appt.time}
                      </span>
                    </div>
                    {getStatusBadge(appt.status)}
                  </div>

                  <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/80 my-2" />

                  <div className="space-y-1.5 text-xs text-chosen-text-secondary">
                    <span className="block font-bold text-[#0D0C18] dark:text-white">{appt.practitioner}</span>
                    <span className="block">{appt.type} · {appt.clinic}</span>
                  </div>

                  <div className="flex gap-2.5 pt-1 select-none">
                    <Button
                      variant="outline"
                      className="flex-1 text-2xs py-1.5 h-8 font-semibold"
                      onClick={() => setSelectedAppointment(appt)}
                    >
                      Details
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1 text-2xs py-1.5 h-8 font-semibold"
                      onClick={() => {
                        setIsReschedulingApptId(appt.id);
                        setRescheduleDate(appt.date);
                        setRescheduleTime(appt.time);
                      }}
                    >
                      Reschedule
                    </Button>
                    {appt.joinUrl && (
                      <Button
                        variant="primary"
                        className="flex-1 text-2xs py-1.5 btn-accent h-8 font-semibold"
                        onClick={() => window.open(appt.joinUrl, '_blank')}
                        leftIcon={<Video className="h-3.5 w-3.5" />}
                      >
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past history log */}
        <div className="space-y-3">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Past History Log</h3>
          {past.length === 0 ? (
            <div className="p-6 bg-white dark:bg-charcoal-850 border border-chosen rounded-chosen-xl text-center text-xs text-chosen-text-muted">
              No historical appointment records.
            </div>
          ) : (
            <div className="space-y-3">
              {past.map(appt => (
                <div 
                  key={appt.id} 
                  onClick={() => setSelectedAppointment(appt)}
                  className={cn(
                    "p-3.5 bg-[#FAFBFC] dark:bg-charcoal-900 border rounded-chosen-xl flex justify-between items-center transition-all cursor-pointer hover:border-gold-500/30",
                    selectedAppointment?.id === appt.id ? "border-gold-500/50 shadow-chosen-sm bg-amber-50/5 dark:bg-amber-950/5" : "border-[#F5F5F5] dark:border-charcoal-800/60"
                  )}
                >
                  <div className="space-y-1 text-left min-w-0">
                    <span className="font-bold text-xs text-[#0D0C18] dark:text-white block truncate font-display">
                      {formatApptDate(appt.date)} · {appt.time}
                    </span>
                    <span className="text-[10px] text-chosen-text-muted block font-medium truncate mt-0.5">
                      {appt.practitioner} · {appt.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {getStatusBadge(appt.status)}
                    <ChevronRight className="h-4.5 w-4.5 text-chosen-text-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Appointment details bottom drawer/modal */}
        {selectedAppointment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-4 z-40 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full space-y-5 text-left shadow-2xl animate-slide-up max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-slate-800 pb-3.5">
                <div>
                  <h4 className="font-display font-bold text-base text-[#0D0C18] dark:text-white">Appointment Details</h4>
                  <span className="text-[10px] text-chosen-text-muted uppercase tracking-wider block mt-0.5">{selectedAppointment.type}</span>
                </div>
                <button 
                  onClick={() => setSelectedAppointment(null)}
                  className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-slate-800 rounded-lg text-chosen-text-secondary transition-all"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="p-3.5 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-xl space-y-1">
                  <span className="text-[9px] text-chosen-text-muted uppercase font-bold tracking-wider block">Scheduled time</span>
                  <span className="font-bold text-[#0D0C18] dark:text-white block text-sm font-display">
                    {formatApptDate(selectedAppointment.date)} at {selectedAppointment.time}
                  </span>
                </div>

                <div className="flex gap-3.5 items-center">
                  <div className="h-10 w-10 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-500/10">
                    {selectedAppointment.practitioner.split(' ').pop()?.[0] || 'PT'}
                  </div>
                  <div>
                    <span className="font-bold text-xs text-[#0D0C18] dark:text-white block">{selectedAppointment.practitioner}</span>
                    <span className="text-[10px] text-chosen-text-muted block font-medium">Rehabilitation Physical Therapist</span>
                  </div>
                </div>

                <div className="flex gap-3 items-start text-left">
                  <MapPin className="h-4.5 w-4.5 text-[#A27B41] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-xs text-[#0D0C18] dark:text-white block">Location Site</span>
                    <span className="text-[10px] text-chosen-text-secondary block mt-0.5">{selectedAppointment.clinic}</span>
                  </div>
                </div>

                <div className="flex gap-3 items-center">
                  <Info className="h-4.5 w-4.5 text-chosen-text-muted shrink-0" />
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-chosen-text-secondary">Appt Status:</span>
                    {getStatusBadge(selectedAppointment.status)}
                  </div>
                </div>

                {selectedAppointment.notes && (
                  <div className="p-3.5 bg-slate-500/5 border border-chosen rounded-chosen-xl space-y-1.5 text-left">
                    <span className="text-[9px] text-chosen-text-muted uppercase font-bold tracking-wider block flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" /> Clinical progress notes
                    </span>
                    <p className="text-chosen-text-secondary leading-relaxed text-2xs italic font-medium">
                      "{selectedAppointment.notes}"
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 select-none">
                <Button
                  variant="primary"
                  className="w-full font-bold py-3 text-xs btn-primary shadow-sm"
                  onClick={() => setSelectedAppointment(null)}
                >
                  Dismiss Details
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAppointmentsTablet = () => {
    const upcoming = appointmentsList.filter(a => a.status === 'upcoming' || a.status === 'rescheduled');
    const past = appointmentsList.filter(a => a.status === 'completed' || a.status === 'cancelled' || a.status === 'missed');
    const focused = selectedAppointment || upcoming[0] || past[0] || null;

    return (
      <div className="space-y-6 text-left animate-fade-in">
        {/* Tablet Header */}
        <div className="flex justify-between items-center pb-4 border-b border-[#E5E5E5] dark:border-charcoal-800 mb-2">
          <div className="space-y-1">
            <h1 className="text-xl font-display font-bold text-[#0D0C18] dark:text-white">Appointments & History</h1>
            <p className="text-xs text-chosen-text-muted">Manage clinical calls and rehabilitation check-ins.</p>
          </div>
          <button 
            onClick={() => setMobileTab('profile')}
            className="p-2 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md text-chosen-text-secondary border border-[#E5E5E5] dark:border-charcoal-800 shadow-chosen-sm transition-all"
            title="Profile Settings"
          >
            <Settings className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6 items-start">
          {/* Column 1 - Upcoming and Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-5 space-y-4 shadow-chosen-sm">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Upcoming Sessions</h3>
              <div className="space-y-3">
                {upcoming.map(appt => (
                  <div 
                    key={appt.id} 
                    onClick={() => setSelectedAppointment(appt)}
                    className={cn(
                      "p-3.5 bg-[#FAFBFC] dark:bg-charcoal-900 border rounded-chosen-xl flex justify-between items-center transition-all cursor-pointer hover:border-gold-500/30",
                      focused?.id === appt.id ? "border-gold-500/50 shadow-chosen-sm bg-amber-50/5 dark:bg-amber-950/5" : "border-[#E5E5E5] dark:border-charcoal-800/60"
                    )}
                  >
                    <div className="space-y-1">
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block font-display">
                        {formatApptDate(appt.date)} at {appt.time}
                      </span>
                      <span className="text-[10px] text-chosen-text-muted block mt-0.5">
                        {appt.practitioner} · {appt.type}
                      </span>
                    </div>
                    {getStatusBadge(appt.status)}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-chosen rounded-chosen-lg p-5 space-y-4 shadow-chosen-sm">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Quick Actions</h3>
              <div className="grid grid-cols-1 gap-2.5 text-xs select-none">
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary hover:text-chosen-text-primary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => alert('Care coordination message portal opening...')}
                  leftIcon={<MessageSquare className="h-4 w-4 text-[#A27B41]" />}
                >
                  Message Care Team
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary hover:text-chosen-text-primary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => alert('Schedule exported. Saved calendar file.')}
                  leftIcon={<CalendarPlus className="h-4 w-4 text-[#A27B41]" />}
                >
                  Export to Calendar
                </Button>
              </div>
            </div>
          </div>

          {/* Column 2 - Details focus & Past */}
          <div className="space-y-6">
            {focused && (
              <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-5 space-y-4 shadow-chosen-sm text-left">
                <div className="flex justify-between items-start border-b border-[#F5F5F5] dark:border-charcoal-800/80 pb-3">
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white">Focused details</h3>
                    <span className="text-[10px] text-chosen-text-muted uppercase tracking-wider font-semibold block mt-0.5">{focused.type}</span>
                  </div>
                  {getStatusBadge(focused.status)}
                </div>

                <div className="space-y-4 text-xs">
                  <div className="flex gap-3.5 items-center">
                    <div className="h-10 w-10 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border border-indigo-500/10">
                      {focused.practitioner.split(' ').pop()?.[0] || 'PT'}
                    </div>
                    <div className="text-left">
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block">{focused.practitioner}</span>
                      <span className="text-[10px] text-chosen-text-muted block">Supervising Physical Therapist</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-md text-left">
                      <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Appointment date</span>
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block mt-1 font-display">{formatApptDate(focused.date)}</span>
                    </div>
                    <div className="p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-md text-left">
                      <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Scheduled time</span>
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block mt-1 font-display">{focused.time}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 text-left">
                    <MapPin className="h-4.5 w-4.5 text-[#A27B41] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block">Site location</span>
                      <span className="text-[10px] text-chosen-text-secondary block mt-0.5">{focused.clinic}</span>
                    </div>
                  </div>

                  {focused.notes && (
                    <div className="p-3 bg-slate-500/5 border border-chosen rounded-chosen-md text-left space-y-1.5">
                      <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Clinical progress notes</span>
                      <p className="text-[10px] text-chosen-text-secondary leading-relaxed italic">
                        "{focused.notes}"
                      </p>
                    </div>
                  )}

                  {focused.status === 'upcoming' && (
                    <div className="flex gap-3 pt-2 select-none">
                      <Button
                        variant="secondary"
                        className="flex-1 text-2xs py-2 bg-[#F5F5F5] hover:bg-[#E6E6E6] text-slate-800 border-none font-semibold"
                        onClick={() => {
                          setIsReschedulingApptId(focused.id);
                          setRescheduleDate(focused.date);
                          setRescheduleTime(focused.time);
                        }}
                      >
                        Reschedule
                      </Button>
                      {focused.joinUrl && (
                        <Button
                          variant="primary"
                          className="flex-1 text-2xs py-2 btn-accent font-semibold"
                          onClick={() => window.open(focused.joinUrl, '_blank')}
                          leftIcon={<Video className="h-3 w-3" />}
                        >
                          Join Meeting
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Past history */}
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-5 space-y-4 shadow-chosen-sm">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Past History Log</h3>
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {past.map(appt => (
                  <div 
                    key={appt.id} 
                    onClick={() => setSelectedAppointment(appt)}
                    className={cn(
                      "p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border rounded-chosen-xl flex justify-between items-center transition-all cursor-pointer hover:border-gold-500/30",
                      focused?.id === appt.id ? "border-gold-500/50 shadow-chosen-sm bg-amber-50/5 dark:bg-amber-950/5" : "border-[#F5F5F5] dark:border-charcoal-800/60"
                    )}
                  >
                    <div className="space-y-0.5 text-left">
                      <span className="font-bold text-2xs text-[#0D0C18] dark:text-white block font-display">
                        {formatApptDate(appt.date)} · {appt.time}
                      </span>
                      <span className="text-[10px] text-chosen-text-muted block">
                        {appt.practitioner} · {appt.type}
                      </span>
                    </div>
                    {getStatusBadge(appt.status)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAppointmentsDesktop = () => {
    const upcoming = appointmentsList.filter(a => a.status === 'upcoming' || a.status === 'rescheduled');
    const past = appointmentsList.filter(a => a.status === 'completed' || a.status === 'cancelled' || a.status === 'missed');
    const focused = selectedAppointment || upcoming[0] || past[0] || null;
    const todayAppt = appointmentsList.find(a => a.date === '2026-06-25' && a.status === 'upcoming');

    return (
      <div className="space-y-6 text-left animate-fade-in max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop Header */}
        <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-4 mb-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold text-[#0D0C18] dark:text-white">Appointments & History</h1>
            <p className="text-xs text-chosen-text-muted">Review, reschedule, or join virtual care consultations with your clinical team.</p>
          </div>
          <button 
            onClick={() => setMobileTab('profile')}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md text-chosen-text-secondary border border-[#E5E5E5] dark:border-charcoal-800 text-xs font-semibold shadow-chosen-sm transition-all active:scale-95"
            title="Profile settings"
          >
            <Settings className="h-4 w-4 text-[#A27B41]" /> Settings Dashboard
          </button>
        </div>

        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Left Column (col-span-4) - Spotlight & Upcoming */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            {todayAppt && (
              <div className="bg-ai-gradient dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-xl p-5 shadow-chosen-lg relative overflow-hidden text-left w-full transition-all duration-300 hover:shadow-chosen-xl">
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white/10 dark:bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 space-y-3.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-[#525252] dark:text-slate-400">Today's Appointment</span>
                    <span className="text-[9px] bg-white/80 dark:bg-charcoal-800/80 border border-[#E5E5E5] dark:border-charcoal-700/50 px-2.5 py-0.5 rounded-full font-bold text-[#A27B41] shadow-sm select-none">
                      Active check-in
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white leading-tight">
                      Thursday, 25 Jun · {todayAppt.time}
                    </h3>
                  </div>
                  <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/60 my-2" />
                  <div className="space-y-1 text-2xs text-[#525252] dark:text-slate-400 font-medium">
                    <span className="block font-bold text-[#0D0C18] dark:text-white">{todayAppt.practitioner}</span>
                    <span className="block">{todayAppt.type} · {todayAppt.clinic}</span>
                  </div>
                  <div className="flex gap-2.5 pt-1 select-none">
                    <Button
                      variant="outline"
                      className="flex-1 text-2xs py-1.5 bg-white/80 dark:bg-charcoal-800/80 border border-[#E5E5E5] dark:border-charcoal-700 text-[#0D0C18] dark:text-white font-bold"
                      onClick={() => setSelectedAppointment(todayAppt)}
                    >
                      View Details
                    </Button>
                    {todayAppt.joinUrl && (
                      <Button
                        variant="primary"
                        className="flex-1 text-2xs py-1.5 btn-accent"
                        onClick={() => window.open(todayAppt.joinUrl, '_blank')}
                        leftIcon={<Video className="h-3 w-3" />}
                      >
                        Join Call
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm">
              <div className="flex items-center justify-between pb-1">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Upcoming Sessions</h3>
                <span className="text-[10px] bg-slate-100 dark:bg-charcoal-900 border border-chosen px-2.5 py-0.5 rounded-full font-bold text-slate-500">{upcoming.length} scheduled</span>
              </div>
              <div className="space-y-3">
                {upcoming.map(appt => (
                  <div 
                    key={appt.id} 
                    onClick={() => setSelectedAppointment(appt)}
                    className={cn(
                      "p-4 bg-[#FAFBFC] dark:bg-charcoal-900 border rounded-chosen-xl flex justify-between items-center transition-all cursor-pointer hover:border-gold-500/30 hover:shadow-chosen-sm hover:translate-y-[-1px]",
                      focused?.id === appt.id ? "border-gold-500/50 shadow-chosen-sm bg-amber-50/5 dark:bg-amber-950/5" : "border-[#E5E5E5] dark:border-charcoal-800/60"
                    )}
                  >
                    <div className="space-y-1.5 text-left min-w-0">
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block font-display">
                        {formatApptDate(appt.date)}
                      </span>
                      <span className="text-2xs text-[#A27B41] font-bold block flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-chosen-text-muted" /> {appt.time}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {getStatusBadge(appt.status)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Center Column (col-span-5) - Focus Details Panel */}
          <div className="col-span-12 lg:col-span-5">
            {focused ? (
              <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-6 space-y-5 shadow-chosen-sm text-left">
                <div className="flex justify-between items-start border-b border-[#F5F5F5] dark:border-charcoal-800/80 pb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-[#A27B41] uppercase tracking-widest font-bold block">Appointment Focus</span>
                    <h3 className="font-display font-bold text-base text-[#0D0C18] dark:text-white">{focused.type}</h3>
                  </div>
                  {getStatusBadge(focused.status)}
                </div>

                <div className="space-y-5 text-xs text-left">
                  <div className="flex gap-4 items-center bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 p-4 rounded-chosen-xl">
                    <div className="h-11 w-11 bg-indigo-500/10 text-indigo-500 rounded-full flex items-center justify-center font-bold text-base shrink-0 border border-indigo-500/10">
                      {focused.practitioner.split(' ').pop()?.[0] || 'PT'}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block">{focused.practitioner}</span>
                      <span className="text-2xs text-chosen-text-muted block mt-0.5 font-medium">Primary Rehabilitation Physical Therapist</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[#FAFBFC] dark:bg-charcoal-900 border border-chosen rounded-chosen-xl text-left">
                      <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Scheduled date</span>
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block mt-1.5 font-display">{formatApptDate(focused.date)}</span>
                    </div>
                    <div className="p-4 bg-[#FAFBFC] dark:bg-charcoal-900 border border-chosen rounded-chosen-xl text-left">
                      <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Scheduled time</span>
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block mt-1.5 font-display">{focused.time}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-chosen p-4 rounded-chosen-xl text-left">
                    <MapPin className="h-5 w-5 text-[#A27B41] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-xs text-[#0D0C18] dark:text-white block">Clinic Location</span>
                      <span className="text-[10px] text-chosen-text-secondary block mt-0.5">{focused.clinic}</span>
                      <span className="text-[8px] text-chosen-text-muted block mt-1 leading-normal font-mono font-medium">Verified practitioner credentials on site</span>
                    </div>
                  </div>

                  {focused.notes && (
                    <div className="p-4 bg-slate-500/5 border border-chosen rounded-chosen-xl space-y-2.5">
                      <span className="text-[9px] text-chosen-text-muted uppercase font-bold tracking-wider block flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" /> Clinical consultation notes
                      </span>
                      <p className="text-chosen-text-secondary leading-relaxed italic text-2xs font-semibold">
                        "{focused.notes}"
                      </p>
                    </div>
                  )}

                  {focused.status === 'upcoming' && (
                    <div className="flex gap-3 pt-2 select-none">
                      <Button
                        variant="secondary"
                        className="flex-1 text-2xs py-2.5 bg-[#F5F5F5] hover:bg-[#E6E6E6] text-slate-800 border-none font-semibold"
                        onClick={() => {
                          setIsReschedulingApptId(focused.id);
                          setRescheduleDate(focused.date);
                          setRescheduleTime(focused.time);
                        }}
                      >
                        Reschedule Session
                      </Button>
                      {focused.joinUrl && (
                        <Button
                          variant="primary"
                          className="flex-1 text-2xs py-2.5 btn-accent font-semibold"
                          onClick={() => window.open(focused.joinUrl, '_blank')}
                          leftIcon={<Video className="h-3.5 w-3.5" />}
                        >
                          Join Zoom Meeting
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-charcoal-850 border border-chosen rounded-chosen-xl p-12 text-center text-xs text-chosen-text-muted">
                No active focused appointment records. Select a card to load.
              </div>
            )}
          </div>

          {/* Right Column (col-span-3) - Past logs & Actions */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Past History Log</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {past.map(appt => (
                  <div 
                    key={appt.id} 
                    onClick={() => setSelectedAppointment(appt)}
                    className={cn(
                      "p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border rounded-chosen-xl flex justify-between items-center transition-all cursor-pointer hover:border-gold-500/30 hover:shadow-chosen-sm hover:translate-y-[-1px]",
                      focused?.id === appt.id ? "border-gold-500/50 shadow-chosen-sm bg-amber-50/5 dark:bg-amber-950/5" : "border-[#F5F5F5] dark:border-charcoal-800/60"
                    )}
                  >
                    <div className="space-y-0.5 text-left min-w-0">
                      <span className="font-bold text-2xs text-[#0D0C18] dark:text-white block truncate font-display">
                        {formatApptDate(appt.date)}
                      </span>
                      <span className="text-[10px] text-chosen-text-muted block truncate font-medium mt-0.5">
                        {appt.practitioner} · {appt.type}
                      </span>
                    </div>
                    {getStatusBadge(appt.status)}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-chosen rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted font-semibold text-left">Quick Actions</h3>
              <div className="flex flex-col gap-2.5 text-xs select-none">
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2.5 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary hover:text-chosen-text-primary border-chosen flex items-center justify-start gap-2 h-10 font-semibold"
                  onClick={() => alert('Secure message portal loaded. Dr. Luis R notified.')}
                  leftIcon={<MessageSquare className="h-4 w-4 text-[#A27B41]" />}
                >
                  Contact Clinician
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2.5 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary hover:text-chosen-text-primary border-chosen flex items-center justify-start gap-2 h-10 font-semibold"
                  onClick={() => alert('Downloaded rehabilitation calendar schedule file (.ics)')}
                  leftIcon={<CalendarPlus className="h-4 w-4 text-[#A27B41]" />}
                >
                  Download Schedule
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

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
            const meta = metadataFromPrescription(
              assignment.config
                ? ({ config: assignment.config } as Prescription)
                : null
            );
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
                        onClick={() => startTracker(assignment)}
                      >
                        <Play className="h-3 w-3 fill-current" /> Start
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1 flex items-center justify-center gap-1.5 font-bold py-2 text-xs hover:bg-gold-500/10 hover:text-[#A27B41] w-full"
                        onClick={() => setSelectedAssignment(assignment)}
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

  const renderExerciseDetails = () => {
    if (!selectedAssignment) return null;
    const assignment = selectedAssignment;
    const ex = assignment.exercise;
    if (!ex) return (
      <div className="text-center py-12">
        <p className="text-sm font-semibold text-red-500">Exercise profile data is incomplete.</p>
        <Button variant="secondary" onClick={() => setSelectedAssignment(null)} className="mt-4">
          Go Back
        </Button>
      </div>
    );

    const meta = metadataFromPrescription(
      detailPrescription ||
        (assignment.config ? ({ config: assignment.config } as Prescription) : null)
    );
    const guide = guideFromPrescription(detailPrescription);

    const sessionsForExercise = sessions.filter(s => 
      s.exercise_id === ex.id || 
      (s.title && s.title.toLowerCase().includes(ex.name.toLowerCase()))
    );

    const exerciseSessionsCount = sessionsForExercise.length;
    const apiRecord = exerciseRecords[ex.id];
    const bestScore = apiRecord?.best_metrics?.accuracy != null
      ? Math.round(apiRecord.best_metrics.accuracy)
      : exerciseSessionsCount > 0
        ? Math.max(...sessionsForExercise.map(s => Math.round(s.avg_score ?? s.score ?? 0)))
        : 0;

    const avgAccuracyForExercise = exerciseSessionsCount > 0 
      ? Math.round(sessionsForExercise.reduce((acc, s) => acc + (s.avg_score ?? s.score ?? 0), 0) / exerciseSessionsCount) 
      : 0;

    const radiusDetail = 24;
    const strokeWidthDetail = 4;
    const circumferenceDetail = 2 * Math.PI * radiusDetail;
    const progressPercentDetail = assignment.is_completed ? 100 : 0;
    const strokeDashoffsetDetail = circumferenceDetail - (progressPercentDetail / 100) * circumferenceDetail;

    return (
      <div className="space-y-6 lg:space-y-8 animate-fade-in text-left">
        {/* Desktop Viewport (>1024px) */}
        <div className="hidden lg:grid grid-cols-12 gap-8 max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-6 lg:py-8 items-start">
          <div className="col-span-12 space-y-4 border-b border-[#E5E5E5] dark:border-charcoal-800 pb-5">
            <div className="flex items-center gap-2 text-xs font-semibold select-none text-chosen-text-muted">
              <button onClick={() => setSelectedAssignment(null)} className="hover:text-[#A27B41] transition-colors border-none bg-transparent">My Plan</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-chosen-text-primary">Exercises</span>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-[#A27B41]">{ex.name}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="space-y-1 text-left">
                <h1 className="text-2xl font-display font-bold text-[#0D0C18] dark:text-white leading-tight">{ex.name}</h1>
                <span className="text-xs font-bold text-[#A27B41] uppercase tracking-wider block">{meta.category}</span>
              </div>
              <Badge variant={assignment.is_completed ? "success" : "neutral"} styleType="soft">
                {assignment.is_completed ? "Completed Today" : "Pending Action"}
              </Badge>
            </div>
          </div>

          <div className="col-span-4 space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl overflow-hidden shadow-chosen-sm relative">
              <img
                src={ex.thumbnail_url || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600'}
                alt={ex.name}
                className="w-full h-56 object-cover"
              />
              <div className="absolute top-3.5 right-3.5">
                <Badge variant="info" styleType="solid">ROM Target: {ex.target_rom || 120}°</Badge>
              </div>
            </div>

            <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-5 rounded-chosen-xl shadow-chosen-sm space-y-4 text-left">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Quick Specifications</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-chosen-text-muted block font-semibold">Target Area</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.bodyPart}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-chosen-text-muted block font-semibold">Difficulty</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.difficulty}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-chosen-text-muted block font-semibold">Repetitions</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.reps} reps / set</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-chosen-text-muted block font-semibold">Sets Count</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.sets} sets</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-chosen-text-muted block font-semibold">Rest Intervals</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.rest}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-chosen-text-muted block font-semibold">Estimated Time</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.duration}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-5 rounded-chosen-xl shadow-chosen-sm space-y-3">
              <Button
                variant="primary"
                className="w-full flex items-center justify-center gap-2 font-bold py-3 text-sm btn-primary"
                onClick={() => startTracker(assignment)}
                leftIcon={<Play className="h-4.5 w-4.5 fill-current" />}
              >
                Start Exercise
              </Button>
              <Button
                variant="secondary"
                className="w-full flex items-center justify-center gap-2 font-bold py-2.5 text-xs hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800"
                onClick={() => setSelectedAssignment(null)}
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Return to My Plan
              </Button>
            </div>
          </div>

          <div className="col-span-5 space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-5 rounded-chosen-xl shadow-chosen-sm text-left space-y-3">
              <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white border-b border-[#F5F5F5] dark:border-charcoal-800/80 pb-3">Exercise Description</h3>
              <p className="text-xs text-chosen-text-secondary leading-relaxed">{guide.description}</p>
            </div>

            <div className="space-y-4">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted px-1">Exercise Guide & Instructions</h3>
              
              <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl overflow-hidden shadow-chosen-sm">
                <div className="p-5 border-b border-[#F5F5F5] dark:border-charcoal-800/85">
                  <h4 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-primary">Execution Steps</h4>
                </div>
                <ol className="p-5 space-y-3.5 list-decimal list-inside text-xs text-chosen-text-secondary leading-relaxed pl-6">
                  {guide.instructions.map((step, sIdx) => (
                    <li key={sIdx} className="pl-1">
                      <span className="ml-1 text-slate-800 dark:text-slate-350">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl overflow-hidden shadow-chosen-sm">
                <button
                  onClick={() => setTipsOpen(!tipsOpen)}
                  className="w-full p-4 flex justify-between items-center hover:bg-[#FAFBFC] dark:hover:bg-charcoal-800 transition-colors border-none text-left bg-transparent"
                >
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-primary">Preparation Tips</span>
                  {tipsOpen ? <ChevronUp className="h-4 w-4 text-[#A27B41]" /> : <ChevronDown className="h-4 w-4 text-chosen-text-muted" />}
                </button>
                {tipsOpen && (
                  <ul className="p-5 pt-1 border-t border-[#F5F5F5] dark:border-charcoal-800/80 space-y-2 list-disc list-inside text-xs text-chosen-text-secondary leading-relaxed pl-6">
                    {guide.preparationTips.map((tip, tIdx) => (
                      <li key={tIdx} className="pl-1">
                        <span className="ml-1 text-slate-800 dark:text-slate-350">{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl overflow-hidden shadow-chosen-sm">
                <button
                  onClick={() => setMusclesOpen(!musclesOpen)}
                  className="w-full p-4 flex justify-between items-center hover:bg-[#FAFBFC] dark:hover:bg-charcoal-800 transition-colors border-none text-left bg-transparent"
                >
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-primary">Target Muscles & Equipment</span>
                  {musclesOpen ? <ChevronUp className="h-4 w-4 text-[#A27B41]" /> : <ChevronDown className="h-4 w-4 text-chosen-text-muted" />}
                </button>
                {musclesOpen && (
                  <div className="p-5 pt-2 border-t border-[#F5F5F5] dark:border-charcoal-800/80 space-y-4 text-xs">
                    <div>
                      <span className="font-bold text-[10px] text-chosen-text-muted uppercase tracking-wider block mb-2">Target Muscles</span>
                      <div className="flex flex-wrap gap-1.5">
                        {guide.targetMuscles.map((muscle, mIdx) => (
                          <span key={mIdx} className="bg-[#A27B41]/10 text-[#A27B41] font-bold text-[10px] uppercase px-2.5 py-1 rounded-full">{muscle}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="font-bold text-[10px] text-chosen-text-muted uppercase tracking-wider block mb-1">Required Equipment</span>
                      <span className="font-bold text-slate-800 dark:text-slate-300">{guide.requiredEquipment}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-red-50/20 dark:bg-red-955/5 border border-red-200 dark:border-red-950/20 rounded-chosen-xl overflow-hidden shadow-chosen-sm">
                <button
                  onClick={() => setMistakesOpen(!mistakesOpen)}
                  className="w-full p-4 flex justify-between items-center hover:bg-red-100/10 transition-colors border-none text-left bg-transparent"
                >
                  <span className="font-display font-bold text-xs uppercase tracking-wider text-red-650 dark:text-red-400">Common Mistakes to Avoid</span>
                  {mistakesOpen ? <ChevronUp className="h-4 w-4 text-red-650" /> : <ChevronDown className="h-4 w-4 text-red-555" />}
                </button>
                {mistakesOpen && (
                  <ul className="p-5 pt-1 border-t border-red-100 dark:border-red-955/25 space-y-2 list-disc list-inside text-xs text-red-800 dark:text-red-350 pl-6 leading-relaxed">
                    {guide.commonMistakes.map((mistake, mIdx) => (
                      <li key={mIdx} className="pl-1">
                        <span className="ml-1">{mistake}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-amber-50/20 dark:bg-amber-955/5 border border-amber-250 dark:border-amber-900/20 rounded-chosen-xl p-5 shadow-chosen-sm space-y-3">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-455">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <span className="font-display font-bold text-xs uppercase tracking-wider">Safety Guidelines</span>
                </div>
                <ul className="space-y-1.5 list-disc list-inside text-xs text-amber-800 dark:text-amber-350 pl-2 leading-relaxed">
                  {guide.safetyNotes.map((note, nIdx) => (
                    <li key={nIdx}>{note}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="col-span-3 space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-5 rounded-chosen-xl shadow-chosen-sm text-left flex items-center justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-chosen-text-muted block">Completion Status</span>
                <h4 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white truncate">
                  {assignment.is_completed ? "Completed Today" : "Pending Practice"}
                </h4>
                <span className="text-[10px] text-chosen-text-secondary block font-medium">
                  Best Accuracy: {bestScore}% | Avg: {avgAccuracyForExercise}%
                </span>
              </div>
              
              <div className="relative shrink-0 flex items-center justify-center h-14 w-14 select-none">
                <svg className="transform -rotate-90 w-full h-full">
                  <circle
                    cx="28"
                    cy="28"
                    r={radiusDetail}
                    stroke="currentColor"
                    strokeWidth={strokeWidthDetail}
                    fill="transparent"
                    className="text-[#F5F5F5] dark:text-charcoal-800"
                  />
                  <circle
                    cx="28"
                    cy="28"
                    r={radiusDetail}
                    stroke={assignment.is_completed ? "#4F995E" : "#A27B41"}
                    strokeWidth={strokeWidthDetail}
                    fill="transparent"
                    strokeDasharray={circumferenceDetail}
                    strokeDashoffset={strokeDashoffsetDetail}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold text-chosen-text-primary">
                  {progressPercentDetail}%
                </span>
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 p-5 rounded-chosen-xl shadow-chosen-sm text-left space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 bg-[#FAFBFC] dark:bg-charcoal-800 rounded-full flex items-center justify-center text-charcoal-500 shrink-0">
                  <Heart className="h-4.5 w-4.5 text-red-500 fill-current" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-display font-bold text-xs text-chosen-text-primary truncate">Assigned Clinician</h4>
                  <span className="text-[9px] text-[#9F9F9F] font-semibold block truncate">
                    Dr. {docFirstName} {docLastName}
                  </span>
                </div>
              </div>
              <div className="text-[10px] bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/60 p-3 rounded-chosen-md text-chosen-text-secondary italic leading-relaxed">
                "Ensure your camera settings are fully configured before starting. Pay careful attention to alignment suggestions in real-time."
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-5 text-left shadow-chosen-sm">
              <div>
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-primary flex items-center gap-1.5">
                  <History className="h-4 w-4 text-chosen-text-muted" />
                  Previous Sessions ({exerciseSessionsCount})
                </h3>
              </div>
              
              {sessionsForExercise.length === 0 ? (
                <p className="text-[10px] text-chosen-text-muted text-center py-4">No sessions completed yet.</p>
              ) : (
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1 panel-scroll">
                  {sessionsForExercise.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-2.5 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/50 rounded-chosen-md text-[10px] hover:translate-x-0.5 transition-transform">
                      <div className="min-w-0 text-left space-y-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                          {new Date(session.completed_at || session.created_at).toLocaleDateString()}
                        </span>
                        <span className="text-[8px] text-chosen-text-muted block font-mono">
                          {Math.round(session.range_of_motion || 0)}° ROM | {session.duration_seconds || 0}s
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="font-bold text-[#A27B41] block">
                          {session.avg_score || session.score}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tablet Viewport (768px - 1024px) */}
        <div className="hidden md:grid lg:hidden grid-cols-2 gap-6 max-w-[1440px] mx-auto px-6 py-6 items-start">
          <div className="col-span-2 space-y-4 border-b border-[#E5E5E5] dark:border-charcoal-800 pb-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-chosen-text-muted">
              <button onClick={() => setSelectedAssignment(null)} className="hover:text-[#A27B41] transition-colors border-none bg-transparent">My Plan</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-[#A27B41]">Exercise Details</span>
            </div>
            
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-display font-bold text-[#0D0C18] dark:text-white leading-tight">{ex.name}</h1>
                <span className="text-2xs font-bold text-[#A27B41] uppercase tracking-wider block mt-0.5">{meta.category}</span>
              </div>
              <Badge variant={assignment.is_completed ? "success" : "neutral"}>
                {assignment.is_completed ? "Completed" : "Pending"}
              </Badge>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl overflow-hidden shadow-chosen-sm relative">
              <img
                src={ex.thumbnail_url || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=600'}
                alt={ex.name}
                className="w-full h-48 object-cover"
              />
            </div>

            <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] p-5 rounded-chosen-xl space-y-3">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Quick Specifications</h3>
              <div className="grid grid-cols-2 gap-3.5 text-xs">
                <div>
                  <span className="text-[10px] text-chosen-text-muted block">Target Area</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.bodyPart}</span>
                </div>
                <div>
                  <span className="text-[10px] text-chosen-text-muted block">Difficulty</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.difficulty}</span>
                </div>
                <div>
                  <span className="text-[10px] text-chosen-text-muted block">Sets & Repetitions</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.sets} sets x {meta.reps} reps</span>
                </div>
                <div>
                  <span className="text-[10px] text-chosen-text-muted block">Estimated Duration</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{meta.duration}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] p-5 rounded-chosen-xl shadow-chosen-sm space-y-2.5">
              <Button
                variant="primary"
                className="w-full flex items-center justify-center gap-2 font-bold py-2.5 text-xs btn-primary shadow-sm"
                onClick={() => startTracker(assignment)}
              >
                Start Exercise
              </Button>
              <Button
                variant="secondary"
                className="w-full flex items-center justify-center gap-2 font-bold py-2 text-xs"
                onClick={() => setSelectedAssignment(null)}
              >
                Back to My Plan
              </Button>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] p-5 rounded-chosen-xl shadow-chosen-sm flex items-center gap-3">
              <Heart className="h-5 w-5 text-red-500 fill-current shrink-0" />
              <div className="text-xs">
                <span className="text-[10px] text-chosen-text-muted block">Supervising Physical Therapist</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">Dr. {docFirstName} {docLastName}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-xl p-5 space-y-4">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-primary border-b pb-2">Exercise Instructions</h3>
              <ol className="list-decimal list-inside text-xs text-chosen-text-secondary pl-2 space-y-2.5">
                {guide.instructions.slice(0, 4).map((step, stepIdx) => (
                  <li key={stepIdx} className="pl-1">
                    <span className="ml-1 text-slate-800 dark:text-slate-350">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] p-4 rounded-chosen-xl shadow-chosen-sm flex items-center justify-between gap-4">
              <div className="text-xs">
                <span className="text-[9px] uppercase font-bold text-chosen-text-muted block">Completion status</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{assignment.is_completed ? "Completed Today" : "Pending practice session"}</span>
              </div>
              <Badge variant={assignment.is_completed ? "success" : "neutral"} styleType="outline">
                {assignment.is_completed ? "100% Done" : "0% Done"}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-xl overflow-hidden shadow-chosen-sm">
                <button onClick={() => setTipsOpen(!tipsOpen)} className="w-full p-4 flex justify-between items-center text-left border-none bg-transparent">
                  <span className="font-display font-bold text-2xs uppercase tracking-wider text-chosen-text-primary">Preparation Tips</span>
                  {tipsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {tipsOpen && (
                  <ul className="p-4 pt-1 border-t list-disc list-inside text-xs text-chosen-text-secondary pl-6 space-y-1.5">
                    {guide.preparationTips.map((tip, idx) => <li key={idx}>{tip}</li>)}
                  </ul>
                )}
              </div>

              <div className="bg-amber-50/20 dark:bg-amber-955/5 border border-amber-250 p-4 rounded-chosen-xl flex gap-2.5 text-xs text-amber-800 dark:text-amber-350 leading-relaxed">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block uppercase tracking-wider text-[10px] mb-1">Safety Warning</span>
                  <span>{guide.safetyNotes[0]}</span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-xl p-5 space-y-4">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-primary">Previous Sessions ({exerciseSessionsCount})</h3>
              {sessionsForExercise.slice(0, 3).map((session) => (
                <div key={session.id} className="flex justify-between items-center text-xs p-2 bg-[#FAFBFC] border rounded-chosen-md">
                  <span>{new Date(session.completed_at || session.created_at).toLocaleDateString()}</span>
                  <span className="font-bold text-[#A27B41]">{session.avg_score || session.score}% Form</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Viewport (<768px) */}
        <div className="block md:hidden space-y-6 pb-20">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-chosen-text-muted">
            <button onClick={() => setSelectedAssignment(null)} className="flex items-center gap-1 hover:text-[#A27B41] transition-colors border-none text-[10px] font-bold bg-transparent">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>Details</span>
          </div>

          <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-xl overflow-hidden shadow-chosen-sm relative text-left">
            <img
              src={ex.thumbnail_url || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=300'}
              alt={ex.name}
              className="w-full h-44 object-cover"
            />
            <div className="absolute bottom-4 left-4 right-4 text-left z-10 space-y-1">
              <Badge variant="info" styleType="solid">ROM Target: {ex.target_rom || 120}°</Badge>
              <h1 className="text-lg font-display font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.65)] mt-1">{ex.name}</h1>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-chosen-text-secondary select-none font-semibold">
            <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-md p-2.5">
              <span className="text-[8px] text-chosen-text-muted block uppercase mb-0.5">Sets Goal</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{meta.sets} sets</span>
            </div>
            <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-md p-2.5">
              <span className="text-[8px] text-chosen-text-muted block uppercase mb-0.5">Reps / Set</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{meta.reps} reps</span>
            </div>
            <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-md p-2.5">
              <span className="text-[8px] text-chosen-text-muted block uppercase mb-0.5">Rest Duration</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{meta.rest}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] p-4 rounded-chosen-xl shadow-chosen-sm text-xs text-left space-y-2 leading-relaxed">
            <h4 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-primary">About this exercise</h4>
            <p className="text-chosen-text-secondary">{guide.description}</p>
          </div>

          <div className="space-y-2.5">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-xl overflow-hidden shadow-chosen-sm text-left">
              <div className="p-4 border-b">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-chosen-text-primary">Execution Steps</span>
              </div>
              <ol className="p-4 space-y-2.5 list-decimal list-inside text-xs text-chosen-text-secondary pl-5 leading-relaxed">
                {guide.instructions.map((step, idx) => (
                  <li key={idx} className="pl-1">
                    <span className="ml-1 text-slate-800 dark:text-slate-350">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] rounded-chosen-xl overflow-hidden shadow-chosen-sm text-left">
              <button onClick={() => setTipsOpen(!tipsOpen)} className="w-full p-4 flex justify-between items-center text-left border-none bg-transparent">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-chosen-text-primary">Preparation Tips</span>
                {tipsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {tipsOpen && (
                <ul className="p-4 pt-1 border-t list-disc list-inside text-xs text-chosen-text-secondary pl-5 space-y-1.5">
                  {guide.preparationTips.map((tip, idx) => <li key={idx}>{tip}</li>)}
                </ul>
              )}
            </div>

            <div className="bg-red-50/20 dark:bg-red-955/5 border border-red-200 dark:border-red-950/25 rounded-chosen-xl overflow-hidden shadow-chosen-sm text-left">
              <button onClick={() => setMistakesOpen(!mistakesOpen)} className="w-full p-4 flex justify-between items-center text-left border-none bg-transparent">
                <span className="font-display font-bold text-[10px] uppercase tracking-wider text-red-650 dark:text-red-400">Common Mistakes</span>
                {mistakesOpen ? <ChevronUp className="h-4 w-4 text-red-650" /> : <ChevronDown className="h-4 w-4 text-red-550" />}
              </button>
              {mistakesOpen && (
                <ul className="p-4 pt-1 border-t list-disc list-inside text-xs text-red-800 dark:text-red-350 pl-5 space-y-1.5">
                  {guide.commonMistakes.map((mistake, idx) => <li key={idx}>{mistake}</li>)}
                </ul>
              )}
            </div>

            <div className="bg-amber-50/20 dark:bg-amber-955/5 border border-amber-250 p-4 rounded-chosen-xl flex gap-2.5 text-xs text-left text-amber-800 dark:text-amber-350">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <div>
                <span className="font-bold block uppercase tracking-wider text-[10px] mb-0.5">Safety Warning</span>
                <span>{guide.safetyNotes[0]}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] p-4 rounded-chosen-xl shadow-chosen-sm flex items-center gap-3">
            <Heart className="h-4.5 w-4.5 text-red-500 fill-current shrink-0" />
            <div className="text-xs text-left">
              <span className="text-[9px] text-chosen-text-muted block">Clinician Support</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">Dr. {docFirstName} {docLastName}</span>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 dark:bg-charcoal-900/95 backdrop-blur border-t border-[#E5E5E5] dark:border-charcoal-800 flex gap-3 z-40 select-none">
            <Button
              variant="secondary"
              className="flex-1 font-bold py-3 text-xs"
              onClick={() => setSelectedAssignment(null)}
            >
              Back
            </Button>
            <Button
              variant="primary"
              className="flex-[2] font-bold py-3 text-xs btn-primary shadow-sm"
              onClick={() => navigate('/tracker', { state: { exerciseName: ex.name, rules: ex.rules } })}
            >
              Start Session
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const getPatientInitials = () => {
    const fn = editableFirstName || profile?.firstName || 'P';
    const ln = editableLastName || profile?.lastName || '';
    return (fn[0] + (ln[0] || '')).toUpperCase();
  };

  const getPatientId = () => {
    return clinicalProfile?.id ? `PL-${String(clinicalProfile.id).slice(0, 4).toUpperCase()}` : 'PL-9042';
  };

  const getRecentSessions = () => {
    return [...sessions].slice(0, 3);
  };

  const uniqueExercisesCount = new Set(sessions.map(s => s.exercise_id)).size;

  const renderProfileMobile = () => {
    return (
      <div className="space-y-6 text-left animate-slide-up pb-24">
        {/* Large Profile Header */}
        <div className="bg-gradient-to-br from-[#FAFBFC] to-[#F1F3F5] dark:from-charcoal-850 dark:to-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-6 shadow-chosen-lg text-left relative overflow-hidden flex flex-col items-center text-center space-y-4">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-white/10 dark:bg-white/5 rounded-full blur-xl pointer-events-none" />
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-[#E6E6E6] dark:bg-charcoal-800 border-4 border-white dark:border-charcoal-700 shadow-chosen-md flex items-center justify-center font-bold text-2xl text-[#0D0C18] dark:text-white uppercase select-none overflow-hidden">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span>{getPatientInitials()}</span>
              )}
            </div>
            <button 
              onClick={() => setShowEditProfileModal(true)}
              className="absolute bottom-0 right-0 p-1.5 bg-[#A27B41] text-white rounded-full border border-white dark:border-charcoal-800 shadow-chosen-sm hover:scale-105 active:scale-95 transition-all"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-1">
            <h3 className="font-display font-bold text-lg text-[#0D0C18] dark:text-white leading-tight">
              {editableFirstName ? `${editableFirstName} ${editableLastName}` : `${profile?.firstName} ${profile?.lastName}`}
            </h3>
            <div className="flex items-center justify-center gap-2 text-2xs text-[#9F9F9F] font-semibold">
              <span>Patient ID: {getPatientId()}</span>
              <span>·</span>
              <span className="text-green-500 dark:text-green-400 font-bold uppercase">Active</span>
            </div>
            <span className="text-[10px] text-chosen-text-muted block mt-1">Member since June 2026</span>
          </div>

          {clinicalProfile?.assigned_admin?.user ? (
            <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/80 w-full pt-3.5 text-2xs text-chosen-text-secondary flex flex-col items-center">
              <span className="text-[9px] uppercase font-bold text-chosen-text-muted tracking-wider">Assigned Practitioner</span>
              <span className="font-bold text-[#0D0C18] dark:text-white mt-0.5">
                Dr. {clinicalProfile.assigned_admin.user.first_name} {clinicalProfile.assigned_admin.user.last_name}
              </span>
              <span className="text-chosen-text-muted text-[10px]">{clinicalProfile.assigned_admin.clinic_name || 'Chelsea Clinic'}</span>
            </div>
          ) : (
            <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/80 w-full pt-3.5 text-2xs text-amber-600 font-medium">
              No clinician assigned yet.
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm">
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Quick Navigation</h3>
          <div className="grid grid-cols-2 gap-2.5 select-none">
            <button 
              onClick={() => { setMobileTab('exercises'); setSelectedAssignment(null); }}
              className="flex items-center gap-2 p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg text-2xs font-semibold text-left text-chosen-text-secondary hover:border-gold-500/35 transition-all"
            >
              <FileSpreadsheet className="h-4 w-4 text-[#A27B41]" /> My Plan
            </button>
            <button 
              onClick={() => {
                if (assignments.length > 0) {
                  navigate('/tracker', { state: { exerciseName: assignments[0].exercise?.name, rules: assignments[0].exercise?.rules } });
                } else {
                  navigate('/tracker');
                }
              }}
              className="flex items-center gap-2 p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg text-2xs font-semibold text-left text-chosen-text-secondary hover:border-gold-500/35 transition-all"
            >
              <Play className="h-4 w-4 text-[#A27B41]" /> Start Workout
            </button>
            <button 
              onClick={() => setMobileTab('appointments')}
              className="flex items-center gap-2 p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg text-2xs font-semibold text-left text-chosen-text-secondary hover:border-gold-500/35 transition-all"
            >
              <Calendar className="h-4 w-4 text-[#A27B41]" /> Appointments
            </button>
            <button 
              onClick={() => alert('Secure message portal opening...')}
              className="flex items-center gap-2 p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg text-2xs font-semibold text-left text-chosen-text-secondary hover:border-gold-500/35 transition-all"
            >
              <MessageSquare className="h-4 w-4 text-[#A27B41]" /> Message PT
            </button>
          </div>
        </div>

        {/* Settings List */}
        <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-4 space-y-2 shadow-chosen-sm">
          <button onClick={() => setShowEditProfileModal(true)} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <User className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-[#212121] dark:text-white block">Personal Information</span>
                <span className="text-2xs text-chosen-text-muted block">Edit name, email, and phone contact details</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button onClick={() => setShowChangePasswordModal(true)} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <Settings className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-[#212121] dark:text-white block">Account Settings</span>
                <span className="text-2xs text-chosen-text-muted block">Change account passwords and language</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button onClick={() => setShowNotificationSettingsModal(true)} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <Bell className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-[#212121] dark:text-white block">Notification Preferences</span>
                <span className="text-2xs text-chosen-text-muted block">Set reminders and daily workout notifications</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button onClick={() => setShowPrivacySettingsModal(true)} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <ShieldCheck className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-[#212121] dark:text-white block">Privacy & Security</span>
                <span className="text-2xs text-chosen-text-muted block">Manage HIPAA sharing settings and telemetry data</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button onClick={() => setMobileTab('progress')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <History className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-[#212121] dark:text-white block">Motion Recordings</span>
                <span className="text-2xs text-chosen-text-muted block">{sessions.length} sessions logged · View logs & graphs</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button onClick={() => alert('Support ticket loaded...')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <Info className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-[#212121] dark:text-white block">Help & Support</span>
                <span className="text-2xs text-chosen-text-muted block">Browse FAQS or reach clinic support desk</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button onClick={() => alert('Chosen Life platform, Version 1.2.0')} className="w-full flex items-center justify-between p-3 hover:bg-[#F5F5F5] dark:hover:bg-charcoal-800 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 text-[#A27B41] rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <Activity className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-[#212121] dark:text-white block">About Chosen Life</span>
                <span className="text-2xs text-chosen-text-muted block">Regulatory compliance, HIPAA info & terms</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-[#525252] dark:text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/80 my-2" />

          <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center justify-between p-3 hover:bg-red-500/5 dark:hover:bg-red-955/10 rounded-chosen-md transition-all group text-left">
            <div className="flex items-center gap-3.5">
              <div className="p-2 bg-red-500/10 text-red-500 rounded-chosen-md shrink-0 flex items-center justify-center w-9 h-9">
                <LogOut className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <span className="font-semibold text-sm text-red-500 block">Logout</span>
                <span className="text-2xs text-red-500/75 block">Sign out of patient portal session</span>
              </div>
            </div>
            <ChevronRight className="h-4.5 w-4.5 text-red-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    );
  };

  const renderProfileTablet = () => {
    return (
      <div className="space-y-6 text-left animate-fade-in py-4">
        {/* Tablet Title */}
        <div className="pb-4 border-b border-[#E5E5E5] dark:border-charcoal-800 mb-2">
          <h1 className="text-xl font-display font-bold text-[#0D0C18] dark:text-white">Profile Dashboard</h1>
          <p className="text-xs text-chosen-text-muted">Manage settings and motion analysis records.</p>
        </div>

        <div className="grid grid-cols-2 gap-6 items-start">
          {/* Column 1 - Profile Card & Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 shadow-chosen-sm text-center">
              <div className="flex flex-col items-center space-y-3.5">
                <div className="h-20 w-20 rounded-full bg-[#E6E6E6] dark:bg-charcoal-800 border-4 border-white dark:border-charcoal-700 shadow-chosen-md flex items-center justify-center font-bold text-2xl text-[#0D0C18] dark:text-white uppercase select-none overflow-hidden">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{getPatientInitials()}</span>
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white">
                    {editableFirstName ? `${editableFirstName} ${editableLastName}` : `${profile?.firstName} ${profile?.lastName}`}
                  </h3>
                  <span className="text-[10px] text-chosen-text-muted block">ID: {getPatientId()} · Active</span>
                </div>
                <Button 
                  variant="outline" 
                  className="text-2xs py-1.5 h-8 font-semibold w-full"
                  onClick={() => setShowEditProfileModal(true)}
                  leftIcon={<Settings className="h-3.5 w-3.5" />}
                >
                  Edit Profile Details
                </Button>
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-chosen rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted text-left">Quick Navigation</h3>
              <div className="grid grid-cols-1 gap-2 text-xs select-none">
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => { setMobileTab('exercises'); setSelectedAssignment(null); }}
                  leftIcon={<FileSpreadsheet className="h-4 w-4 text-[#A27B41]" />}
                >
                  My Plan
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => setMobileTab('appointments')}
                  leftIcon={<Calendar className="h-4 w-4 text-[#A27B41]" />}
                >
                  Appointments Schedule
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-red-500/10 text-red-500 border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => setShowLogoutConfirm(true)}
                  leftIcon={<LogOut className="h-4 w-4 text-red-500" />}
                >
                  Sign Out Portal
                </Button>
              </div>
            </div>
          </div>

          {/* Column 2 - Settings and Motion History */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm text-left">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Account Settings</h3>
              <div className="space-y-3.5 text-xs">
                <button onClick={() => setShowEditProfileModal(true)} className="w-full flex justify-between items-center py-1 hover:text-[#A27B41] transition-all">
                  <span className="font-semibold">Edit Contact Info</span>
                  <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
                </button>
                <button onClick={() => setShowChangePasswordModal(true)} className="w-full flex justify-between items-center py-1 hover:text-[#A27B41] transition-all">
                  <span className="font-semibold">Change password security</span>
                  <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
                </button>
                <button onClick={() => setShowNotificationSettingsModal(true)} className="w-full flex justify-between items-center py-1 hover:text-[#A27B41] transition-all">
                  <span className="font-semibold">Notification preferences</span>
                  <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
                </button>
                <button onClick={() => setShowPrivacySettingsModal(true)} className="w-full flex justify-between items-center py-1 hover:text-[#A27B41] transition-all">
                  <span className="font-semibold">HIPAA sharing bounds</span>
                  <ChevronRight className="h-4 w-4 text-chosen-text-muted" />
                </button>
              </div>
            </div>

            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm text-left">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Motion History</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 p-3 rounded-chosen-md">
                  <span className="text-chosen-text-muted font-medium">Sessions Logged</span>
                  <span className="font-bold text-[#0D0C18] dark:text-white">{sessions.length}</span>
                </div>
                <div className="flex justify-between items-center bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 p-3 rounded-chosen-md">
                  <span className="text-chosen-text-muted font-medium">Exercises Mastered</span>
                  <span className="font-bold text-[#0D0C18] dark:text-white">{uniqueExercisesCount}</span>
                </div>
                <Button
                  variant="secondary"
                  className="w-full text-2xs py-2 mt-1.5"
                  onClick={() => setMobileTab('progress')}
                >
                  View Graphs & Logs
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfileDesktop = () => {
    const recent = getRecentSessions();
    const lastSession = sessions[0];
    const lastSessionDate = lastSession 
      ? new Date(lastSession.completed_at || lastSession.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      : 'No sessions yet';

    return (
      <div className="space-y-6 text-left animate-fade-in max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Desktop Header */}
        <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-4 mb-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-bold text-[#0D0C18] dark:text-white">Patient Profile Dashboard</h1>
            <p className="text-xs text-chosen-text-muted">Manage personal settings, security authorizations, notifications, and review active recovery motion tracking history.</p>
          </div>
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-955/10 rounded-chosen-md text-red-500 border border-red-200 dark:border-red-900/20 text-xs font-semibold shadow-chosen-sm transition-all active:scale-95"
            title="Log out"
          >
            <LogOut className="h-4 w-4" /> Sign Out Portal
          </button>
        </div>

        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Left Column (col-span-3) - Profile Card & Quick Actions */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            {/* Profile Card */}
            <div className="bg-[#FAFBFC] dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 shadow-chosen-sm text-center relative overflow-hidden flex flex-col items-center space-y-4">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-[#A27B41]/5 rounded-full blur-xl pointer-events-none" />
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-[#E6E6E6] dark:bg-charcoal-800 border-4 border-white dark:border-charcoal-700 shadow-chosen-md flex items-center justify-center font-bold text-3xl text-slate-800 dark:text-white uppercase select-none overflow-hidden">
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span>{getPatientInitials()}</span>
                  )}
                </div>
              </div>
              
              <div className="space-y-1">
                <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white">
                  {editableFirstName ? `${editableFirstName} ${editableLastName}` : `${profile?.firstName} ${profile?.lastName}`}
                </h3>
                <span className="text-[10px] text-chosen-text-muted block">Patient ID: {getPatientId()}</span>
                <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-green-500/25 bg-green-500/10 text-green-500 dark:text-green-455">
                  Active Member
                </span>
              </div>

              {clinicalProfile?.assigned_admin?.user && (
                <div className="border-t border-[#E5E5E5] dark:border-charcoal-800/80 w-full pt-3.5 text-2xs text-left space-y-1">
                  <span className="text-[9px] uppercase font-bold text-chosen-text-muted tracking-wider block">Assigned Practitioner</span>
                  <span className="font-bold text-[#0D0C18] dark:text-white block">
                    Dr. {clinicalProfile.assigned_admin.user.first_name} {clinicalProfile.assigned_admin.user.last_name}
                  </span>
                  <span className="text-chosen-text-muted text-[10px] block">{clinicalProfile.assigned_admin.clinic_name || 'Chelsea Clinic'}</span>
                </div>
              )}

              <Button
                variant="primary"
                className="w-full text-2xs py-2 btn-accent font-semibold"
                onClick={() => setShowEditProfileModal(true)}
                leftIcon={<User className="h-3.5 w-3.5 fill-current" />}
              >
                Edit Profile Details
              </Button>
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Quick Actions</h3>
              <div className="flex flex-col gap-2.5 text-xs select-none">
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => { setMobileTab('exercises'); setSelectedAssignment(null); }}
                  leftIcon={<FileSpreadsheet className="h-4 w-4 text-[#A27B41]" />}
                >
                  View My Plan
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => {
                    if (assignments.length > 0) {
                      navigate('/tracker', { state: { exerciseName: assignments[0].exercise?.name, rules: assignments[0].exercise?.rules } });
                    } else {
                      navigate('/tracker');
                    }
                  }}
                  leftIcon={<Play className="h-4 w-4 text-[#A27B41]" />}
                >
                  Start Today's Exercise
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => setMobileTab('appointments')}
                  leftIcon={<Calendar className="h-4 w-4 text-[#A27B41]" />}
                >
                  Schedule Appointments
                </Button>
                <Button
                  variant="outline"
                  className="w-full text-2xs py-2 bg-slate-500/5 hover:bg-slate-500/10 text-chosen-text-secondary border-chosen flex items-center justify-start gap-2 h-9 font-semibold"
                  onClick={() => alert('Opening consultation secure portal...')}
                  leftIcon={<MessageSquare className="h-4 w-4 text-[#A27B41]" />}
                >
                  Contact Practitioner
                </Button>
              </div>
            </div>
          </div>

          {/* Center Column (col-span-5) - Personal Info & Preferences */}
          <div className="col-span-12 lg:col-span-5 space-y-6">
            {/* Personal Info Box */}
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm text-left">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Personal Information</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg">
                  <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">First Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{editableFirstName || profile?.firstName}</span>
                </div>
                <div className="p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg">
                  <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Last Name</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{editableLastName || profile?.lastName}</span>
                </div>
                <div className="p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg col-span-2">
                  <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Email Address</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{editableEmail || profile?.email}</span>
                </div>
                <div className="p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg">
                  <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Phone Contact</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">{editablePhone || '+1 (555) 019-2831'}</span>
                </div>
                <div className="p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg">
                  <span className="text-[9px] text-chosen-text-muted uppercase font-bold block">Registered Since</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 mt-0.5 block">04 Jun 2026</span>
                </div>
              </div>
            </div>

            {/* Account Settings Preferences */}
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm text-left">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Account Settings</h3>
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-[#F5F5F5] dark:border-charcoal-800/80">
                  <div className="space-y-0.5">
                    <span className="font-semibold block text-[#0D0C18] dark:text-white">Security Credentials</span>
                    <span className="text-[10px] text-chosen-text-muted block">Keep your portal access password updated</span>
                  </div>
                  <Button
                    variant="outline"
                    className="text-2xs py-1 px-3 h-8"
                    onClick={() => setShowChangePasswordModal(true)}
                  >
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[#F5F5F5] dark:border-charcoal-800/80">
                  <div className="space-y-0.5">
                    <span className="font-semibold block text-[#0D0C18] dark:text-white">Alert Deliveries</span>
                    <span className="text-[10px] text-chosen-text-muted block">Configure SMS, email and push notifications</span>
                  </div>
                  <Button
                    variant="outline"
                    className="text-2xs py-1 px-3 h-8"
                    onClick={() => setShowNotificationSettingsModal(true)}
                  >
                    Modify Channels
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-chosen-text-muted uppercase font-bold tracking-wider block">Language Preference</span>
                    <select
                      value={languagePreference}
                      onChange={e => setLanguagePreference(e.target.value as any)}
                      className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:ring-1 focus:ring-gold-500 focus:outline-none"
                    >
                      <option value="english">English (US)</option>
                      <option value="spanish">Español (ES)</option>
                      <option value="french">Français (FR)</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[9px] text-chosen-text-muted uppercase font-bold tracking-wider block">Application Theme</span>
                    <select
                      value={themePreference}
                      onChange={e => {
                        const val = e.target.value as any;
                        setThemePreference(val);
                        if (val === 'dark') {
                          document.documentElement.classList.add('dark');
                        } else if (val === 'light') {
                          document.documentElement.classList.remove('dark');
                        } else {
                          // system default
                          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                          if (isDark) document.documentElement.classList.add('dark');
                          else document.documentElement.classList.remove('dark');
                        }
                      }}
                      className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:ring-1 focus:ring-gold-500 focus:outline-none"
                    >
                      <option value="system">System Preference</option>
                      <option value="light">Light Mode</option>
                      <option value="dark">Dark Mode</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy & HIPAA */}
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-4 shadow-chosen-sm text-left">
              <div className="flex justify-between items-center pb-2 border-b border-[#F5F5F5] dark:border-charcoal-800/80">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Privacy & HIPAA Security</h3>
                <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/10">HIPAA Protected</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <div className="space-y-0.5">
                  <span className="font-semibold block text-[#0D0C18] dark:text-white">Medical Consent Preferences</span>
                  <span className="text-[10px] text-chosen-text-muted block">Manage clinic data sharing parameters</span>
                </div>
                <Button
                  variant="outline"
                  className="text-2xs py-1 px-3 h-8"
                  onClick={() => setShowPrivacySettingsModal(true)}
                >
                  Configure Privacy
                </Button>
              </div>
            </div>
          </div>

          {/* Right Column (col-span-4) - Motion History Summary */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-5 shadow-chosen-sm text-left">
              <div className="flex justify-between items-center border-b border-[#F5F5F5] dark:border-charcoal-800/80 pb-3">
                <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted flex items-center gap-1.5">
                  <History className="h-4.5 w-4.5" /> Recovery Motion Summary
                </h3>
                <button 
                  onClick={() => setMobileTab('progress')}
                  className="text-2xs font-bold text-[#A27B41] hover:underline"
                >
                  View Details
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center select-none font-semibold">
                <div className="bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-3">
                  <span className="text-[8px] text-chosen-text-muted block uppercase mb-1">Sessions Done</span>
                  <span className="font-bold text-[#0D0C18] dark:text-white text-base block">{sessions.length}</span>
                </div>
                <div className="bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-3">
                  <span className="text-[8px] text-chosen-text-muted block uppercase mb-1">Exercises Done</span>
                  <span className="font-bold text-[#0D0C18] dark:text-white text-base block">{uniqueExercisesCount}</span>
                </div>
                <div className="bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-lg p-3">
                  <span className="text-[8px] text-chosen-text-muted block uppercase mb-1">Avg Accuracy</span>
                  <span className="font-bold text-emerald-500 text-base block">{avgAccuracy}%</span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/5 border border-chosen rounded-chosen-xl text-2xs space-y-1">
                <span className="text-[8px] text-[#A27B41] uppercase tracking-widest font-bold block">Last Session Conducted</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">{lastSessionDate}</span>
              </div>

              {/* Recent Practice Logs */}
              <div className="space-y-3">
                <h4 className="text-[10px] text-chosen-text-muted font-bold uppercase tracking-wider">Recent practice records</h4>
                {recent.length === 0 ? (
                  <p className="text-2xs text-chosen-text-muted text-center py-4 bg-[#FAFBFC] dark:bg-charcoal-900 rounded-chosen-xl border border-chosen">No recordings logged. Start workout!</p>
                ) : (
                  <div className="space-y-2.5">
                    {recent.map(s => (
                      <div key={s.id} className="flex justify-between items-center p-3 bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800/80 rounded-chosen-xl text-xs hover:border-gold-500/35 transition-all">
                        <div className="text-left space-y-0.5 min-w-0">
                          <span className="font-bold block truncate max-w-[140px] text-slate-800 dark:text-slate-200">{s.title || 'Workout'}</span>
                          <span className="text-[9px] text-chosen-text-muted block font-mono">
                            {new Date(s.completed_at || s.created_at).toLocaleDateString()} · {s.duration_seconds || 0}s
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="font-bold text-[#A27B41] block">{s.avg_score || s.score || 0}% Form</span>
                            <span className="text-[9px] text-chosen-text-muted block font-mono font-semibold">{Math.round(s.range_of_motion || 0)}° ROM</span>
                          </div>
                          <button
                            onClick={() => navigate(`/patient/session/${s.id}`)}
                            className="p-1 bg-[#F5F5F5] dark:bg-charcoal-800 hover:bg-gold-500/10 hover:text-[#A27B41] rounded-chosen-sm text-chosen-text-secondary transition-all"
                            title="Replay video coordinates"
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

            {/* Clinic Support Card */}
            <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-5 space-y-3.5 shadow-chosen-sm text-left">
              <h3 className="font-display font-bold text-xs uppercase tracking-wider text-chosen-text-muted">Platform Support</h3>
              <div className="flex gap-3 text-xs bg-[#FAFBFC] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 p-3.5 rounded-chosen-xl items-center">
                <Info className="h-5 w-5 text-[#A27B41] shrink-0" />
                <div className="space-y-0.5">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">Chosen Life Helper</span>
                  <span className="text-[10px] text-chosen-text-secondary block">Need troubleshooting? Reach our HIPAA care center.</span>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full text-2xs py-2"
                onClick={() => alert('Support tickets can be submitted by email at support@chosenlife.com')}
              >
                Request Help Ticket
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderProfileModals = () => {
    return (
      <>
        {/* Logout Confirmation Dialog */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-6 text-center shadow-2xl">
              <div className="flex flex-col items-center space-y-3">
                <div className="h-12 w-12 bg-red-100 dark:bg-red-955/20 text-red-500 rounded-full flex items-center justify-center border border-red-200 dark:border-red-900/30">
                  <LogOut className="h-6 w-6" />
                </div>
                <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white">
                  Sign Out Confirmation
                </h3>
                <p className="text-xs text-chosen-text-secondary leading-relaxed">
                  Are you sure you want to sign out of your Chosen Life active patient dashboard?
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1 text-2xs py-2 border-none"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 text-2xs py-2 bg-red-500 hover:bg-red-650 border-none text-white font-semibold"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    signOut();
                  }}
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Profile Modal */}
        {showEditProfileModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-left shadow-2xl">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-3">
                <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white flex items-center gap-2">
                  <User className="h-4.5 w-4.5 text-[#A27B41]" />
                  Edit Profile Details
                </h3>
                <button 
                  onClick={() => setShowEditProfileModal(false)}
                  className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-slate-800 rounded-lg text-chosen-text-muted transition-all"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); setShowEditProfileModal(false); }} className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">First Name</label>
                  <input 
                     type="text"
                     value={editableFirstName}
                     onChange={e => setEditableFirstName(e.target.value)}
                     className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">Last Name</label>
                  <input 
                     type="text"
                     value={editableLastName}
                     onChange={e => setEditableLastName(e.target.value)}
                     className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-gold-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">Email Address</label>
                  <input 
                     type="email"
                     value={editableEmail}
                     onChange={e => setEditableEmail(e.target.value)}
                     className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">Phone Number</label>
                  <input 
                     type="text"
                     value={editablePhone}
                     onChange={e => setEditablePhone(e.target.value)}
                     className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">Upload Profile Photo (URL)</label>
                  <input 
                     type="text"
                     placeholder="https://example.com/avatar.jpg"
                     value={profilePhoto || ''}
                     onChange={e => setProfilePhoto(e.target.value || null)}
                     className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-gold-500"
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1 text-2xs py-2 border-none"
                    onClick={() => setShowEditProfileModal(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 text-2xs py-2 btn-accent"
                    type="submit"
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-left shadow-2xl">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-3">
                <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white flex items-center gap-2">
                  <Settings className="h-4.5 w-4.5 text-[#A27B41]" />
                  Change Password
                </h3>
                <button 
                  onClick={() => setShowChangePasswordModal(false)}
                  className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-slate-800 rounded-lg text-chosen-text-muted transition-all"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); alert('Password updated successfully (simulated).'); setShowChangePasswordModal(false); }} className="space-y-4 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">Current Password</label>
                  <input 
                    type="password"
                    required
                    className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">New Password</label>
                  <input 
                    type="password"
                    required
                    className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-chosen-text-muted uppercase tracking-wider block mb-1">Confirm New Password</label>
                  <input 
                    type="password"
                    required
                    className="w-full px-3 py-2 bg-[#F5F5F5] dark:bg-charcoal-900 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-md text-chosen-text-primary text-xs focus:outline-none"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="secondary"
                    className="flex-1 text-2xs py-2 border-none"
                    onClick={() => setShowChangePasswordModal(false)}
                    type="button"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1 text-2xs py-2 btn-accent"
                    type="submit"
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Notification Settings Modal */}
        {showNotificationSettingsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-left shadow-2xl">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-3">
                <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white flex items-center gap-2">
                  <Bell className="h-4.5 w-4.5 text-[#A27B41]" />
                  Notification Channels
                </h3>
                <button 
                  onClick={() => setShowNotificationSettingsModal(false)}
                  className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-slate-800 rounded-lg text-chosen-text-muted transition-all"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between p-1">
                  <div>
                    <span className="font-semibold text-xs text-chosen-text-primary block">Email Alerts</span>
                    <span className="text-[10px] text-chosen-text-muted block mt-0.5">Receive bi-weekly progress reports</span>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded-md border-[#E5E5E5] text-[#A27B41] focus:ring-gold-500 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between p-1">
                  <div>
                    <span className="font-semibold text-xs text-chosen-text-primary block">SMS Reminders</span>
                    <span className="text-[10px] text-chosen-text-muted block mt-0.5">Get texted 30 minutes before exercises</span>
                  </div>
                  <input type="checkbox" defaultChecked className="h-4 w-4 rounded-md border-[#E5E5E5] text-[#A27B41] focus:ring-gold-500 cursor-pointer" />
                </div>
                <div className="flex items-center justify-between p-1">
                  <div>
                    <span className="font-semibold text-xs text-chosen-text-primary block">Push Notifications</span>
                    <span className="text-[10px] text-chosen-text-muted block mt-0.5">In-app popups during practitioner messages</span>
                  </div>
                  <input type="checkbox" className="h-4 w-4 rounded-md border-[#E5E5E5] text-[#A27B41] focus:ring-gold-500 cursor-pointer" />
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full text-2xs py-2 btn-accent font-semibold"
                  onClick={() => setShowNotificationSettingsModal(false)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Privacy Settings Modal */}
        {showPrivacySettingsModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in select-none">
            <div className="bg-white dark:bg-[#121122] border border-[#E5E5E5] dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 text-left shadow-2xl">
              <div className="flex justify-between items-center border-b border-[#E5E5E5] dark:border-charcoal-800 pb-3">
                <h3 className="font-display font-bold text-sm text-[#0D0C18] dark:text-white flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-[#A27B41]" />
                  Privacy & HIPAA Compliance
                </h3>
                <button 
                  onClick={() => setShowPrivacySettingsModal(false)}
                  className="p-1 hover:bg-[#F5F5F5] dark:hover:bg-slate-800 rounded-lg text-chosen-text-muted transition-all"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-start gap-3 p-1">
                  <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded-md border-[#E5E5E5] text-[#A27B41] cursor-pointer" />
                  <div>
                    <span className="font-semibold text-xs text-chosen-text-primary block">Share skeleton coordinates with clinic</span>
                    <span className="text-[10px] text-chosen-text-muted block mt-0.5">Allows practitioner to review joint range-of-motion metrics</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-1">
                  <input type="checkbox" defaultChecked className="mt-1 h-4 w-4 rounded-md border-[#E5E5E5] text-[#A27B41] cursor-pointer" />
                  <div>
                    <span className="font-semibold text-xs text-chosen-text-primary block">Strict HIPAA protection rules</span>
                    <span className="text-[10px] text-chosen-text-muted block mt-0.5">Encrypts all data transmission and restricts metadata visibility</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-1">
                  <input type="checkbox" className="mt-1 h-4 w-4 rounded-md border-[#E5E5E5] text-[#A27B41] cursor-pointer" />
                  <div>
                    <span className="font-semibold text-xs text-chosen-text-primary block">Anonymized telemetry uploads</span>
                    <span className="text-[10px] text-chosen-text-muted block mt-0.5">Strip name identifier from mathematical pose estimations</span>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  className="w-full text-2xs py-2 btn-accent font-semibold"
                  onClick={() => setShowPrivacySettingsModal(false)}
                >
                  Dismiss Settings
                </Button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const bottomNavigation = (
    <div className="fixed bottom-3 left-4 right-4 h-16 bg-[#0D0C18] border border-white/5 px-4 flex justify-between items-center z-30 shadow-[0_8px_30px_rgb(0,0,0,0.35)] rounded-[12px]">
      <button onClick={() => setMobileTab('overview')} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'overview' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
        <Home className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Home</span>
      </button>
      <button onClick={() => { setMobileTab('exercises'); setSelectedAssignment(null); }} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'exercises' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
        <FileSpreadsheet className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">My Plan</span>
      </button>
      <button onClick={() => setMobileTab('progress')} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'progress' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
        <Target className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Move</span>
      </button>
      <button onClick={() => setMobileTab('appointments')} className={cn("flex flex-col items-center gap-1.5 flex-1 py-1 transition-all active:scale-90", mobileTab === 'appointments' ? "text-[#A27B41]" : "text-[#A3A3A3]")}>
        <Calendar className="h-4.5 w-4.5" />
        <span className="text-[9px] font-bold uppercase tracking-wider">Appointments</span>
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
            <button onClick={() => { setMobileTab('exercises'); setSelectedAssignment(null); }} className={cn("pb-1 transition-all border-b-2 hover:text-[#A27B41]", mobileTab === 'exercises' ? "border-[#A27B41] text-[#A27B41] font-bold" : "border-transparent text-chosen-text-muted")}>My Plan</button>
            <button onClick={() => setMobileTab('progress')} className={cn("pb-1 transition-all border-b-2 hover:text-[#A27B41]", mobileTab === 'progress' ? "border-[#A27B41] text-[#A27B41] font-bold" : "border-transparent text-chosen-text-muted")}>Move</button>
            <button onClick={() => setMobileTab('appointments')} className={cn("pb-1 transition-all border-b-2 hover:text-[#A27B41]", mobileTab === 'appointments' ? "border-[#A27B41] text-[#A27B41] font-bold" : "border-transparent text-chosen-text-muted")}>Appointments</button>
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
            <div className="space-y-8 text-left animate-fade-in max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                  {greetingHeader}
                  {clinicalProfileBanner}
                </div>
                <div>
                  {nextAppointmentCard}
                </div>
              </div>

              {statsRow}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="space-y-8">
                  {todaysWorkoutCard}
                  {quickStartCard}
                </div>
                <div className="space-y-8">
                  {upcomingSchedule}
                  {quickActionsCard}
                </div>
                <div className="space-y-8">
                  {progressAnalytics}
                </div>
              </div>
            </div>
          )}

          {mobileTab === 'exercises' && (
            selectedAssignment ? renderExerciseDetails() : (
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
          )
          )}

          {mobileTab === 'progress' && (
            <div className="space-y-8 text-left animate-fade-in max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {statsRow}
              <div className="grid grid-cols-3 gap-8 text-left items-start">
                <div className="col-span-2 space-y-8">{progressAnalytics}</div>
                <div className="space-y-8">{practiceLogsHistory}</div>
              </div>
            </div>
          )}

          {mobileTab === 'appointments' && renderAppointmentsDesktop()}
          {mobileTab === 'profile' && renderProfileDesktop()}
        </div>

        <div className="hidden md:block lg:hidden text-left">
          {mobileTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              {greetingHeader}
              {clinicalProfileBanner}
              
              {statsRow}

              <div className="grid grid-cols-2 gap-8 items-start">
                <div className="space-y-8">{todaysWorkoutCard}{quickStartCard}</div>
                <div className="space-y-8">{nextAppointmentCard}{progressAnalytics}{upcomingSchedule}{practiceLogsHistory}</div>
              </div>
            </div>
          )}

          {mobileTab === 'exercises' && (
            selectedAssignment ? renderExerciseDetails() : (
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
          )
          )}

          {mobileTab === 'progress' && (
            <div className="space-y-8 text-left animate-fade-in">
              {statsRow}
              <div className="grid grid-cols-2 gap-8 items-start">
                <div>{progressAnalytics}</div>
                <div className="space-y-8">{practiceLogsHistory}</div>
              </div>
            </div>
          )}
          {mobileTab === 'appointments' && renderAppointmentsTablet()}
          {mobileTab === 'profile' && renderProfileTablet()}
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
            selectedAssignment ? renderExerciseDetails() : (
              <div className="space-y-6 animate-slide-up text-left">
                <div className="bg-white dark:bg-charcoal-850 border border-[#E5E5E5] dark:border-charcoal-800 rounded-chosen-xl p-4 space-y-3 shadow-chosen-sm">{calendarRow}</div>
                {progressRingCard}
                {renderMyPlanExercises()}
              </div>
            )
          )}
          {mobileTab === 'progress' && (
            <div className="space-y-6 text-left animate-slide-up">
              {progressAnalytics}
              {practiceLogsHistory}
            </div>
          )}
          {mobileTab === 'appointments' && renderAppointmentsMobile()}
          {mobileTab === 'profile' && renderProfileMobile()}
        </div>
      </ContentWrapper>
      {renderRescheduleModal()}
      {renderProfileModals()}
    </PageContainer>
  );
};

export default PatientDashboard;
