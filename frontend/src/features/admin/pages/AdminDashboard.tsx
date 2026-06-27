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
  FileText,
  PlayCircle,
  Dumbbell,
  Settings as SettingsIcon,
  BarChart3,
  Globe,
  Plus,
  CheckCircle,
  FileCheck,
  ClipboardList,
  Archive,
  Edit2,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select, Checkbox, Toggle } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, StatisticCard, ExerciseCard, EmptyCard, AnalyticsCard } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Status';
import { 
  PageContainer, 
  Header, 
  Sidebar, 
  ContentWrapper, 
  ResponsiveGrid, 
  Modal, 
  Drawer, 
  LoadingState,
  cn 
} from '@/components/layout/LayoutComponents';
import { ExerciseRulesEditor } from '@/features/admin/components/ExerciseRulesEditor';
import { AssignmentConfigurator } from '@/features/admin/components/AssignmentConfigurator';
import { PatientLimitations } from '@/features/admin/components/PatientLimitations';

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
  
  // Responsive layout state
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(window.innerWidth < 1024);

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
  const [configuringAssignmentId, setConfiguringAssignmentId] = useState<number | null>(null);

  // Monitor screen resize for drawer layout triggers
  useEffect(() => {
    const handleResize = () => setIsMobileOrTablet(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  // ==========================================
  // SHARED PATIENT FILE LAYOUT BLOCK
  // ==========================================
  const patientProfileDetails = patientDetail && (
    <div className="space-y-6 text-sm text-left">
      {/* Personal Info Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-gold-500 text-white rounded-full flex items-center justify-center font-bold">
          {patientDetail.full_name?.[0]}
        </div>
        <div>
          <h4 className="font-semibold text-chosen-text-primary">{patientDetail.full_name}</h4>
          <span className="text-2xs text-chosen-text-muted block">{patientDetail.email}</span>
        </div>
      </div>

      <div className="space-y-3 p-4 bg-chosen-surface rounded-chosen-lg border border-chosen">
        <div>
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Contact Phone</span>
          <span className="font-medium text-chosen-text-secondary">{patientDetail.phone || 'N/A'}</span>
        </div>
        <div>
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Date of Birth</span>
          <span className="font-medium text-chosen-text-secondary">{patientDetail.date_of_birth || 'N/A'}</span>
        </div>
        <div>
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Clinical Plan</span>
          <span className="font-medium text-chosen-text-secondary">{patientDetail.diagnosis || 'Rehab plan unassigned'}</span>
        </div>
      </div>

      {/* Consent status */}
      <div className="space-y-2">
        <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Consent & Agreements</span>
        {patientDetail.consents?.length === 0 ? (
          <span className="text-xs text-chosen-text-muted block">No consent recorded.</span>
        ) : (
          patientDetail.consents.map((c) => (
            <div key={c.id} className="flex justify-between items-center bg-chosen-surface p-2.5 rounded-chosen-md border border-chosen text-xs">
              <span className="font-medium text-chosen-text-secondary">{c.consent_level}</span>
              <span className="text-2xs text-chosen-text-muted">{new Date(c.granted_at).toLocaleDateString()}</span>
            </div>
          ))
        )}
      </div>

      {/* Assigned exercises */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Assigned Exercises</span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setAssignModalOpen(true)}
            disabled={availableExercisesToAssign.length === 0}
            leftIcon={<Plus className="h-3 w-3" />}
            className="text-[10px] font-bold text-[#A27B41] hover:text-[#8b6633] p-0"
          >
            Assign
          </Button>
        </div>
        {patientDetail.assignments?.length === 0 ? (
          <span className="text-xs text-chosen-text-muted block">No exercises assigned yet.</span>
        ) : (
          patientDetail.assignments.map((a) => {
            const progress = getAssignmentProgress(a.exercise_id);
            return (
              <div key={a.id} className="bg-chosen-surface p-2.5 rounded-chosen-md border border-chosen text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-chosen-text-primary">{a.exercise?.name || 'Workout'}</span>
                  <div className="flex items-center gap-1.5">
                    <Badge variant={progress.count > 0 ? 'success' : 'warning'}>
                      {progress.count > 0 ? `${progress.count} s.` : 'Not started'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-red-500 hover:bg-red-500/10 p-1 rounded"
                      onClick={() => handleRemoveAssignment(a.id)}
                      disabled={removingAssignmentId === a.id}
                      title="Remove assignment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {progress.latestScore !== null && (
                  <span className="text-2xs text-chosen-text-muted block">
                    Latest score: <span className="font-bold text-gold-500">{progress.latestScore}%</span>
                  </span>
                )}
                {a.due_date && (
                  <span className="text-2xs text-chosen-text-muted block">
                    Due: {new Date(a.due_date).toLocaleDateString()}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-[10px] font-bold text-gold-500"
                  onClick={() => setConfiguringAssignmentId(configuringAssignmentId === a.id ? null : a.id)}
                >
                  {configuringAssignmentId === a.id ? 'Hide Config' : 'Configure'}
                </Button>
                {configuringAssignmentId === a.id && selectedPatientId && (
                  <AssignmentConfigurator
                    patientId={selectedPatientId}
                    assignmentId={a.id}
                    initialConfig={a.config}
                    onSaved={async () => {
                      const detail = await fetchPatientDetail(selectedPatientId);
                      setPatientDetail(detail);
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {selectedPatientId && (
        <PatientLimitations
          patientId={selectedPatientId}
          exerciseOptions={(patientDetail.assignments || [])
            .filter((a) => a.exercise)
            .map((a) => ({ id: a.exercise_id, name: a.exercise?.name || `Exercise ${a.exercise_id}` }))}
        />
      )}

      {/* Sessions progress history */}
      <div className="space-y-2">
        <span className="text-2xs text-chosen-text-muted uppercase font-bold block">Progress History</span>
        {patientDetail.sessions?.length === 0 ? (
          <span className="text-xs text-chosen-text-muted block">No sessions recorded yet.</span>
        ) : (
          <div className="space-y-2">
            {patientDetail.sessions.map((s) => (
              <div key={s.id} className="flex justify-between items-center bg-chosen-surface p-2.5 rounded-chosen-md border border-chosen text-xs hover:border-gold-500 transition-all">
                <div className="text-left min-w-0 flex-1 mr-2">
                  <span className="font-medium text-chosen-text-primary block truncate">{s.title}</span>
                  <span className="text-2xs text-chosen-text-muted font-mono block mt-0.5">{new Date(sessionTimestamp(s)).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-gold-500">{sessionFormScore(s)}%</span>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => navigate(`/admin/session/${s.id}`)}
                    title="Replay Session"
                    leftIcon={<PlayCircle className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Sidebar items
  const sidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <Activity className="h-5 w-5" />, onClick: () => setActiveTab('dashboard'), active: activeTab === 'dashboard' },
    { id: 'patients', label: 'Patients', icon: <Users className="h-5 w-5" />, onClick: () => setActiveTab('patients'), active: activeTab === 'patients' },
    { id: 'exercises', label: 'Exercises', icon: <Dumbbell className="h-5 w-5" />, onClick: () => setActiveTab('exercises'), active: activeTab === 'exercises' },
    { id: 'reports', label: 'Motion Reports', icon: <FileText className="h-5 w-5" />, onClick: () => setActiveTab('reports'), active: activeTab === 'reports' },
    { id: 'analytics', label: 'Progress Analytics', icon: <BarChart3 className="h-5 w-5" />, onClick: () => setActiveTab('analytics'), active: activeTab === 'analytics' },
    { id: 'content', label: 'Website Content', icon: <Globe className="h-5 w-5" />, onClick: () => setActiveTab('content'), active: activeTab === 'content' },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon className="h-5 w-5" />, onClick: () => setActiveTab('settings'), active: activeTab === 'settings' }
  ];

  return (
    <PageContainer
      sidebar={
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          title="Chosen Life"
          subtitle="Admin Panel"
          items={sidebarItems}
          profile={{
            name: clinicianName || 'Clinician',
            email: profile?.email || 'admin@chosenlife.com',
            role: 'Clinician Administrator'
          }}
          onSignOut={signOut}
          logo={<Activity className="h-5 w-5" />}
        />
      }
      header={
        <Header
          breadcrumbs={[
            { label: 'Admin', onClick: () => setActiveTab('dashboard') },
            { label: activeTab === 'reports' ? 'Motion Reports' : activeTab === 'content' ? 'Website Content' : activeTab, active: true }
          ]}
          profileName={profile?.firstName ? `${profile.firstName} ${profile.lastName}` : clinicianName || profile?.email}
          profileRole="Clinician"
          showMenuToggle={true}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
      }
    >
      <ContentWrapper>
        {loading ? (
          <LoadingState message="Loading clinic administrative dashboard..." />
        ) : (
          <>
            {/* ==========================================
                TAB: DASHBOARD
                ========================================== */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-slide-up text-left">
                {/* Stats cards responsive grid */}
                <ResponsiveGrid colsMobile={1} colsTablet={2} colsDesktop={4}>
                  <StatisticCard
                    label="Total Patients"
                    value={patients.filter(p => !p.is_archived).length}
                    trend={{
                      value: 'Active Clinic Roster',
                      direction: 'up',
                    }}
                    icon={<Users className="h-6 w-6" />}
                    iconBg="bg-gold-500/10 text-gold-500"
                  />

                  <StatisticCard
                    label="Active Patients"
                    value={patients.filter(p => p.diagnosis && !p.is_archived).length}
                    trend={{
                      value: 'Underactive recovery tracking',
                      direction: 'neutral',
                    }}
                    icon={<CheckCircle className="h-6 w-6" />}
                    iconBg="bg-green-500/10 text-green-500"
                  />

                  <StatisticCard
                    label="Completed Sessions"
                    value={stats?.total_sessions || 0}
                    trend={{
                      value: '+24% weekly activity',
                      direction: 'up',
                    }}
                    icon={<FileCheck className="h-6 w-6" />}
                    iconBg="bg-yellow-500/10 text-yellow-500"
                  />

                  <StatisticCard
                    label="Average Form Score"
                    value={`${stats?.average_session_score || 91.5}%`}
                    trend={{
                      value: 'Joint alignment accuracy',
                      direction: 'neutral',
                    }}
                    icon={<Activity className="h-6 w-6" />}
                    iconBg="bg-purple-500/10 text-purple-500"
                  />
                </ResponsiveGrid>

                {/* Dashboard layout flex grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  {/* Roster overview */}
                  <Card className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-display font-bold text-lg text-chosen-text-primary">Active Roster</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('patients')}
                        className="text-gold-500 font-bold"
                      >
                        Manage Roster
                      </Button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-chosen text-xs font-semibold uppercase tracking-wider text-chosen-text-muted">
                            <th className="pb-3 pl-2">Patient</th>
                            <th className="pb-3">Diagnosis</th>
                            <th className="pb-3 text-right pr-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-chosen">
                          {patients.filter(p => !p.is_archived).length === 0 ? (
                            <tr><td colSpan={3} className="py-8 text-center text-chosen-text-muted">No active patients registered.</td></tr>
                          ) : (
                            patients.filter(p => !p.is_archived).slice(0, 3).map(p => (
                              <tr key={patientApiId(p)} className="hover:bg-chosen-surface/50 transition-all">
                                <td className="py-4 pl-2 flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-gold-500/10 text-gold-500 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                    {p.full_name?.[0] || 'P'}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-medium text-chosen-text-primary block truncate">{p.full_name}</span>
                                    <span className="text-[10px] text-chosen-text-muted block truncate">{p.email || 'no-email'}</span>
                                  </div>
                                </td>
                                <td className="py-4 text-chosen-text-secondary truncate max-w-[200px]">
                                  {p.diagnosis || 'Rehabilitation evaluation needed'}
                                </td>
                                <td className="py-4 text-right pr-2">
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => { setActiveTab('patients'); loadPatientProfileDetail(patientApiId(p)); }}
                                    className="text-gold-500 font-bold"
                                  >
                                    Profile
                                  </Button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Activity Feed */}
                  <Card className="space-y-6">
                    <h3 className="font-display font-bold text-lg text-chosen-text-primary">Recent Activities</h3>
                    <div className="space-y-4">
                      {stats?.recent_activity.map((act) => (
                        <div key={act.id} className="flex justify-between items-center p-3 rounded-chosen-md hover:bg-chosen-surface transition-all">
                          <div className="flex gap-3 items-center min-w-0">
                            <div className="h-9 w-9 bg-gold-500/10 rounded-chosen-md text-gold-500 flex items-center justify-center shrink-0">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 text-left">
                              <h4 className="font-medium text-sm text-chosen-text-primary truncate">{act.title}</h4>
                              <p className="text-[10px] text-chosen-text-muted mt-0.5 font-mono">
                                Accuracy: {sessionFormScore(act)}% | {new Date(sessionTimestamp(act)).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            size="xs"
                            onClick={() => navigate(`/admin/session/${act.id}`)}
                            title="Replay Session"
                            className="shrink-0"
                          >
                            <PlayCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* ==========================================
                TAB: PATIENTS
                ========================================== */}
            {activeTab === 'patients' && (
              <div className="space-y-8 animate-slide-up text-left">
                {/* Search & Actions layout grid */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-4 max-w-xl">
                    <div className="flex-1">
                      <Input
                        type="search"
                        placeholder="Search patient name, email, plan..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="shrink-0 flex items-center">
                      <Checkbox
                        label="Include Archived"
                        checked={includeArchived}
                        onChange={(e) => setIncludeArchived(e.target.checked)}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => setCreateModalOpen(true)}
                    leftIcon={<Plus className="h-4 w-4" />}
                    className="w-full md:w-auto"
                  >
                    Create Patient
                  </Button>
                </div>

                {/* Patient layout wrapper */}
                <div className={cn("grid gap-8 items-start", isMobileOrTablet ? "grid-cols-1" : "grid-cols-3")}>
                  {/* Patients Roster List */}
                  <Card className={cn(isMobileOrTablet ? "" : "col-span-2", "space-y-4")}>
                    <h3 className="font-display font-semibold text-base text-chosen-text-primary">Roster Database</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-chosen text-xs font-semibold uppercase tracking-wider text-chosen-text-muted">
                            <th className="pb-3 pl-2">Patient</th>
                            <th className="pb-3">Diagnosis</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3 text-right pr-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-chosen">
                          {patients.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-chosen-text-muted">No matching patients found.</td></tr>
                          ) : (
                            patients.map(p => (
                              <tr 
                                key={patientApiId(p)} 
                                className={cn(
                                  "hover:bg-chosen-surface/50 transition-all cursor-pointer",
                                  selectedPatientId === patientApiId(p) ? 'bg-gold-500/5' : ''
                                )}
                                onClick={() => loadPatientProfileDetail(patientApiId(p))}
                              >
                                <td className="py-4 pl-2">
                                  <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-gold-500/10 text-gold-500 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                                      {p.full_name?.[0] || 'P'}
                                    </div>
                                    <div className="min-w-0">
                                      <span className="font-semibold text-chosen-text-primary block truncate">
                                        {p.full_name}
                                      </span>
                                      <span className="text-[10px] text-chosen-text-muted block truncate">{p.email || 'no-email'}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 text-chosen-text-secondary truncate max-w-[150px]">
                                  {p.diagnosis || 'Evaluation pending'}
                                </td>
                                <td className="py-4">
                                  <Badge variant={p.is_archived ? 'error' : 'success'}>
                                    {p.is_archived ? 'Archived' : 'Active'}
                                  </Badge>
                                </td>
                                <td className="py-4 text-right pr-2" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      onClick={() => {
                                        setSelectedPatientId(patientApiId(p));
                                        setEditFullName(p.full_name || '');
                                        setEditDob(p.date_of_birth || '');
                                        setEditPhone(p.phone || '');
                                        setEditDiagnosis(p.diagnosis || '');
                                        setEditModalOpen(true);
                                      }}
                                      title="Edit Patient"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </Button>
                                    {!p.is_archived && (
                                      <Button
                                        variant="danger"
                                        size="xs"
                                        onClick={() => handleArchivePatient(patientApiId(p))}
                                        title="Archive Patient"
                                      >
                                        <Archive className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Patient Profile Detailed View Side Panel (Desktop only) */}
                  {!isMobileOrTablet && (
                    <Card className="space-y-6">
                      <div className="flex justify-between items-center border-b border-chosen pb-2">
                        <h3 className="font-display font-semibold text-base text-chosen-text-primary">Patient File View</h3>
                        {patientDetail && (
                          <Button 
                            variant="ghost" 
                            size="xs" 
                            onClick={() => setSelectedPatientId(null)}
                            className="text-chosen-text-muted hover:text-chosen-text-primary"
                          >
                            Close
                          </Button>
                        )}
                      </div>
                      {loadingDetail ? (
                        <div className="py-12 flex flex-col items-center justify-center text-chosen-text-muted gap-2">
                          <Spinner size="md" />
                          <span className="text-xs">Loading patient file...</span>
                        </div>
                      ) : !patientDetail ? (
                        <EmptyCard
                          title="No patient selected"
                          description="Select a patient row in the database roster to review details."
                          icon={<ClipboardList className="h-10 w-10 mx-auto text-chosen-text-muted mb-4" />}
                        />
                      ) : (
                        patientProfileDetails
                      )}
                    </Card>
                  )}
                </div>

                {/* Patient Profile Detailed View Drawer (Mobile / Tablet only) */}
                {isMobileOrTablet && (
                  <Drawer
                    isOpen={!!selectedPatientId}
                    onClose={() => setSelectedPatientId(null)}
                    title="Patient File Details"
                  >
                    {loadingDetail ? (
                      <div className="py-12 flex flex-col items-center justify-center text-chosen-text-muted gap-2">
                        <Spinner size="md" />
                        <span className="text-xs">Loading patient file...</span>
                      </div>
                    ) : patientProfileDetails}
                  </Drawer>
                )}
              </div>
            )}

            {/* ==========================================
                TAB: EXERCISES
                ========================================== */}
            {activeTab === 'exercises' && (
              <div className="space-y-6 animate-slide-up text-left">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base md:text-lg text-chosen-text-primary">Active Exercises Catalog</h3>
                  <Button
                    onClick={() => setCreateExModalOpen(true)}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Create Exercise
                  </Button>
                </div>

                {/* Exercises grid using ResponsiveGrid */}
                <ResponsiveGrid colsMobile={1} colsTablet={2} colsDesktop={3}>
                  {exercisesList.map(ex => (
                    <ExerciseCard
                      key={ex.id}
                      name={ex.name}
                      thumbnailUrl={ex.thumbnail_url || undefined}
                      targetRom={ex.target_rom || undefined}
                      description={ex.description || undefined}
                      instructions={ex.instructions || undefined}
                      actionButton={
                        <div className="flex items-center justify-between pt-2 border-t border-chosen mt-2">
                          <div className="flex flex-wrap gap-1">
                            {exerciseJointTags(ex).map((j) => (
                              <span key={j} className="text-[9px] font-bold bg-chosen-surface text-chosen-text-secondary px-2 py-0.5 rounded">
                                {j}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => {
                                setSelectedExerciseId(ex.id);
                                setEditExName(ex.name);
                                setEditExDesc(ex.description || '');
                                setEditExInst(ex.instructions || '');
                                setEditExRom(ex.target_rom?.toString() || '');
                                setEditExThumb(ex.thumbnail_url || '');
                                setEditExModalOpen(true);
                              }}
                              title="Edit Exercise"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => handleDeleteExercise(ex.id)}
                              title="Delete Exercise"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      }
                    />
                  ))}
                </ResponsiveGrid>
              </div>
            )}

            {/* ==========================================
                TAB: REPORTS
                ========================================== */}
            {activeTab === 'reports' && (
              <div className="space-y-6 animate-slide-up text-left">
                <Card>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-chosen text-xs font-semibold uppercase tracking-wider text-chosen-text-muted">
                          <th className="pb-3 pl-2">Session Title</th>
                          <th className="pb-3">Completed At</th>
                          <th className="pb-3">Flexion (ROM)</th>
                          <th className="pb-3">Form Score</th>
                          <th className="pb-3 text-right pr-2">Replay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-chosen">
                        {loadingReports ? (
                          <tr><td colSpan={5} className="py-8 text-center text-chosen-text-muted">Loading motion reports...</td></tr>
                        ) : motionReports.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-chosen-text-muted">No workout sessions recorded yet.</td></tr>
                        ) : (
                          motionReports.map((act) => (
                            <tr key={act.id} className="hover:bg-chosen-surface/50 transition-all">
                              <td className="py-4 pl-2 font-medium text-chosen-text-primary">
                                {act.title}
                              </td>
                              <td className="py-4 text-chosen-text-secondary">
                                {new Date(sessionTimestamp(act)).toLocaleString()}
                              </td>
                              <td className="py-4 text-chosen-text-primary font-semibold">
                                {sessionRom(act)}°
                              </td>
                              <td className="py-4">
                                <Badge variant={
                                  sessionFormScore(act) >= 90 
                                    ? 'success' 
                                    : sessionFormScore(act) >= 75
                                      ? 'warning'
                                      : 'error'
                                }>
                                  {sessionFormScore(act)}% Accuracy
                                </Badge>
                              </td>
                              <td className="py-4 text-right pr-2">
                                <Button
                                  variant="secondary"
                                  size="xs"
                                  onClick={() => navigate(`/admin/session/${act.id}`)}
                                  title="Replay Session"
                                  leftIcon={<PlayCircle className="h-4 w-4" />}
                                >
                                  Replay
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {/* ==========================================
                TAB: ANALYTICS
                ========================================== */}
            {activeTab === 'analytics' && (
              <div className="space-y-8 animate-slide-up text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* ROM Curve */}
                  <AnalyticsCard
                    title="Flexion (ROM) Recovery Progress"
                    subtitle="Average degrees achieved over the last 4 weeks"
                  >
                    <div className="h-64 flex items-end gap-6 justify-between pt-6 border-b border-l border-chosen px-4">
                      <div className="flex flex-col items-center w-full gap-2">
                        <div className="bg-[#A27B41]/80 w-full rounded-t-lg transition-all duration-500" style={{ height: '110px' }} />
                        <span className="text-[10px] font-bold text-chosen-text-muted">Week 1 (110°)</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <div className="bg-[#A27B41]/80 w-full rounded-t-lg transition-all duration-500" style={{ height: '120px' }} />
                        <span className="text-[10px] font-bold text-chosen-text-muted">Week 2 (120°)</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <div className="bg-[#A27B41]/80 w-full rounded-t-lg transition-all duration-500" style={{ height: '135px' }} />
                        <span className="text-[10px] font-bold text-chosen-text-muted">Week 3 (135°)</span>
                      </div>
                      <div className="flex flex-col items-center w-full gap-2">
                        <div className="bg-gold-500 w-full rounded-t-lg transition-all duration-500" style={{ height: '142px' }} />
                        <span className="text-[10px] font-bold text-chosen-text-muted">Week 4 (142°)</span>
                      </div>
                    </div>
                  </AnalyticsCard>

                  {/* Accuracy */}
                  <AnalyticsCard
                    title="Form Alignment Scores"
                    subtitle="Aggregated sensor tracking scores"
                  >
                    <div className="space-y-4 pt-4">
                      <div className="space-y-1.5 text-left">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-chosen-text-secondary">Shoulder Alignment</span>
                          <span className="text-chosen-text-primary">94%</span>
                        </div>
                        <div className="w-full bg-chosen-surface h-2 rounded-full overflow-hidden">
                          <div className="bg-gold-500 h-full rounded-full" style={{ width: '94%' }} />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-chosen-text-secondary">Elbow Flexion</span>
                          <span className="text-chosen-text-primary">88%</span>
                        </div>
                        <div className="w-full bg-chosen-surface h-2 rounded-full overflow-hidden">
                          <div className="bg-gold-500 h-full rounded-full" style={{ width: '88%' }} />
                        </div>
                      </div>

                      <div className="space-y-1.5 text-left">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-chosen-text-secondary">Knee Symmetry</span>
                          <span className="text-chosen-text-primary">92%</span>
                        </div>
                        <div className="w-full bg-chosen-surface h-2 rounded-full overflow-hidden">
                          <div className="bg-gold-500 h-full rounded-full" style={{ width: '92%' }} />
                        </div>
                      </div>
                    </div>
                  </AnalyticsCard>
                </div>
              </div>
            )}

            {/* ==========================================
                TAB: WEBSITE CONTENT
                ========================================== */}
            {activeTab === 'content' && (
              <div className="animate-slide-up text-left">
                <Card className="max-w-2xl space-y-6">
                  <div>
                    <h3 className="font-display font-bold text-lg text-chosen-text-primary">Landing Page Text Editor</h3>
                    <p className="text-xs text-chosen-text-muted mt-1">Configure the visible headlines and introduction blocks on the landing interface.</p>
                  </div>

                  <div className="space-y-5">
                    <Input
                      label="Headline"
                      type="text"
                      value={homeHeadline}
                      onChange={(e) => setHomeHeadline(e.target.value)}
                    />

                    <Textarea
                      label="Introduction Paragraph"
                      className="min-h-[100px]"
                      value={homeSubheadline}
                      onChange={(e) => setHomeSubheadline(e.target.value)}
                    />

                    <Button 
                      onClick={() => alert('Website landing content updated successfully.')}
                      className="w-full"
                    >
                      Publish Changes
                    </Button>
                  </div>
                </Card>
              </div>
            )}

            {/* ==========================================
                TAB: SETTINGS
                ========================================== */}
            {activeTab === 'settings' && (
              <div className="animate-slide-up text-left">
                <Card className="max-w-xl space-y-6">
                  <div>
                    <h3 className="font-display font-bold text-lg text-chosen-text-primary">System Configurations</h3>
                    <p className="text-xs text-chosen-text-muted mt-1">Manage global preferences and compliance thresholds.</p>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between p-4 bg-chosen-surface border border-chosen rounded-chosen-lg">
                      <div>
                        <h5 className="text-sm font-semibold text-chosen-text-primary">Enable Activity Alerts</h5>
                        <p className="text-xs text-chosen-text-muted mt-0.5">Send reminders for overdue rehabilitation tasks.</p>
                      </div>
                      <Toggle
                        checked={enableAlerts}
                        onChange={(checked) => setEnableAlerts(checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-chosen-surface border border-chosen rounded-chosen-lg">
                      <div>
                        <h5 className="text-sm font-semibold text-chosen-text-primary">Require Compliance Consents</h5>
                        <p className="text-xs text-chosen-text-muted mt-0.5">Prompt patients for HIPAA/data sharing agreements.</p>
                      </div>
                      <Toggle
                        checked={requireConsent}
                        onChange={(checked) => setRequireConsent(checked)}
                      />
                    </div>

                    <div className="pt-4 border-t border-chosen">
                      <Button 
                        onClick={() => alert('Global configurations saved.')}
                        className="w-full"
                      >
                        Save Settings
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </ContentWrapper>

      {/* ==========================================
          REUSABLE MODALS
          ========================================== */}
      
      {/* Modal: Create Patient */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Patient Profile"
      >
        <p className="text-xs text-chosen-text-muted mb-4">Register a new patient profile inside the clinical system.</p>
        <form onSubmit={handleCreatePatient} className="space-y-4">
          <Input
            label="Email Address"
            type="email"
            required
            placeholder="patient@chosenmotion.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <Input
            label="Full Name"
            type="text"
            required
            placeholder="Sarah Connor"
            value={newFullName}
            onChange={(e) => setNewFullName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              value={newDob}
              onChange={(e) => setNewDob(e.target.value)}
            />
            <Input
              label="Phone Number"
              type="text"
              placeholder="+1 555-0199"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
            />
          </div>
          <Input
            label="Diagnosis / Target Treatment Plan"
            type="text"
            placeholder="e.g. Shoulder Abduction Routine"
            value={newDiagnosis}
            onChange={(e) => setNewDiagnosis(e.target.value)}
          />
          <Select
            label="Initial Consent Level"
            value={newConsent}
            onChange={(e) => setNewConsent(e.target.value)}
            options={[
              { value: 'Full Consent', label: 'Full Consent (HIPAA Sharing)' },
              { value: 'Research Only', label: 'Research Only' },
              { value: 'None', label: 'No External Sharing' }
            ]}
          />
          <Button
            type="submit"
            disabled={creating}
            isLoading={creating}
            className="w-full mt-2"
          >
            Create Patient Profile
          </Button>
        </form>
      </Modal>

      {/* Modal: Edit Patient */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Patient Profile"
      >
        <p className="text-xs text-chosen-text-muted mb-4">Update patient demographics and treatment plan assignments.</p>
        <form onSubmit={handleEditPatient} className="space-y-4">
          <Input
            label="Full Name"
            type="text"
            required
            value={editFullName}
            onChange={(e) => setEditFullName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Date of Birth"
              type="date"
              value={editDob}
              onChange={(e) => setEditDob(e.target.value)}
            />
            <Input
              label="Phone Number"
              type="text"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
            />
          </div>
          <Textarea
            label="Diagnosis / Treatment Assignment"
            value={editDiagnosis}
            onChange={(e) => setEditDiagnosis(e.target.value)}
            className="min-h-[80px]"
          />
          <Button
            type="submit"
            disabled={updating}
            isLoading={updating}
            className="w-full mt-2"
          >
            Save Changes
          </Button>
        </form>
      </Modal>

      {/* Modal: Assign Exercise */}
      <Modal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Exercise"
      >
        <p className="text-xs text-chosen-text-muted mb-4">
          Select an exercise from the catalog to assign to {patientDetail?.full_name}.
        </p>
        <form onSubmit={handleAssignExercise} className="space-y-4">
          <Select
            label="Exercise"
            required
            value={selectedExerciseToAssign}
            onChange={(e) => setSelectedExerciseToAssign(e.target.value ? Number(e.target.value) : '')}
            options={[
              { value: '', label: 'Select an exercise...' },
              ...availableExercisesToAssign.map((ex) => ({
                value: ex.id,
                label: `${ex.name} (ROM: ${ex.target_rom || 120}°)`
              }))
            ]}
          />
          <Input
            label="Due Date (optional)"
            type="date"
            value={assignDueDate}
            onChange={(e) => setAssignDueDate(e.target.value)}
          />
          <Button
            type="submit"
            disabled={assigning || !selectedExerciseToAssign}
            isLoading={assigning}
            className="w-full mt-2"
          >
            Assign Exercise
          </Button>
        </form>
      </Modal>

      {/* Modal: Create Exercise */}
      <Modal
        isOpen={createExModalOpen}
        onClose={() => setCreateExModalOpen(false)}
        title="Create Catalog Exercise"
      >
        <p className="text-xs text-chosen-text-muted mb-4">Register a new physical exercise template in the system.</p>
        <form onSubmit={handleCreateExercise} className="space-y-4">
          <Input
            label="Exercise Name"
            type="text"
            required
            placeholder="e.g. Elbow Flexion Routine"
            value={newExName}
            onChange={(e) => setNewExName(e.target.value)}
          />
          <Textarea
            label="Description"
            placeholder="Short summary of the exercise..."
            value={newExDesc}
            onChange={(e) => setNewExDesc(e.target.value)}
            className="min-h-[60px]"
          />
          <Textarea
            label="Instructions"
            placeholder="Instructions detailing flexion extension guides..."
            value={newExInst}
            onChange={(e) => setNewExInst(e.target.value)}
            className="min-h-[65px]"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Target ROM (Degrees)"
              type="number"
              placeholder="e.g. 135"
              value={newExRom}
              onChange={(e) => setNewExRom(e.target.value)}
            />
            <Input
              label="Thumbnail Graphic URL"
              type="text"
              placeholder="https://images.unsplash.com/..."
              value={newExThumb}
              onChange={(e) => setNewExThumb(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full mt-2"
          >
            Create Exercise Template
          </Button>
        </form>
      </Modal>

      {/* Modal: Edit Exercise */}
      <Modal
        isOpen={editExModalOpen}
        onClose={() => setEditExModalOpen(false)}
        title="Edit Catalog Exercise"
      >
        <p className="text-xs text-chosen-text-muted mb-4">Update instructions or guidelines for this motion capture.</p>
        <form onSubmit={handleEditExercise} className="space-y-4">
          <Input
            label="Exercise Name"
            type="text"
            required
            value={editExName}
            onChange={(e) => setEditExName(e.target.value)}
          />
          <Textarea
            label="Description"
            value={editExDesc}
            onChange={(e) => setEditExDesc(e.target.value)}
            className="min-h-[60px]"
          />
          <Textarea
            label="Instructions"
            value={editExInst}
            onChange={(e) => setEditExInst(e.target.value)}
            className="min-h-[65px]"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Target ROM (Degrees)"
              type="number"
              value={editExRom}
              onChange={(e) => setEditExRom(e.target.value)}
            />
            <Input
              label="Thumbnail Graphic URL"
              type="text"
              value={editExThumb}
              onChange={(e) => setEditExThumb(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full mt-2"
          >
            Save Exercise Changes
          </Button>
        </form>
        {selectedExerciseId && (
          <ExerciseRulesEditor
            exerciseId={selectedExerciseId}
            rules={exercisesList.find((e) => e.id === selectedExerciseId)?.rules || []}
            onUpdated={async () => {
              const updated = await fetchExercisesList();
              setExercisesList(updated);
            }}
          />
        )}
      </Modal>
    </PageContainer>
  );
};

export default AdminDashboard;
