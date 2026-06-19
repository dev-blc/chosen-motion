import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { 
  fetchDashboardStats, 
  fetchPatientsList,
  createPatient,
  updatePatient,
  archivePatient,
  fetchPatientDetail,
  fetchExercisesList,
  createExercise,
  updateExercise,
  deleteExercise,
  fetchAnySessionDetail,
  fetchSessionReplay
} from '@/services/api';
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  LogOut, 
  User, 
  FileText,
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
  Play,
  Pause
} from 'lucide-react';

type Section = 'dashboard' | 'patients' | 'exercises' | 'reports' | 'analytics' | 'content' | 'settings';

const AdminDashboard: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Section>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search query
  const [searchQuery, setSearchQuery] = useState('');
  
  // Replay states
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [replaySession, setReplaySession] = useState<any>(null);
  const [replayFrames, setReplayFrames] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [loadingReplay, setLoadingReplay] = useState(false);

  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Playback timer effect
  useEffect(() => {
    if (!isPlaying || replayFrames.length === 0) return;
    
    const interval = 1000 / (30 * playbackSpeed);
    const timer = setInterval(() => {
      setCurrentFrameIndex((prevIndex) => {
        if (prevIndex >= replayFrames.length - 1) {
          setIsPlaying(false);
          return prevIndex;
        }
        return prevIndex + 1;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, replayFrames.length]);

  // Canvas drawing effect
  useEffect(() => {
    if (!replayModalOpen || loadingReplay) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    if (replayFrames.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No frames recorded for this session', canvas.width / 2, canvas.height / 2);
      return;
    }

    const frame = replayFrames[currentFrameIndex];
    if (!frame) return;

    // Support both new schema ('landmarks') and legacy ('joint_coordinates')
    const joints = frame.landmarks || frame.joint_coordinates;
    if (!joints) return;

    const width = canvas.width;
    const height = canvas.height;

    // Helper to get coordinates scaled to canvas size
    const getScaledCoords = (key: string | number) => {
      const coord = (joints as any)[key];
      if (!coord) return null;
      // Coordinates from MediaPipe are typically in [0.0, 1.0].
      // Scale them to canvas dimensions.
      if (typeof coord === 'object' && 'x' in coord && 'y' in coord) {
        return { x: coord.x * width, y: coord.y * height };
      }
      if (Array.isArray(coord) && coord.length >= 2) {
        return { x: coord[0] * width, y: coord[1] * height };
      }
      return null;
    };

    // Connections could be string keys or numeric indices depending on format
    const isListFormat = Array.isArray(joints);
    const JOINT_CONNECTIONS: [string | number, string | number][] = isListFormat ? [
      // Torso
      [11, 12], [11, 23], [12, 24], [23, 24],
      // Left arm
      [11, 13], [13, 15],
      // Right arm
      [12, 14], [14, 16],
      // Left leg
      [23, 25], [25, 27],
      // Right leg
      [24, 26], [26, 28]
    ] : [
      // Torso
      ['shoulder_l', 'shoulder_r'], ['shoulder_r', 'hip_r'], ['hip_r', 'hip_l'], ['hip_l', 'shoulder_l'],
      // Left arm
      ['shoulder_l', 'elbow_l'], ['elbow_l', 'wrist_l'],
      // Right arm
      ['shoulder_r', 'elbow_r'], ['elbow_r', 'wrist_r'],
      // Left leg
      ['hip_l', 'knee_l'], ['knee_l', 'ankle_l'],
      // Right leg
      ['hip_r', 'knee_r'], ['knee_r', 'ankle_r']
    ];

    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    
    // Draw bones with neon glow
    JOINT_CONNECTIONS.forEach(([j1, j2]) => {
      const pt1 = getScaledCoords(j1);
      const pt2 = getScaledCoords(j2);
      if (pt1 && pt2) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#06b6d4'; // cyan-500
        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.strokeStyle = '#06b6d4';
        ctx.stroke();
      }
    });

    // Draw joints with neon green glow
    const drawJoint = (key: string | number) => {
      const pt = getScaledCoords(key);
      if (pt) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#22c55e'; // green-500
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, 2 * Math.PI);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.shadowBlur = 0; // Turn off shadow for outline
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    };

    if (isListFormat) {
      [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(drawJoint);
    } else {
      Object.keys(joints).forEach(drawJoint);
    }

    // Draw visual overlays (HUD metadata)
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'; // translucent slate-900
    ctx.fillRect(16, 16, 220, 95);
    ctx.strokeStyle = '#334155'; // slate-700
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, 220, 95);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SESSION REPLAY HUD`, 28, 38);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Frame Index: ${currentFrameIndex + 1} / ${replayFrames.length}`, 28, 58);
    
    const timestamp = frame.timestamp_ms !== undefined ? frame.timestamp_ms : frame.timestamp_millis;
    const timeSec = (timestamp / 1000).toFixed(2);
    ctx.fillText(`Time Elapsed: ${timeSec}s`, 28, 74);
    ctx.fillText(`Speed: ${playbackSpeed.toFixed(1)}x`, 28, 90);

    // Dynamic Shoulder Angle logic
    const getCoordArray = (key: string | number) => {
      const coord = (joints as any)[key];
      if (!coord) return null;
      if (typeof coord === 'object' && 'x' in coord && 'y' in coord) {
        return [coord.x, coord.y];
      }
      if (Array.isArray(coord) && coord.length >= 2) {
        return [coord[0], coord[1]];
      }
      return null;
    };

    const hR = getCoordArray(isListFormat ? 24 : 'hip_r');
    const sR = getCoordArray(isListFormat ? 12 : 'shoulder_r');
    const eR = getCoordArray(isListFormat ? 14 : 'elbow_r');
    if (hR && sR && eR) {
      const calculateJointAngle = (a: number[], b: number[], c: number[]) => {
        const baX = a[0] - b[0];
        const baY = a[1] - b[1];
        const bcX = c[0] - b[0];
        const bcY = c[1] - b[1];
        const dot = baX * bcX + baY * bcY;
        const magA = Math.sqrt(baX*baX + baY*baY);
        const magC = Math.sqrt(bcX*bcX + bcY*bcY);
        if (magA === 0 || magC === 0) return 0;
        return Math.round((Math.acos(dot / (magA * magC)) * 180) / Math.PI);
      };
      
      const rShoulderAngle = calculateJointAngle(hR, sR, eR);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(canvas.width - 200, 16, 184, 40);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(canvas.width - 200, 16, 184, 40);
      
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`R Shoulder ROM: ${rShoulderAngle}°`, canvas.width - 184, 40);
    }
  }, [replayFrames, currentFrameIndex, playbackSpeed, replayModalOpen, loadingReplay]);

  const handleOpenReplay = async (sessionId: number) => {
    setLoadingReplay(true);
    setReplayModalOpen(true);
    setCurrentFrameIndex(0);
    setIsPlaying(false);
    try {
      const data = await fetchSessionReplay(sessionId);
      setReplaySession(data);
      if (data.frames && data.frames.length > 0) {
        setReplayFrames(data.frames);
      } else if (data.telemetry_data && data.telemetry_data.length > 0) {
        setReplayFrames(data.telemetry_data);
      } else {
        setReplayFrames([]);
      }
    } catch (err) {
      console.error('Failed to load session replay data. Using mock frames.', err);
      // Generate some high-quality mock skeletal frames for visual demo if API fails
      const mockFrames = [];
      const totalMockFrames = 100;
      for (let i = 0; i < totalMockFrames; i++) {
        const t = i * 100;
        const progress = i / totalMockFrames;
        const angleRad = Math.sin(progress * Math.PI) * (Math.PI * 0.7); // Up to ~126 deg
        const armX = 0.5 + Math.cos(angleRad) * 0.25;
        const armY = 0.4 - Math.sin(angleRad) * 0.25;
        
        mockFrames.push({
          timestamp_ms: t,
          landmarks: {
            shoulder_l: [0.35, 0.4, 0.0],
            shoulder_r: [0.65, 0.4, 0.0],
            elbow_l:    [0.25, 0.4, 0.0],
            elbow_r:    [0.75, 0.4, 0.0],
            wrist_l:    [0.15, 0.4, 0.0],
            wrist_r:    [0.85, 0.4, 0.0],
            hip_l:      [0.4, 0.75, 0.0],
            hip_r:      [0.6, 0.75, 0.0],
            knee_l:     [0.4, 0.88, 0.0],
            knee_r:     [0.6, 0.88, 0.0],
            ankle_l:    [0.4, 0.98, 0.0],
            ankle_r:    [0.6, 0.98, 0.0],
            // Active arm based on abduction simulation
            elbow_r: [0.65 + Math.cos(angleRad - 0.2)*0.12, 0.4 - Math.sin(angleRad - 0.2)*0.12, 0.0],
            wrist_r: [armX, armY, 0.0]
          }
        });
      }
      setReplaySession({
        id: sessionId,
        title: 'Mock Replay Session',
        created_at: new Date().toISOString(),
        avg_score: 95,
        range_of_motion: 126
      });
      setReplayFrames(mockFrames);
    } finally {
      setLoadingReplay(false);
    }
  };
  const [includeArchived, setIncludeArchived] = useState(false);
  
  // Detailed Patient view
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [patientDetail, setPatientDetail] = useState<any>(null);
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
  const [exercisesList, setExercisesList] = useState<any[]>([
    { id: 1, name: 'Shoulder Abduction', description: 'Raise arm sideways to measure shoulder flexibility.', instructions: 'Stand straight, lift arm slowly to the side, keep elbow straight, repeat.', target_rom: 120, thumbnail_url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=150', joints: ['Shoulder R', 'Shoulder L'] },
    { id: 2, name: 'Elbow Flexion', description: 'Bend arm at the elbow to test range of motion.', instructions: 'Hold weights, lift forearm upwards, bend elbow fully, return to start.', target_rom: 135, thumbnail_url: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=150', joints: ['Elbow R', 'Wrist R'] },
    { id: 3, name: 'Knee Extension', description: 'Straighten leg from sitting position to trace knee angles.', instructions: 'Sit on a chair, slowly lift leg straight out, hold, return.', target_rom: 90, thumbnail_url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=150', joints: ['Knee R', 'Ankle R'] }
  ]);
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

  // Load patient list, exercises and stats
  const loadPatientsAndStats = async (search = '', incArchived = false) => {
    setLoading(true);
    try {
      const statsData = await fetchDashboardStats();
      const patientsData = await fetchPatientsList(search, incArchived);
      setStats(statsData);
      setPatients(patientsData);
      try {
        const exercisesData = await fetchExercisesList();
        if (exercisesData && exercisesData.length > 0) {
          setExercisesList(exercisesData);
        }
      } catch (exErr) {
        console.warn('Failed to load database exercises, using local defaults.', exErr);
      }
    } catch (err) {
      console.error('Failed to load dashboard data. Using mock data.', err);
      // Load fallback demo mock data
      setStats({
        total_patients: 12,
        total_sessions: 48,
        average_duration_seconds: 320,
        average_session_score: 91.5,
        recent_activity: [
          { id: 1, title: 'Elbow Flexion Routine', duration_seconds: 180, avg_score: 94, created_at: new Date().toISOString() },
          { id: 2, title: 'Shoulder Abduction Routine', duration_seconds: 240, avg_score: 88, created_at: new Date(Date.now() - 86400000).toISOString() },
          { id: 3, title: 'Knee Extension', duration_seconds: 400, avg_score: 92, created_at: new Date(Date.now() - 172800000).toISOString() }
        ]
      });
      setPatients([
        { id: 'pat-1', user_id: 'pat-1', full_name: 'Sarah Connor', user: { first_name: 'Sarah', last_name: 'Connor', email: 'sarah.connor@gmail.com' }, diagnosis: 'Rotator Cuff Tear Rehabilitation', date_of_birth: '1985-11-10', phone: '+1 555-0199', is_archived: false },
        { id: 'pat-2', user_id: 'pat-2', full_name: 'John Miller', user: { first_name: 'John', last_name: 'Miller', email: 'john.miller@yahoo.com' }, diagnosis: 'Post-Op ACL Knee Extension Plan', date_of_birth: '1992-04-18', phone: '+1 555-0142', is_archived: false },
        { id: 'pat-3', user_id: 'pat-3', full_name: 'Kyle Reese', user: { first_name: 'Kyle', last_name: 'Reese', email: 'kyle.reese@outlook.com' }, diagnosis: 'General Elbow Flexion Check', date_of_birth: '1979-08-22', phone: '+1 555-0187', is_archived: false }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientsAndStats(searchQuery, includeArchived);
  }, [searchQuery, includeArchived]);

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
      const matched = patients.find(p => p.id === patientId || p.user_id === patientId);
      setPatientDetail({
        user_id: patientId,
        email: matched?.user?.email || 'patient@chosenmotion.com',
        full_name: matched?.full_name || 'Sarah Connor',
        date_of_birth: matched?.date_of_birth || '1985-11-10',
        phone: matched?.phone || '+1 555-0199',
        diagnosis: matched?.diagnosis || 'Rotator Cuff Tear Rehabilitation',
        is_archived: matched?.is_archived || false,
        consents: [
          { id: 1, patient_id: patientId, consent_level: 'Full Consent', granted_at: new Date().toISOString() }
        ],
        assignments: [
          { id: 1, patient_id: patientId, exercise_id: 1, assigned_by: 'Clinician', assigned_at: new Date().toISOString(), is_completed: false, exercise: { name: 'Shoulder Abduction' } }
        ],
        sessions: [
          { id: 1, patient_id: patientId, title: 'Elbow Flexion Routine', duration_seconds: 180, avg_score: 94, created_at: new Date().toISOString() }
        ]
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
      setPatients(prev => prev.map(p => (p.id === selectedPatientId || p.user_id === selectedPatientId) ? updated : p));
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
      setPatients(prev => prev.map(p => (p.id === patientId || p.user_id === patientId) ? { ...p, is_archived: true } : p));
      if (selectedPatientId === patientId) {
        setPatientDetail((prev: any) => prev ? { ...prev, is_archived: true } : null);
      }
      alert('Patient archived successfully.');
      loadPatientsAndStats(searchQuery, includeArchived);
    } catch (err: any) {
      console.error('Failed to archive patient', err);
      alert('Patient archived locally.');
      setPatients(prev => prev.map(p => (p.id === patientId || p.user_id === patientId) ? { ...p, is_archived: true } : p));
    }
  };

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
      const mockCreated = {
        id: Date.now(),
        ...payload,
        joints: ['Shoulder R', 'Elbow R']
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
                {profile?.firstName ? `${profile.firstName} ${profile.lastName}` : profile?.email}
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
                            <tr key={p.id || p.user_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all">
                              <td className="py-4 pl-2 flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs uppercase">
                                  {p.user?.first_name?.[0] || p.full_name?.[0] || 'P'}
                                </div>
                                <div>
                                  <span className="font-medium text-slate-900 dark:text-white block">{p.full_name || `${p.user?.first_name} ${p.user?.last_name}`}</span>
                                  <span className="text-[10px] text-slate-400 block">{p.user?.email || p.email || 'no-email'}</span>
                                </div>
                              </td>
                              <td className="py-4 text-slate-600 dark:text-slate-300">
                                {p.diagnosis || 'Rehabilitation evaluation needed'}
                              </td>
                              <td className="py-4">
                                <button onClick={() => { setActiveTab('patients'); loadPatientProfileDetail(p.user_id || p.id); }} className="text-xs font-semibold text-primary-500 hover:underline">
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
                    ) : stats?.recent_activity.map((act: any) => (
                      <div key={act.id} className="flex gap-3.5 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-all">
                        <div className="h-9 w-9 bg-accent-500/10 rounded-xl text-accent-500 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm text-slate-900 dark:text-white truncate">{act.title}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Accuracy: {act.avg_score}% | {new Date(act.created_at).toLocaleDateString()}
                          </p>
                        </div>
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
                              key={p.user_id || p.id} 
                              className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all cursor-pointer ${selectedPatientId === (p.user_id || p.id) ? 'bg-primary-500/5 dark:bg-primary-500/10' : ''}`}
                              onClick={() => loadPatientProfileDetail(p.user_id || p.id)}
                            >
                              <td className="py-4 pl-2">
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-primary-100 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs uppercase">
                                    {p.full_name?.[0] || p.user?.first_name?.[0] || 'P'}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-slate-900 dark:text-white block">
                                      {p.full_name || `${p.user?.first_name} ${p.user?.last_name}`}
                                    </span>
                                    <span className="text-[10px] text-slate-400 block">{p.user?.email || p.email || 'no-email'}</span>
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
                                      setSelectedPatientId(p.user_id || p.id);
                                      setEditFullName(p.full_name || `${p.user?.first_name || ''} ${p.user?.last_name || ''}`);
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
                                      onClick={() => handleArchivePatient(p.user_id || p.id)}
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
                          patientDetail.consents.map((c: any) => (
                            <div key={c.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/20 text-xs">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{c.consent_level}</span>
                              <span className="text-2xs text-slate-400">{new Date(c.granted_at).toLocaleDateString()}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Assigned exercises */}
                      <div className="space-y-2">
                        <span className="text-2xs text-slate-400 uppercase font-bold block">Assigned Exercises</span>
                        {patientDetail.assignments?.length === 0 ? (
                          <span className="text-xs text-slate-500 block">No exercises assigned yet.</span>
                        ) : (
                          patientDetail.assignments.map((a: any) => (
                            <div key={a.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/20 text-xs">
                              <span className="font-medium text-slate-700 dark:text-slate-300">{a.exercise?.name || 'Workout'}</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${a.is_completed ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'}`}>
                                {a.is_completed ? 'Completed' : 'Pending'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Sessions progress history */}
                      <div className="space-y-2">
                        <span className="text-2xs text-slate-400 uppercase font-bold block">Progress History</span>
                        {patientDetail.sessions?.length === 0 ? (
                          <span className="text-xs text-slate-500 block">No sessions recorded yet.</span>
                        ) : (
                          <div className="space-y-2">
                            {patientDetail.sessions.map((s: any) => (
                              <div 
                                key={s.id} 
                                className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800/20 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
                                onClick={() => handleOpenReplay(s.id)}
                              >
                                <div>
                                  <span className="font-medium text-slate-700 dark:text-slate-300 block truncate max-w-[150px]">{s.title}</span>
                                  <span className="text-2xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-accent-500">{s.avg_score || s.score}% Form</span>
                                  <Play className="h-3 w-3 text-primary-500" />
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
                          {(ex.joints || ex.target_joints?.list || ['Shoulder R']).map((j: string) => (
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
                        <th className="pb-3 text-right pr-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                      {stats?.recent_activity.map((act: any) => (
                        <tr 
                          key={act.id} 
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-all cursor-pointer"
                          onClick={() => handleOpenReplay(act.id)}
                        >
                          <td className="py-4 pl-2 font-medium text-slate-900 dark:text-white">
                            {act.title}
                          </td>
                          <td className="py-4 text-slate-500 dark:text-slate-400">
                            {new Date(act.created_at).toLocaleString()}
                          </td>
                          <td className="py-4 text-slate-600 dark:text-slate-300 font-semibold">
                            {act.range_of_motion || 110}°
                          </td>
                          <td className="py-4">
                            <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                              act.avg_score >= 90 
                                ? 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400' 
                                : 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400'
                            }`}>
                              {act.avg_score}% Accuracy
                            </span>
                          </td>
                          <td className="py-4 text-right pr-4">
                            <button className="text-xs font-semibold text-primary-500 hover:text-primary-600 flex items-center gap-1 ml-auto">
                              <Play className="h-3 w-3" /> Review Replay
                            </button>
                          </td>
                        </tr>
                      ))}
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

      {/* ==========================================
          MODAL: SKELETON REPLAY
          ========================================== */}
      {replayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in text-white">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-white">
                  {loadingReplay ? 'Loading Telemetry...' : replaySession?.title || 'Skeletal Replay Review'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {loadingReplay 
                    ? 'Fetching keypoint sequences from database...' 
                    : `Session ID: #${replaySession?.id} | ${replaySession?.created_at ? new Date(replaySession.created_at).toLocaleString() : ''}`}
                </p>
              </div>
              <button 
                onClick={() => {
                  setReplayModalOpen(false);
                  setIsPlaying(false);
                }} 
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {loadingReplay ? (
              <div className="h-96 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Clock className="h-10 w-10 animate-spin text-primary-500" />
                <span className="text-sm font-medium">Reconstructing 3D joint telemetry...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Canvas Display Screen */}
                <div className="flex justify-center bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative">
                  <canvas 
                    ref={canvasRef} 
                    width={640} 
                    height={480} 
                    className="w-full max-w-[640px] aspect-video block" 
                  />
                  {replayFrames.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 text-slate-400 text-sm">
                      No telemetry frames recorded for this session.
                    </div>
                  )}
                </div>

                {/* Playback Progress Slider */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
                    <span>Frame: {currentFrameIndex + 1} / {replayFrames.length}</span>
                    <span>
                      {replayFrames.length > 0 
                        ? `${(replayFrames[currentFrameIndex]?.timestamp_millis / 1000).toFixed(1)}s / ${(replayFrames[replayFrames.length - 1]?.timestamp_millis / 1000).toFixed(1)}s` 
                        : '0.0s'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range"
                      min={0}
                      max={replayFrames.length > 0 ? replayFrames.length - 1 : 0}
                      value={currentFrameIndex}
                      onChange={(e) => {
                        setCurrentFrameIndex(parseInt(e.target.value));
                        setIsPlaying(false);
                      }}
                      className="flex-1 accent-primary-500 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Control Panel */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-slate-800">
                  <div className="flex items-center gap-4">
                    {/* Play/Pause Button */}
                    <button 
                      onClick={() => setIsPlaying(!isPlaying)}
                      disabled={replayFrames.length === 0}
                      className="p-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-all text-white shadow-lg flex items-center justify-center"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>

                    {/* Reset/Restart Button */}
                    <button 
                      onClick={() => {
                        setCurrentFrameIndex(0);
                        setIsPlaying(false);
                      }}
                      disabled={replayFrames.length === 0}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold rounded-xl transition-all"
                    >
                      Reset
                    </button>
                  </div>

                  {/* Metrics Summary Box */}
                  <div className="flex gap-6 text-center text-xs">
                    <div>
                      <span className="text-slate-500 uppercase tracking-widest text-[9px] block">Range of Motion</span>
                      <span className="text-white font-bold text-sm">
                        {replaySession?.range_of_motion || replaySession?.rom || 'N/A'}°
                      </span>
                    </div>
                    <div className="border-l border-slate-800 pl-6">
                      <span className="text-slate-500 uppercase tracking-widest text-[9px] block">Form Score</span>
                      <span className="text-accent-500 font-bold text-sm">
                        {replaySession?.avg_score || replaySession?.score || 'N/A'}%
                      </span>
                    </div>
                  </div>

                  {/* Speed Selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 uppercase font-semibold">Speed:</span>
                    <select 
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                      className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1.0}>1.0x (Normal)</option>
                      <option value={1.5}>1.5x</option>
                      <option value={2.0}>2.0x</option>
                    </select>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
