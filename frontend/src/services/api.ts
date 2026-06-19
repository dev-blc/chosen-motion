import { supabase } from '@/lib/supabase';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1';

async function request(path: string, options: RequestInit = {}) {
  // Retrieve the active Supabase session
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

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

// ==========================================
// Patient APIs
// ==========================================

export async function fetchPatientProfile() {
  return request('/patients/profile');
}

export async function updatePatientProfile(data: {
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
  status?: string;
  metrics_summary?: Record<string, any>;
  telemetry_data: Array<{
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
  return request(`/patients/sessions/${sessionId}`);
}

// ==========================================
// Admin APIs
// ==========================================

export async function fetchDashboardStats() {
  return request('/admin/dashboard-stats');
}

export async function fetchPatientsList(search?: string, includeArchived: boolean = false) {
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

export async function fetchPatientDetail(patientId: string) {
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

export async function fetchExercisesList() {
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

export async function fetchSessionReplay(sessionId: number) {
  return request(`/motion-session/${sessionId}/replay`);
}

