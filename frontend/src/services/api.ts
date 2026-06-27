import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type {
  AdminProfile,
  DashboardStats,
  Exercise,
  MotionSession,
  PatientDetail,
  PatientListItem,
} from '@/types/api';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1';

async function request(path: string, options: RequestInit = {}) {
  // Retrieve the active Supabase session
  let token: string | undefined = undefined;
  
  if (isSupabaseConfigured) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token;
    } catch (err) {
      console.warn('Failed to retrieve Supabase session:', err);
    }
  }

  // Generate a mock JWT format token if running in Sandbox/Demo mode
  if (!token) {
    const savedMockUser = localStorage.getItem('chosen_motion_mock_user');
    if (savedMockUser) {
      try {
        const mockUser = JSON.parse(savedMockUser);
        const payload = {
          sub: mockUser.id,
          email: mockUser.email,
          app_metadata: { role: mockUser.user_metadata?.role || 'patient' }
        };
        const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
        const payloadStr = btoa(JSON.stringify(payload));
        token = `mock-token.${header}.${payloadStr}.mock-signature`;
      } catch (err) {
        console.warn('Failed to construct mock token from localStorage', err);
      }
    }
  }

  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `HTTP Error: ${response.status}`);
  }

  return response.json();
}

// ==========================================
// Authentication APIs
// ==========================================

export async function fetchUserProfile() {
  return request('/auth/me');
}

