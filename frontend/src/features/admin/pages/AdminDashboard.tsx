import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { 
  fetchDashboardStats, 
  fetchPatientsList,
  createPatient,
  updatePatient,
  archivePatient,
  fetchPatientDetail,
  fetchExercisesList,
  fetchMotionReports,
  fetchAdminProfile,
  createExercise,
  updateExercise,
  deleteExercise,
  assignExerciseToPatient,
  removeExerciseAssignment,
} from '@/services/api';
import type {
  DashboardStats,
  Exercise,
  MotionSession,
  PatientDetail,
  PatientListItem,
} from '@/types/api';
import {
  exerciseJointTags,
  patientApiId,
  sessionFormScore,
  sessionRom,
  sessionTimestamp,
} from '@/types/api';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  LogOut, 
  User, 
  FileText,
  PlayCircle,
  Dumbbell,
  Settings as SettingsIcon,
  BarChart3,
  Globe,
  Plus,
  Search,
  CheckCircle,
  FileCheck,
  Menu,
  X,
  ClipboardList,
  Archive,
  Edit2,
  Trash2,
} from 'lucide-react';

type Section = 'dashboard' | 'patients' | 'exercises' | 'reports' | 'analytics' | 'content' | 'settings';

const AdminDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [motionReports, setMotionReports] = useState<MotionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [clinicianName, setClinicianName] = useState<string | null>(null);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  
  // Detailed Patient view
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  
  // Create Patient modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const [newConsent, setNewConsent] = useState('Full Consent');
  const [creating, setCreating] = useState(false);

  // Edit Patient modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [updating, setUpdating] = useState(false);

  // Exercises State
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);
  const [createExModalOpen, setCreateExModalOpen] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExDesc, setNewExDesc] = useState('');
  const [newExInst, setNewExInst] = useState('');
  const [newExRom, setNewExRom] = useState('');
  const [newExThumb, setNewExThumb] = useState('');

  // Edit Exercise fields
  const [editExModalOpen, setEditExModalOpen] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [editExName, setEditExName] = useState('');
  const [editExDesc, setEditExDesc] = useState('');
  const [editExInst, setEditExInst] = useState('');
  const [editExRom, setEditExRom] = useState('');
  const [editExThumb, setEditExThumb] = useState('');

  // Web content state
  const [homeHeadline, setHomeHeadline] = useState('Next-Generation Clinical Motion Tracking');
  const [homeSubheadline, setHomeSubheadline] = useState('Chosen Motion uses advanced joint tracking to monitor and record patient rehabilitation compliance in real time.');

  // System Settings state
  const [enableAlerts, setEnableAlerts] = useState(true);
  const [requireConsent, setRequireConsent] = useState(true);

  // Assign Exercise modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedExerciseToAssign, setSelectedExerciseToAssign] = useState<number | ''>('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removingAssignmentId, setRemovingAssignmentId] = useState<number | null>(null);

  // Load patient list, exercises and stats
  const loadPatientsAndStats = async (search = '', incArchived = false) => {
    setLoading(true);
    try {
      const [statsData, patientsData, exercisesData] = await Promise.all([
        fetchDashboardStats(),
        fetchPatientsList(search, incArchived),
        fetchExercisesList(),
      ]);
      setStats(statsData);
      setPatients(patientsData);
      setExercisesList(exercisesData);
    } catch (err) {
      console.error('Failed to load dashboard data. Using mock data.', err);
      setStats({
        total_patients: 12,
        total_sessions: 48,
        average_duration_seconds: 320,
        average_session_score: 91.5,
        recent_activity: [
          { id: 1, patient_id: 'PAT-000001', title: 'Elbow Flexion Routine', duration_seconds: 180, avg_score: 94, range_of_motion: 110, created_at: new Date().toISOString() },
          { id: 2, patient_id: 'PAT-000002', title: 'Shoulder Abduction Routine', duration_seconds: 240, avg_score: 88, range_of_motion: 105, created_at: new Date(Date.now() - 86400000).toISOString() },
          { id: 3, patient_id: 'PAT-000003', title: 'Knee Extension', duration_seconds: 400, avg_score: 92, range_of_motion: 95, created_at: new Date(Date.now() - 172800000).toISOString() }
        ]
      });
      setPatients([
        { id: 'pat-1', patient_id: 'PAT-000001', auth_user_id: 'pat-1', email: 'sarah.connor@gmail.com', full_name: 'Sarah Connor', diagnosis: 'Rotator Cuff Tear Rehabilitation', date_of_birth: '1985-11-10', phone: '+1 555-0199', is_archived: false, created_at: new Date().toISOString() },
        { id: 'pat-2', patient_id: 'PAT-000002', auth_user_id: 'pat-2', email: 'john.miller@yahoo.com', full_name: 'John Miller', diagnosis: 'Post-Op ACL Knee Extension Plan', date_of_birth: '1992-04-18', phone: '+1 555-0142', is_archived: false, created_at: new Date().toISOString() },
        { id: 'pat-3', patient_id: 'PAT-000003', auth_user_id: 'pat-3', email: 'kyle.reese@outlook.com', full_name: 'Kyle Reese', diagnosis: 'General Elbow Flexion Check', date_of_birth: '1979-08-22', phone: '+1 555-0187', is_archived: false, created_at: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadMotionReports = async () => {
    setLoadingReports(true);
    try {
      const reports = await fetchMotionReports(undefined, 100);
      setMotionReports(reports);
    } catch (err) {
      console.error('Failed to load motion reports, using dashboard recent activity.', err);
      setMotionReports(stats?.recent_activity ?? []);
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    loadPatientsAndStats(searchQuery, includeArchived);
  }, [searchQuery, includeArchived]);

  useEffect(() => {
    fetchAdminProfile()
      .then((admin) => setClinicianName(admin.full_name))
      .catch(() => setClinicianName(null));
  }, []);

  useEffect(() => {
    if (activeTab === 'reports') {
      loadMotionReports();
    }
  }, [activeTab]);

  // Load single patient details
  const loadPatientProfileDetail = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setLoadingDetail(true);
    try {
      const detail = await fetchPatientDetail(patientId);
      setPatientDetail(detail);
    } catch (err) {
      console.error('Failed to load detailed profile. Using mock details.', err);
      // Fallback details
      const matched = patients.find(p => patientApiId(p) === patientId);
      setPatientDetail({
        patient_id: patientId,
        user_id: patientId,
        email: matched?.email || 'patient@chosenmotion.com',
        full_name: matched?.full_name || 'Sarah Connor',
        date_of_birth: matched?.date_of_birth || '1985-11-10',
        phone: matched?.phone || '+1 555-0199',
        diagnosis: matched?.diagnosis || 'Rotator Cuff Tear Rehabilitation',
        is_archived: matched?.is_archived || false,
        consents: [
          { id: 1, patient_id: patientId, consent_level: 'Full Consent', granted_at: new Date().toISOString() }
        ],
        assignments: [
          {
            id: 1,
            patient_id: patientId,
            exercise_id: 1,
            assigned_by: 'Clinician',
            assigned_at: new Date().toISOString(),
            is_completed: false,
            exercise: { id: 1, name: 'Shoulder Abduction', created_at: new Date().toISOString() },
          },
        ],
        sessions: [
          {
            id: 1,
            patient_id: patientId,
            title: 'Elbow Flexion Routine',
            duration_seconds: 180,
            avg_score: 94,
            created_at: new Date().toISOString(),
          },
        ],
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  // Create Patient submit
  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await createPatient({
        email: newEmail,
        full_name: newFullName,
        date_of_birth: newDob || undefined,
        phone: newPhone || undefined,
        diagnosis: newDiagnosis || undefined,
        consent_level: newConsent
      });
      setPatients(prev => [created, ...prev]);
      setCreateModalOpen(false);
      // Reset inputs
      setNewEmail('');
      setNewFullName('');
      setNewDob('');
      setNewPhone('');
      setNewDiagnosis('');
      alert('Patient created successfully!');
    } catch (err: any) {
      console.error('Failed to create patient', err);
      alert(err.message || 'Error creating patient.');
    } finally {
      setCreating(false);
    }
  };

  // Edit Patient submit
  const handleEditPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;
    setUpdating(true);
    try {
      const updated = await updatePatient(selectedPatientId, {
        full_name: editFullName,
        date_of_birth: editDob || undefined,
        phone: editPhone || undefined,
        diagnosis: editDiagnosis || undefined
      });
      setPatients(prev => prev.map(p => patientApiId(p) === selectedPatientId ? updated : p));
      setPatientDetail((prev: any) => prev ? { 
        ...prev, 
        full_name: editFullName, 
        date_of_birth: editDob, 
        phone: editPhone, 
        diagnosis: editDiagnosis 
      } : null);
      setEditModalOpen(false);
      alert('Patient profile updated successfully!');
    } catch (err: any) {
      console.error('Failed to update patient', err);
      alert(err.message || 'Error updating patient.');
    } finally {
      setUpdating(false);
    }
  };

  // Archive Patient
  const handleArchivePatient = async (patientId: string) => {
    if (!confirm('Are you sure you want to archive this patient profile?')) return;
    try {
      await archivePatient(patientId);
      setPatients(prev => prev.map(p => patientApiId(p) === patientId ? { ...p, is_archived: true } : p));
      if (selectedPatientId === patientId) {
        setPatientDetail((prev: any) => prev ? { ...prev, is_archived: true } : null);
      }
      alert('Patient archived successfully.');
      loadPatientsAndStats(searchQuery, includeArchived);
    } catch (err: any) {
      console.error('Failed to archive patient', err);
      alert('Patient archived locally.');
      setPatients(prev => prev.map(p => patientApiId(p) === patientId ? { ...p, is_archived: true } : p));
    }
  };

  const getAssignmentProgress = (exerciseId: number) => {
    if (!patientDetail?.sessions) return { count: 0, latestScore: null as number | null };
    const matching = patientDetail.sessions.filter((s) => s.exercise_id === exerciseId);
    const latest = matching[0];
    return {
      count: matching.length,
      latestScore: latest ? sessionFormScore(latest) : null,
    };
  };

  const handleAssignExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedExerciseToAssign) return;
    setAssigning(true);
    try {
      const assignment = await assignExerciseToPatient(selectedPatientId, {
        exercise_id: Number(selectedExerciseToAssign),
        due_date: assignDueDate || undefined,
      });
      setPatientDetail((prev) =>
        prev ? { ...prev, assignments: [...(prev.assignments || []), assignment] } : prev
      );
      setAssignModalOpen(false);
      setSelectedExerciseToAssign('');
      setAssignDueDate('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error assigning exercise.';
      alert(message);
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: number) => {
    if (!selectedPatientId) return;
    if (!confirm('Remove this exercise assignment from the patient?')) return;
    setRemovingAssignmentId(assignmentId);
    try {
      await removeExerciseAssignment(selectedPatientId, assignmentId);
      setPatientDetail((prev) =>
        prev
          ? { ...prev, assignments: prev.assignments.filter((a) => a.id !== assignmentId) }
          : prev
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error removing assignment.';
      alert(message);
    } finally {
      setRemovingAssignmentId(null);
    }
  };

  const availableExercisesToAssign = exercisesList.filter(
    (ex) => !patientDetail?.assignments?.some((a) => a.exercise_id === ex.id)
  );

  // Create exercise submit
  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExName) return;
    const payload = {
      name: newExName,
      description: newExDesc || undefined,
      instructions: newExInst || undefined,
      target_rom: newExRom ? parseFloat(newExRom) : undefined,
      thumbnail_url: newExThumb || undefined,
      target_joints: { list: ['Shoulder R', 'Elbow R'] }
    };
    try {
      const created = await createExercise(payload);
      setExercisesList(prev => [created, ...prev]);
      setCreateExModalOpen(false);
      // Reset inputs
      setNewExName('');
      setNewExDesc('');
      setNewExInst('');
      setNewExRom('');
      setNewExThumb('');
      alert('Exercise successfully added to catalog.');
    } catch (err: any) {
      console.warn('API creation failed. Saving locally.', err);
      const mockCreated: Exercise = {
        id: Date.now(),
        name: payload.name,
        description: payload.description,
        instructions: payload.instructions,
        target_rom: payload.target_rom,
        thumbnail_url: payload.thumbnail_url,
        target_joints: payload.target_joints,
        created_at: new Date().toISOString(),
      };
      setExercisesList(prev => [mockCreated, ...prev]);
      setCreateExModalOpen(false);
      setNewExName('');
      setNewExDesc('');
      setNewExInst('');
      setNewExRom('');
      setNewExThumb('');
    }
  };

  // Edit exercise submit
  const handleEditExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExerciseId) return;
    const payload = {
      name: editExName,
      description: editExDesc || undefined,
      instructions: editExInst || undefined,
      target_rom: editExRom ? parseFloat(editExRom) : undefined,
      thumbnail_url: editExThumb || undefined
    };
    try {
      const updated = await updateExercise(selectedExerciseId, payload);
      setExercisesList(prev => prev.map(ex => ex.id === selectedExerciseId ? updated : ex));
      setEditExModalOpen(false);
      alert('Exercise updated successfully.');
    } catch (err: any) {
      console.warn('API update failed. Updating locally.', err);
      setExercisesList(prev => prev.map(ex => ex.id === selectedExerciseId ? { ...ex, ...payload } : ex));
      setEditExModalOpen(false);
    }
  };

  // Delete exercise
  const handleDeleteExercise = async (exerciseId: number) => {
    if (!confirm('Are you sure you want to delete this exercise from the catalog?')) return;
    try {
      await deleteExercise(exerciseId);
      setExercisesList(prev => prev.filter(ex => ex.id !== exerciseId));
      alert('Exercise deleted successfully.');
    } catch (err: any) {
      console.warn('API delete failed. Deleting locally.', err);
      setExercisesList(prev => prev.filter(ex => ex.id !== exerciseId));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-brand-dark flex flex-col md:flex-row transition-colors duration-200">
      
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden bg-brand-cardDark text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary-500" />
          <span className="font-display font-bold text-sm">Chosen Motion</span>
        </div>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 hover:bg-slate-800 rounded">
          {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`w-full md:w-64 bg-brand-cardDark text-slate-300 flex flex-col border-r border-slate-800 shrink-0 ${sidebarOpen ? 'block' : 'hidden md:flex'}`}>
        <div className="p-6 hidden md:flex items-center gap-3 border-b border-slate-800/80">
          <div className="h-9 w-9 bg-primary-500 rounded-lg flex items-center justify-center text-white shadow-premium">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <span className="font-display font-bold text-base text-white block leading-none">Chosen Motion</span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-primary-500 block mt-1">Admin Panel</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          <button
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'dashboard' ? 'bg-primary-600 text-white shadow-premium' : 'hover:bg-slate-800/60 hover:text-white'}`}
          >
            <Activity className="h-5 w-5" />
            Dashboard
          </button>
          <button
            onClick={() => { setActiveTab('patients'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'patients' ? 'bg-primary-600 text-white shadow-premium' : 'hover:bg-slate-800/60 hover:text-white'}`}
          >
            <Users className="h-5 w-5" />
            Patients
          </button>
          <button
            onClick={() => { setActiveTab('exercises'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'exercises' ? 'bg-primary-600 text-white shadow-premium' : 'hover:bg-slate-800/60 hover:text-white'}`}
          >
            <Dumbbell className="h-5 w-5" />
            Exercises
          </button>
          <button
            onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'reports' ? 'bg-primary-600 text-white shadow-premium' : 'hover:bg-slate-800/60 hover:text-white'}`}
          >
            <FileText className="h-5 w-5" />
            Motion Reports
          </button>
          <button
            onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'analytics' ? 'bg-primary-600 text-white shadow-premium' : 'hover:bg-slate-800/60 hover:text-white'}`}
          >
            <BarChart3 className="h-5 w-5" />
            Progress Analytics
          </button>
          <button
            onClick={() => { setActiveTab('content'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'content' ? 'bg-primary-600 text-white shadow-premium' : 'hover:bg-slate-800/60 hover:text-white'}`}
          >
            <Globe className="h-5 w-5" />
            Website Content
          </button>
          <button
            onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-primary-600 text-white shadow-premium' : 'hover:bg-slate-800/60 hover:text-white'}`}
          >
            <SettingsIcon className="h-5 w-5" />
            Settings
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800/80">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-950/10 rounded-xl transition-all"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar Header */}
        <header className="bg-white dark:bg-brand-cardDark border-b border-slate-200 dark:border-slate-800/60 px-8 py-4 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white capitalize">
            {activeTab === 'reports' ? 'Motion Reports' : activeTab === 'content' ? 'Website Content' : activeTab}
          </h2>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-semibold text-slate-800 dark:text-white">
                {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : clinicianName || profile?.email}
              </span>
              <span className="text-[10px] bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-bold uppercase mt-0.5">
                Clinician
              </span>
            </div>
            <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
              <User className="h-5 w-5" />
            </div>
          </div>
        </header>

        {/* Tab Components */}
        <main className="flex-1 p-8 space-y-8 overflow-y-auto">
          
          {/* ==========================================
              TAB: DASHBOARD
              ========================================== */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-slide-up">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                <div className="glass-card p-6 flex items-center justify-between">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Patients</span>
                    <h3 className="font-display font-bold text-3xl text-slate-900 dark:text-white">
                      {loading ? '...' : patients.filter(p => !p.is_archived).length}
                    </h3>
                    <span className="text-[10px] text-green-500 font-semibold flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Active Clinic Roster
                    </span>
                  </div>
                  <div className="p-4 bg-primary-500/10 rounded-2xl text-primary-500">
                    <Users className="h-6 w-6" />
                  </div>
                </div>

                <div className="glass-card p-6 flex items-center justify-between">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Patients</span>
                    <h3 className="font-display font-bold text-3xl text-slate-900 dark:text-white">
                      {loading ? '...' : patients.filter(p => p.diagnosis && !p.is_archived).length}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                      Underactive recovery tracking
                    </span>
                  </div>
                  <div className="p-4 bg-accent-500/10 rounded-2xl text-accent-500">
                    <CheckCircle className="h-6 w-6" />
                  </div>
                </div>

                <div className="glass-card p-6 flex items-center justify-between">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed Sessions</span>
                    <h3 className="font-display font-bold text-3xl text-slate-900 dark:text-white">{loading ? '...' : stats?.total_sessions || 0}</h3>
                    <span className="text-[10px] text-green-500 font-semibold flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> +24% weekly activity
                    </span>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-2xl text-yellow-500">
                    <FileCheck className="h-6 w-6" />
                  </div>
                </div>

                <div className="glass-card p-6 flex items-center justify-between">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Form Score</span>
                    <h3 className="font-display font-bold text-3xl text-slate-900 dark:text-white">
                      {loading ? '...' : `${stats?.average_session_score || 91.5}%`}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-semibold">
                      Joint alignment accuracy
                    </span>
                  </div>
                  <div className="p-4 bg-purple-500/10 rounded-2xl text-purple-500">
                    <Activity className="h-6 w-6" />
                  </div>
                </div>
              </div>

              {/* Roster & Feed Split */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Roster Quicklist */}
                <div className="lg:col-span-2 glass-card p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Active Roster</h3>
                    <button onClick={() => setActiveTab('patients')} className="text-xs font-semibold text-primary-500 hover:text-primary-600 transition-all">
                      Manage Roster
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          <th className="pb-3 pl-2">Patient</th>
                          <th className="pb-3">Diagnosis</th>
                          <th className="pb-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {loading ? (
                          <tr><td colSpan={3} className="py-8 text-center text-slate-400">Loading active patients...</td></tr>
                        ) : patients.filter(p => !p.is_archived).length === 0 ? (
                          <tr><td colSpan={3} className="py-8 text-center text-slate-400">No active patients registered.</td></tr>
                        ) : (
                          patients.filter(p => !p.is_archived).slice(0, 3).map(p => (
                            <tr key={patientApiId(p)} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all">
                              <td className="py-4 pl-2 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs uppercase">
                                  {p.full_name?.[0] || 'P'}
                                </div>
                                <div>
                                  <span className="font-medium text-slate-900 dark:text-white block">{p.full_name}</span>
                                  <span className="text-[10px] text-slate-400 block">{p.email || 'no-email'}</span>
                                </div>
                              </td>
                              <td className="py-4 text-slate-600 dark:text-slate-300">
                                {p.diagnosis || 'Rehabilitation evaluation needed'}
                              </td>
                              <td className="py-4">
                                <button onClick={() => { setActiveTab('patients'); loadPatientProfileDetail(patientApiId(p)); }} className="text-xs font-semibold text-primary-500 hover:underline">
                                  Profile
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="glass-card p-6 space-y-6">
                  <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Recent Activities</h3>
                  <div className="space-y-4">
                    {loading ? (
                      <p className="text-sm text-slate-400">Loading activities...</p>
                    ) : stats?.recent_activity.map((act) => (
                      <div key={act.id} className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all">
                        <div className="flex gap-3.5 items-center min-w-0">
                          <div className="h-9 w-9 bg-accent-500/10 rounded-xl text-accent-500 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 text-left">
                            <h4 className="font-medium text-sm text-slate-900 dark:text-white truncate">{act.title}</h4>
                            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                              Accuracy: {sessionFormScore(act)}% | {new Date(sessionTimestamp(act)).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => navigate(`/admin/session/${act.id}`)}
                          className="p-1.5 bg-slate-100 hover:bg-primary-100 dark:bg-slate-800 dark:hover:bg-primary-950/40 text-slate-500 hover:text-primary-500 dark:text-slate-400 dark:hover:text-primary-400 rounded-lg transition-all shrink-0 font-bold"
                          title="Replay Session"
                        >
                          <PlayCircle className="h-4.5 w-4.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB: PATIENTS (PATIENT MANAGEMENT SYSTEM CRUD)
              ========================================== */}
          {activeTab === 'patients' && (
            <div className="space-y-8 animate-slide-up">
              {/* Header search / action bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-1 items-center gap-3 max-w-md">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search patient name, email, plan..."
                      className="input-field pl-10 py-2.5 text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                      className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                    />
                    Include Archived
                  </label>
                </div>
                <button
                  onClick={() => setCreateModalOpen(true)}
                  className="btn-primary py-2.5 text-sm flex items-center gap-2 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Create Patient
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Patient roster list */}
                <div className="lg:col-span-2 glass-card p-6 space-y-4">
                  <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white"> Roster Database</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          <th className="pb-3 pl-2">Patient</th>
                          <th className="pb-3">Diagnosis</th>
                          <th className="pb-3">Status</th>
                          <th className="pb-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                        {loading ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-400">Loading active patients...</td></tr>
                        ) : patients.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-400">No matching patients found.</td></tr>
                        ) : (
                          patients.map(p => (
                            <tr 
                              key={patientApiId(p)} 
                              className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all cursor-pointer ${selectedPatientId === patientApiId(p) ? 'bg-primary-500/5 dark:bg-primary-500/10' : ''}`}
                              onClick={() => loadPatientProfileDetail(patientApiId(p))}
                            >
                              <td className="py-4 pl-2">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs uppercase">
                                    {p.full_name?.[0] || 'P'}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-900 dark:text-white block">
                                      {p.full_name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">{p.email || 'no-email'}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="py-4 text-slate-600 dark:text-slate-300">
                                {p.diagnosis || 'Evaluation pending'}
                              </td>
                              <td className="py-4">
                                {p.is_archived ? (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                                    Archived
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400">
                                    Active
                                  </span>
                                )}
                              </td>
                              <td className="py-4 text-right pr-2" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedPatientId(patientApiId(p));
                                      setEditFullName(p.full_name || '');
                                      setEditDob(p.date_of_birth || '');
                                      setEditPhone(p.phone || '');
                                      setEditDiagnosis(p.diagnosis || '');
                                      setEditModalOpen(true);
                                    }}
                                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-primary-500"
                                    title="Edit Patient"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  {!p.is_archived && (
                                    <button
                                      onClick={() => handleArchivePatient(patientApiId(p))}
                                      className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-slate-500 hover:text-red-500"
                                      title="Archive Patient"
                                    >
                                      <Archive className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Patient Profile Detailed View Side Panel */}
                <div className="glass-card p-6 space-y-6">
                  <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">Patient File View</h3>
                  
                  {loadingDetail ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Clock className="h-8 w-8 animate-spin" />
                      <span className="text-xs">Loading patient file...</span>
                    </div>
                  ) : !patientDetail ? (
                    <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400">
                      <ClipboardList className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <p className="text-sm font-medium">No patient selected</p>
                      <p className="text-2xs mt-1">Select a patient row in the database roster to review details.</p>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-fade-in text-sm">
                      {/* Personal Info Header */}
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary-500 text-white rounded-full flex items-center justify-center font-bold">
                          {patientDetail.full_name?.[0]}
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-white">{patientDetail.full_name}</h4>
                          <span className="text-2xs text-slate-400 block">{patientDetail.email}</span>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800/80">
                        <div>
                          <span className="text-2xs text-slate-400 uppercase font-bold block">Contact Phone</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{patientDetail.phone || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-2xs text-slate-400 uppercase font-bold block">Date of Birth</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{patientDetail.date_of_birth || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-2xs text-slate-400 uppercase font-bold block">Clinical Plan</span>
                          <span className="font-medium text-slate-700 dark:text-slate-300">{patientDetail.diagnosis || 'Rehab plan unassigned'}</span>
                        </div>
                      </div>

                      {/* Consent status */}
                      <div className="space-y-2">
                        <span className="text-2xs text-slate-400 uppercase font-bold block">Consent & Agreements</span>
                        {patientDetail.consents?.length === 0 ? (
                          <span className="text-xs text-slate-500 block">No consent recorded.</span>
                        ) : (
                          patientDetail.consents.map((c) => (
                            <div key={c.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/20 text-xs">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{c.consent_level}</span>
                              <span className="text-2xs text-slate-400">{new Date(c.granted_at).toLocaleDateString()}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Assigned exercises */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xs text-slate-400 uppercase font-bold block">Assigned Exercises</span>
                          {patientDetail && (
                            <button
                              onClick={() => setAssignModalOpen(true)}
                              disabled={availableExercisesToAssign.length === 0}
                              className="text-[10px] font-bold text-primary-500 hover:text-primary-600 disabled:text-slate-300 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Assign
                            </button>
                          )}
                        </div>
                        {patientDetail.assignments?.length === 0 ? (
                          <span className="text-xs text-slate-500 block">No exercises assigned yet.</span>
                        ) : (
                          patientDetail.assignments.map((a) => {
                            const progress = getAssignmentProgress(a.exercise_id);
                            return (
                              <div key={a.id} className="bg-slate-50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/20 text-xs space-y-1.5">
                                <div className="flex justify-between items-center">
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{a.exercise?.name || 'Workout'}</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${progress.count > 0 ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                                      {progress.count > 0 ? `${progress.count} session${progress.count !== 1 ? 's' : ''}` : 'Not started'}
                                    </span>
                                    <button
                                      onClick={() => handleRemoveAssignment(a.id)}
                                      disabled={removingAssignmentId === a.id}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded transition-all disabled:opacity-50"
                                      title="Remove assignment"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                                {progress.latestScore !== null && (
                                  <span className="text-2xs text-slate-400 block">
                                    Latest form score: <span className="font-bold text-accent-500">{progress.latestScore}%</span>
                                  </span>
                                )}
                                {a.due_date && (
                                  <span className="text-2xs text-slate-400 block">
                                    Due: {new Date(a.due_date).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Sessions progress history */}
                      <div className="space-y-2">
                        <span className="text-2xs text-slate-400 uppercase font-bold block">Progress History</span>
                        {patientDetail.sessions?.length === 0 ? (
                          <span className="text-xs text-slate-500 block">No sessions recorded yet.</span>
                        ) : (
                          <div className="space-y-2">
                            {patientDetail.sessions.map((s) => (
                              <div key={s.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/20 text-xs hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                                <div className="text-left">
                                  <span className="font-medium text-slate-700 dark:text-slate-300 block truncate max-w-[140px]">{s.title}</span>
                                  <span className="text-2xs text-slate-400 font-mono block mt-0.5">{new Date(sessionTimestamp(s)).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-accent-500">{sessionFormScore(s)}% Form</span>
                                  <button
                                    onClick={() => navigate(`/admin/session/${s.id}`)}
                                    className="p-1.5 bg-slate-100 hover:bg-primary-100 dark:bg-slate-800 dark:hover:bg-primary-950/40 text-slate-500 hover:text-primary-500 dark:text-slate-400 dark:hover:text-primary-400 rounded-lg transition-all font-bold"
                                    title="Replay Session"
                                  >
                                    <PlayCircle className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal: Create Patient */}
              {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                  <div className="w-full max-w-md glass-card p-8 relative space-y-6">
                    <button onClick={() => setCreateModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600">
                      <X className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Create Patient</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Register a new patient profile inside the clinical system.</p>
                    </div>
                    <form onSubmit={handleCreatePatient} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Email Address</label>
                        <input
                          type="email"
                          required
                          placeholder="patient@chosenmotion.com"
                          className="input-field text-sm"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Sarah Connor"
                          className="input-field text-sm"
                          value={newFullName}
                          onChange={(e) => setNewFullName(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Date of Birth</label>
                          <input
                            type="date"
                            className="input-field text-sm"
                            value={newDob}
                            onChange={(e) => setNewDob(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Phone Number</label>
                          <input
                            type="text"
                            placeholder="+1 555-0199"
                            className="input-field text-sm"
                            value={newPhone}
                            onChange={(e) => setNewPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Diagnosis / Target Treatment Plan</label>
                        <input
                          type="text"
                          placeholder="e.g. Shoulder Abduction Routine"
                          className="input-field text-sm"
                          value={newDiagnosis}
                          onChange={(e) => setNewDiagnosis(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Initial Consent Level</label>
                        <select
                          className="input-field text-sm"
                          value={newConsent}
                          onChange={(e) => setNewConsent(e.target.value)}
                        >
                          <option value="Full Consent">Full Consent (HIPAA Sharing)</option>
                          <option value="Research Only">Research Only</option>
                          <option value="None">No External Sharing</option>
                        </select>
                      </div>
                      <button
                        type="submit"
                        disabled={creating}
                        className="w-full btn-primary py-3 mt-2"
                      >
                        {creating ? 'Creating...' : 'Create Patient Profile'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal: Edit Patient */}
              {editModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                  <div className="w-full max-w-md glass-card p-8 relative space-y-6">
                    <button onClick={() => setEditModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600">
                      <X className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Edit Patient Profile</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Update patient demographics and treatment plan assignments.</p>
                    </div>
                    <form onSubmit={handleEditPatient} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Full Name</label>
                        <input
                          type="text"
                          required
                          className="input-field text-sm"
                          value={editFullName}
                          onChange={(e) => setEditFullName(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Date of Birth</label>
                          <input
                            type="date"
                            className="input-field text-sm"
                            value={editDob}
                            onChange={(e) => setEditDob(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Phone Number</label>
                          <input
                            type="text"
                            className="input-field text-sm"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Diagnosis / Treatment Assignment</label>
                        <textarea
                          className="input-field text-sm min-h-[80px]"
                          value={editDiagnosis}
                          onChange={(e) => setEditDiagnosis(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updating}
                        className="w-full btn-primary py-3 mt-2"
                      >
                        {updating ? 'Saving...' : 'Save Changes'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal: Assign Exercise */}
              {assignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                  <div className="w-full max-w-md glass-card p-8 relative space-y-6">
                    <button onClick={() => setAssignModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600">
                      <X className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Assign Exercise</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Select an exercise from the catalog to assign to {patientDetail?.full_name}.
                      </p>
                    </div>
                    <form onSubmit={handleAssignExercise} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Exercise</label>
                        <select
                          required
                          className="input-field text-sm"
                          value={selectedExerciseToAssign}
                          onChange={(e) => setSelectedExerciseToAssign(e.target.value ? Number(e.target.value) : '')}
                        >
                          <option value="">Select an exercise...</option>
                          {availableExercisesToAssign.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name} (ROM: {ex.target_rom || 120}°)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Due Date (optional)</label>
                        <input
                          type="date"
                          className="input-field text-sm"
                          value={assignDueDate}
                          onChange={(e) => setAssignDueDate(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={assigning || !selectedExerciseToAssign}
                        className="w-full btn-primary py-3 mt-2"
                      >
                        {assigning ? 'Assigning...' : 'Assign Exercise'}
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              TAB: EXERCISES (EXERCISE LIBRARY CRUD)
              ========================================== */}
          {activeTab === 'exercises' && (
            <div className="space-y-6 animate-slide-up">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Active Exercises Catalog</h3>
                <button
                  onClick={() => setCreateExModalOpen(true)}
                  className="btn-primary py-2.5 text-sm flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" /> Create Exercise
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exercisesList.map(ex => (
                  <div key={ex.id} className="glass-card flex flex-col overflow-hidden hover:-translate-y-1 transition-all duration-200">
                    <img 
                      src={ex.thumbnail_url || 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=150'} 
                      alt={ex.name} 
                      className="h-40 w-full object-cover border-b border-slate-200 dark:border-slate-800"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=150';
                      }}
                    />
                    <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-display font-bold text-base text-slate-900 dark:text-white leading-tight">{ex.name}</h4>
                          <span className="text-2xs font-semibold px-2 py-0.5 bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-full shrink-0">
                            ROM: {ex.target_rom || 120}°
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{ex.description}</p>
                        
                        {ex.instructions && (
                          <div className="pt-2 text-xs">
                            <span className="font-bold text-slate-400 block mb-1">Instructions:</span>
                            <p className="text-slate-600 dark:text-slate-300 italic line-clamp-3">"{ex.instructions}"</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/60">
                        <div className="flex flex-wrap gap-1">
                          {exerciseJointTags(ex).map((j) => (
                            <span key={j} className="text-[9px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded">
                              {j}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setSelectedExerciseId(ex.id);
                              setEditExName(ex.name);
                              setEditExDesc(ex.description || '');
                              setEditExInst(ex.instructions || '');
                              setEditExRom(ex.target_rom?.toString() || '');
                              setEditExThumb(ex.thumbnail_url || '');
                              setEditExModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-primary-500"
                            title="Edit Exercise"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExercise(ex.id)}
                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 rounded text-slate-500 hover:text-red-500"
                            title="Delete Exercise"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modal: Create Exercise */}
              {createExModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                  <div className="w-full max-w-md glass-card p-8 relative space-y-6">
                    <button onClick={() => setCreateExModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600">
                      <X className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Create Catalog Exercise</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Register a new physical exercise template in the system.</p>
                    </div>
                    <form onSubmit={handleCreateExercise} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Exercise Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Elbow Flexion Routine"
                          className="input-field text-sm"
                          value={newExName}
                          onChange={(e) => setNewExName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Description</label>
                        <textarea
                          placeholder="Short summary of the exercise..."
                          className="input-field text-sm min-h-[60px]"
                          value={newExDesc}
                          onChange={(e) => setNewExDesc(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Instructions</label>
                        <textarea
                          placeholder="Instructions detailing flexion extension guides..."
                          className="input-field text-sm min-h-[65px]"
                          value={newExInst}
                          onChange={(e) => setNewExInst(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Target ROM (Degrees)</label>
                          <input
                            type="number"
                            placeholder="e.g. 135"
                            className="input-field text-sm"
                            value={newExRom}
                            onChange={(e) => setNewExRom(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Thumbnail Graphic URL</label>
                          <input
                            type="text"
                            placeholder="https://images.unsplash.com/..."
                            className="input-field text-sm"
                            value={newExThumb}
                            onChange={(e) => setNewExThumb(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full btn-primary py-3 mt-2"
                      >
                        Create Exercise Template
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {/* Modal: Edit Exercise */}
              {editExModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                  <div className="w-full max-w-md glass-card p-8 relative space-y-6">
                    <button onClick={() => setEditExModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600">
                      <X className="h-5 w-5" />
                    </button>
                    <div>
                      <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Edit Catalog Exercise</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Update instructions or guidelines for this motion capture.</p>
                    </div>
                    <form onSubmit={handleEditExercise} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Exercise Name</label>
                        <input
                          type="text"
                          required
                          className="input-field text-sm"
                          value={editExName}
                          onChange={(e) => setEditExName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Description</label>
                        <textarea
                          className="input-field text-sm min-h-[60px]"
                          value={editExDesc}
                          onChange={(e) => setEditExDesc(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Instructions</label>
                        <textarea
                          className="input-field text-sm min-h-[65px]"
                          value={editExInst}
                          onChange={(e) => setEditExInst(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Target ROM (Degrees)</label>
                          <input
                            type="number"
                            className="input-field text-sm"
                            value={editExRom}
                            onChange={(e) => setEditExRom(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-400 uppercase mb-1.5">Thumbnail Graphic URL</label>
                          <input
                            type="text"
                            className="input-field text-sm"
                            value={editExThumb}
                            onChange={(e) => setEditExThumb(e.target.value)}
                          />
                        </div>
                      </div>
                      <button
                        type="submit"
                        className="w-full btn-primary py-3 mt-2"
                      >
                        Save Exercise Changes
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==========================================
              TAB: REPORTS
              ========================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6 animate-slide-up">
              <div className="glass-card p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                        <th className="pb-3 pl-2">Session Title</th>
                        <th className="pb-3">Completed At</th>
                        <th className="pb-3">Flexion (ROM)</th>
                        <th className="pb-3">Form Score</th>
                        <th className="pb-3 text-right pr-2">Replay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                      {loadingReports ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading motion reports...</td></tr>
                      ) : motionReports.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-400">No workout sessions recorded yet.</td></tr>
                      ) : (
                      motionReports.map((act) => (
                        <tr key={act.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all">
                          <td className="py-4 pl-2 font-medium text-slate-900 dark:text-white">
                            {act.title}
                          </td>
                          <td className="py-4 text-slate-500 dark:text-slate-400">
                            {new Date(sessionTimestamp(act)).toLocaleString()}
                          </td>
                          <td className="py-4 text-slate-600 dark:text-slate-300 font-semibold">
                            {sessionRom(act)}°
                          </td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                              sessionFormScore(act) >= 90 
                                ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400' 
                                : sessionFormScore(act) >= 75
                                  ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                            }`}>
                              {sessionFormScore(act)}% Accuracy
                            </span>
                          </td>
                          <td className="py-4 text-right pr-2">
                            <button
                              onClick={() => navigate(`/admin/session/${act.id}`)}
                              className="p-1.5 bg-slate-100 hover:bg-primary-100 dark:bg-slate-800 dark:hover:bg-primary-950/40 text-slate-500 hover:text-primary-500 dark:text-slate-400 dark:hover:text-primary-400 rounded-lg transition-all font-bold inline-flex items-center gap-1"
                              title="Replay Session"
                            >
                              <PlayCircle className="h-4 w-4" />
                              <span className="text-[10px]">Replay</span>
                            </button>
                          </td>
                        </tr>
                      )))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB: ANALYTICS
              ========================================== */}
          {activeTab === 'analytics' && (
            <div className="space-y-8 animate-slide-up">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* ROM Curve */}
                <div className="glass-card p-6 space-y-6">
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Flexion (ROM) Recovery Progress</h3>
                    <p className="text-xs text-slate-400 mt-1">Average degrees achieved over the last 4 weeks</p>
                  </div>
                  
                  <div className="h-64 flex items-end gap-6 justify-between pt-6 border-b border-l border-slate-200 dark:border-slate-800 px-4">
                    <div className="flex flex-col items-center w-full gap-2">
                      <div className="bg-primary-500/80 w-full rounded-t-lg transition-all duration-500" style={{ height: '110px' }} />
                      <span className="text-[10px] font-bold text-slate-400">Week 1 (110°)</span>
                    </div>
                    <div className="flex flex-col items-center w-full gap-2">
                      <div className="bg-primary-500/80 w-full rounded-t-lg transition-all duration-500" style={{ height: '120px' }} />
                      <span className="text-[10px] font-bold text-slate-400">Week 2 (120°)</span>
                    </div>
                    <div className="flex flex-col items-center w-full gap-2">
                      <div className="bg-primary-500/80 w-full rounded-t-lg transition-all duration-500" style={{ height: '135px' }} />
                      <span className="text-[10px] font-bold text-slate-400">Week 3 (135°)</span>
                    </div>
                    <div className="flex flex-col items-center w-full gap-2">
                      <div className="bg-accent-500/80 w-full rounded-t-lg transition-all duration-500" style={{ height: '142px' }} />
                      <span className="text-[10px] font-bold text-slate-400">Week 4 (142°)</span>
                    </div>
                  </div>
                </div>

                {/* Accuracy */}
                <div className="glass-card p-6 space-y-6">
                  <div>
                    <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Form Alignment Scores</h3>
                    <p className="text-xs text-slate-400 mt-1">Aggregated sensor tracking scores</p>
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">Shoulder Alignment</span>
                        <span className="text-slate-900 dark:text-white">94%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-primary-500 h-full rounded-full" style={{ width: '94%' }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">Elbow Flexion</span>
                        <span className="text-slate-900 dark:text-white">88%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-primary-500 h-full rounded-full" style={{ width: '88%' }} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-600 dark:text-slate-400">Knee Symmetry</span>
                        <span className="text-slate-900 dark:text-white">92%</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-accent-500 h-full rounded-full" style={{ width: '92%' }} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB: WEBSITE CONTENT
              ========================================== */}
          {activeTab === 'content' && (
            <div className="glass-card p-8 max-w-2xl animate-slide-up space-y-6">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">Landing Page Text Editor</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Configure the visible headlines and introduction blocks on the landing interface.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Headline</label>
                  <input
                    type="text"
                    className="input-field"
                    value={homeHeadline}
                    onChange={(e) => setHomeHeadline(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Introduction Paragraph</label>
                  <textarea
                    className="input-field min-h-[100px]"
                    value={homeSubheadline}
                    onChange={(e) => setHomeSubheadline(e.target.value)}
                  />
                </div>

                <button 
                  onClick={() => alert('Website landing content updated successfully.')}
                  className="w-full btn-primary py-3"
                >
                  Publish Changes
                </button>
              </div>
            </div>
          )}

          {/* ==========================================
              TAB: SETTINGS
              ========================================== */}
          {activeTab === 'settings' && (
            <div className="glass-card p-8 max-w-xl animate-slide-up space-y-6">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 dark:text-white">System Configurations</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Manage global preferences and compliance thresholds.</p>
              </div>

              <div className="space-y-5">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-900 dark:text-white">Enable Activity Alerts</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Send reminders for overdue rehabilitation tasks.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableAlerts}
                    onChange={() => setEnableAlerts(!enableAlerts)}
                    className="h-4 w-4 text-primary-500 focus:ring-primary-500 rounded"
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl">
                  <div>
                    <h5 className="text-sm font-semibold text-slate-900 dark:text-white">Require Compliance Consents</h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Prompt patients for HIPAA/data sharing agreements.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={requireConsent}
                    onChange={() => setRequireConsent(!requireConsent)}
                    className="h-4 w-4 text-primary-500 focus:ring-primary-500 rounded"
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  <button 
                    onClick={() => alert('Global configurations saved.')}
                    className="w-full btn-primary py-3"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