export async function syncUserWithBackend(userData: {
  id: string;
  email: string;
  role: string;
  first_name?: string;
  last_name?: string;
}) {
  return request('/auth/sync', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

export async function signUpWithBackend(data: Record<string, any>) {
  return request('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function loginWithBackend(data: Record<string, any>) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

// ==========================================
// Patient APIs
// ==========================================

export async function fetchPatientProfile() {
  return request('/patients/profile');
}

export async function fetchPatientById(patientId: string) {
  return request(`/patients/${patientId}`);
}

export async function updatePatientProfile(data: {
  full_name?: string;
  phone?: string;
  gender?: string;
  date_of_birth?: string;
  diagnosis?: string;
  assigned_admin_id?: string;
}) {
  return request('/patients/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function uploadMotionSession(sessionData: {
  title: string;
  description?: string;
  duration_seconds: number;
  avg_score?: number;
  range_of_motion?: number;
  speed?: number;
  symmetry?: number;
  status?: string;
  exercise_id?: number;
  assignment_id?: number;
  capture_config_snapshot?: Record<string, unknown>;
  environment?: {
    declared_components?: string[];
    noise_level?: number;
    mirror_present?: boolean;
    other_users_present?: boolean;
  };
  metrics_summary?: Record<string, any>;
  telemetry_data?: Array<{
    timestamp_millis: number;
    joint_coordinates: Record<string, number[]>;
    sensor_signals?: Record<string, any>;
  }>;
}) {
  return request('/patients/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
}

export async function fetchMySessions() {
  return request('/patients/sessions');
}

export async function fetchMyAssignments() {
  return request('/patients/assignments');
}

export async function fetchSessionDetail(sessionId: number) {
  return request(`/motion-sessions/${sessionId}`);
}

export async function fetchSessionFrames(sessionId: number) {
  return request(`/motion-sessions/${sessionId}/frames`);
}

export async function fetchSessionMetrics(sessionId: number) {
  return request(`/motion-sessions/${sessionId}/metrics`);
}

export async function fetchSessionAccuracy(sessionId: number) {
  return request(`/motion-sessions/${sessionId}/accuracy`);
}

export async function fetchSessionComparison(sessionId: number, mode: 'previous' | 'best' | 'worst' | 'all' = 'previous') {
  return request(`/motion-sessions/${sessionId}/comparison?mode=${mode}`);
}

export async function fetchAssignmentPrescription(assignmentId: number) {
  return request(`/patients/assignments/${assignmentId}/prescription`);
}

export async function fetchMyRecords() {
  return request('/patients/records');
}

export async function fetchExerciseRecord(exerciseId: number) {
  return request(`/patients/records/${exerciseId}`);
}

// ==========================================
// Admin APIs
// ==========================================

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return request('/admin/dashboard-stats');
}

export async function fetchPatientsList(
  search?: string,
  includeArchived: boolean = false
): Promise<PatientListItem[]> {
  let path = '/admin/patients?';
  if (search) path += `search=${encodeURIComponent(search)}&`;
  path += `include_archived=${includeArchived}`;
  return request(path);
}

export async function createPatient(data: {
  email: string;
  full_name: string;
  date_of_birth?: string;
  phone?: string;
  diagnosis?: string;
  consent_level?: string;
}) {
  return request('/admin/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchPatientDetail(patientId: string): Promise<PatientDetail> {
  return request(`/admin/patients/${patientId}/profile`);
}

export async function updatePatient(
  patientId: string,
  data: {
    full_name?: string;
    diagnosis?: string;
    date_of_birth?: string;
    phone?: string;
    is_archived?: boolean;
  }
) {
  return request(`/admin/patients/${patientId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function archivePatient(patientId: string) {
  return request(`/admin/patients/${patientId}`, {
    method: 'DELETE',
  });
}

export async function fetchAnySessionDetail(sessionId: number) {
  return request(`/admin/sessions/${sessionId}`);
}

// ==========================================
// Exercise Catalog APIs
// ==========================================

export async function fetchExercisesList(): Promise<Exercise[]> {
  return request('/admin/exercises');
}

export async function createExercise(data: {
  name: string;
  description?: string;
  instructions?: string;
  target_rom?: number;
  thumbnail_url?: string;
  target_joints?: Record<string, any>;
}) {
  return request('/admin/exercises', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExercise(
  exerciseId: number,
  data: {
    name?: string;
    description?: string;
    instructions?: string;
    target_rom?: number;
    thumbnail_url?: string;
    target_joints?: Record<string, any>;
  }
) {
  return request(`/admin/exercises/${exerciseId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExercise(exerciseId: number) {
  return request(`/admin/exercises/${exerciseId}`, {
    method: 'DELETE',
  });
}

export async function assignExerciseToPatient(
  patientId: string,
  data: { exercise_id: number; due_date?: string; config?: Record<string, unknown> }
) {
  return request(`/admin/patients/${patientId}/assignments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeExerciseAssignment(
  patientId: string,
  assignmentId: number
) {
  return request(`/admin/patients/${patientId}/assignments/${assignmentId}`, {
    method: 'DELETE',
  });
}

export async function updateExerciseAssignment(
  patientId: string,
  assignmentId: number,
  data: { due_date?: string; is_completed?: boolean; config?: Record<string, unknown> }
) {
  return request(`/admin/patients/${patientId}/assignments/${assignmentId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function fetchAdminProfile(): Promise<AdminProfile> {
  return request('/auth/admin/profile');
}

export async function fetchMotionReports(
  patientId?: string,
  limit: number = 50,
  offset: number = 0
): Promise<MotionSession[]> {
  let path = `/admin/sessions?limit=${limit}&offset=${offset}`;
  if (patientId) {
    path += `&patient_id=${encodeURIComponent(patientId)}`;
  }
  return request(path);
}

// ==========================================
// Squat Live Tracking APIs
// ==========================================

export async function startSquatSession() {
  return request('/exercise/squat/start', {
    method: 'POST',
  });
}

export async function submitSquatFrame(data: {
  session_id: number;
  frame_number: number;
  timestamp_ms: number;
  joint_coordinates: Record<string, number[]>;
}) {
  return request('/exercise/squat/frame', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function createExerciseRule(
  exerciseId: number,
  data: {
    rule_name: string;
    rule_type?: string;
    parameters: Record<string, unknown>;
    status_on_success?: string;
    status_on_fail?: string;
  }
) {
  return request(`/admin/exercises/${exerciseId}/rules`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateExerciseRule(
  exerciseId: number,
  ruleId: number,
  data: Record<string, unknown>
) {
  return request(`/admin/exercises/${exerciseId}/rules/${ruleId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteExerciseRule(exerciseId: number, ruleId: number) {
  return request(`/admin/exercises/${exerciseId}/rules/${ruleId}`, {
    method: 'DELETE',
  });
}

export async function fetchEnvironmentComponents() {
  return request('/admin/environment-components');
}

export async function fetchPatientLimitations(patientId: string) {
  return request(`/admin/patients/${patientId}/limitations`);
}

export async function createPatientLimitation(
  patientId: string,
  data: {
    scope_type: string;
    scope_id?: number;
    limitation_type: string;
    parameters: Record<string, unknown>;
    notes?: string;
    active?: boolean;
  }
) {
  return request(`/admin/patients/${patientId}/limitations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updatePatientLimitation(
  patientId: string,
  limitationId: number,
  data: Record<string, unknown>
) {
  return request(`/admin/patients/${patientId}/limitations/${limitationId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deletePatientLimitation(patientId: string, limitationId: number) {
  return request(`/admin/patients/${patientId}/limitations/${limitationId}`, {
    method: 'DELETE',
  });
}

export async function fetchFrameAnnotations(sessionId: number) {
  return request(`/motion-sessions/${sessionId}/frame-annotations`);
}

export async function createFrameAnnotation(
  sessionId: number,
  data: {
    frame_number: number;
    issue_tags?: string[];
    notes?: string;
    suggestions?: string;
    visible_to_patient?: boolean;
  }
) {
  return request(`/admin/sessions/${sessionId}/frame-annotations`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteFrameAnnotation(sessionId: number, annotationId: number) {
  return request(`/admin/sessions/${sessionId}/frame-annotations/${annotationId}`, {
    method: 'DELETE',
  });
}

export async function fetchClinicAnalytics() {
  return request('/admin/analytics/clinic');
}

export async function fetchPatientAnalytics(patientId: string) {
  return request(`/admin/analytics/patient/${patientId}`);
}

export async function createProgressReport(patientId: string) {
  return request(`/admin/patients/${patientId}/progress-reports`, { method: 'POST' });
}

export async function fetchPatientProgressReports(patientId: string) {
  return request(`/admin/patients/${patientId}/progress-reports`);
}

export async function fetchMyProgressReports() {
  return request('/patients/progress-reports');
}

export async function backfillExerciseRecords(patientId?: string) {
  const qs = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '';
  return request(`/admin/records/backfill${qs}`, { method: 'POST' });
}

export async function createEnvironmentComponent(data: {
  name: string;
  slug: string;
  category: string;
  setup_instructions?: string;
  affects_tracking?: boolean;
}) {
  return request('/admin/environment-components', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchExerciseEnvironmentRequirements(exerciseId: number) {
  return request(`/admin/exercises/${exerciseId}/environment-requirements`);
}

export async function addExerciseEnvironmentRequirement(
  exerciseId: number,
  data: { component_id: number; required?: boolean; config?: Record<string, unknown> }
) {
  return request(`/admin/exercises/${exerciseId}/environment-requirements`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function removeExerciseEnvironmentRequirement(exerciseId: number, requirementId: number) {
  return request(`/admin/exercises/${exerciseId}/environment-requirements/${requirementId}`, {
    method: 'DELETE',
  });
}

export async function endSquatSession(sessionId: number) {
  return request('/exercise/squat/end', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
  });
}

