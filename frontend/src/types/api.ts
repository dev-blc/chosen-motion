/** API response types aligned with backend Pydantic schemas (snake_case). */

export interface PatientListItem {
  id: string;
  patient_id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  date_of_birth?: string | null;
  phone?: string | null;
  diagnosis?: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface ConsentRecord {
  id: number;
  patient_id: string;
  consent_level: string;
  granted_at: string;
}

export interface ExerciseRule {
  id: number;
  exercise_id: number;
  rule_name: string;
  rule_type: string;
  parameters: Record<string, unknown>;
  status_on_success: string;
  status_on_fail: string;
  created_at: string;
}

export interface Exercise {
  id: number;
  name: string;
  description?: string | null;
  instructions?: string | null;
  target_rom?: number | null;
  thumbnail_url?: string | null;
  target_joints?: { list?: string[]; landmarks?: string[] } | null;
  capture_config?: Record<string, unknown> | null;
  metric_definitions?: Record<string, unknown> | null;
  guide_content?: ExerciseGuideContent | null;
  created_at: string;
  rules?: ExerciseRule[];
}

export interface ExerciseGuideContent {
  description?: string;
  instructions?: string[];
  preparation_tips?: string[];
  common_mistakes?: string[];
  safety_notes?: string[];
  target_muscles?: string[];
  required_equipment?: string;
  sets?: number;
  reps?: number;
  rest?: string;
  difficulty?: string;
  duration?: string;
  body_part?: string;
  category?: string;
}

export interface AssignmentConfig {
  target_rom_override?: number;
  sets?: number;
  reps?: number;
  rest_seconds?: number;
  rule_overrides?: Array<{ rule_id: number; value: number }>;
  notes?: string;
  difficulty?: string;
  duration?: string;
  body_part?: string;
  category?: string;
}

export interface Prescription {
  assignment_id: number;
  patient_id: string;
  exercise_id: number;
  exercise_name: string;
  target_rom?: number | null;
  target_joints?: Record<string, unknown> | null;
  capture_config?: Record<string, unknown> | null;
  capture_guidance?: Record<string, unknown> | null;
  rules: ExerciseRule[];
  config: AssignmentConfig;
  guide: {
    description?: string;
    instructions?: string[];
    preparation_tips?: string[];
    common_mistakes?: string[];
    safety_notes?: string[];
    target_muscles?: string[];
    required_equipment?: string;
  };
  limitations: Array<Record<string, unknown>>;
  environment_requirements?: Array<{
    slug: string;
    name: string;
    category?: string;
    required?: boolean;
    affects_tracking?: boolean;
    setup_instructions?: string;
  }>;
}

export interface PatientExerciseRecord {
  id: number;
  patient_id: string;
  exercise_id: number;
  best_session_id?: number | null;
  best_metrics?: Record<string, number> | null;
  best_recorded_at?: string | null;
  worst_session_id?: number | null;
  worst_metrics?: Record<string, number> | null;
  worst_recorded_at?: string | null;
}

export interface ExerciseAssignment {
  id: number;
  patient_id: string;
  exercise_id: number;
  assigned_by?: string | null;
  assigned_at: string;
  due_date?: string | null;
  is_completed: boolean;
  config?: AssignmentConfig | null;
  exercise?: Exercise | null;
}

export interface MotionSession {
  id: number;
  patient_id: string;
  exercise_id?: number | null;
  assignment_id?: number | null;
  title: string;
  description?: string | null;
  duration_seconds: number;
  avg_score?: number | null;
  score?: number | null;
  range_of_motion?: number | null;
  speed?: number | null;
  symmetry?: number | null;
  metrics_summary?: Record<string, unknown> | null;
  status?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface PatientDetail {
  patient_id: string;
  user_id: string;
  email: string;
  full_name: string;
  date_of_birth?: string | null;
  phone?: string | null;
  diagnosis?: string | null;
  is_archived: boolean;
  consents: ConsentRecord[];
  assignments: ExerciseAssignment[];
  sessions: MotionSession[];
}

export interface DashboardStats {
  total_patients: number;
  total_sessions: number;
  average_duration_seconds: number;
  average_session_score: number;
  recent_activity: MotionSession[];
}

export interface AdminProfile {
  id: string;
  admin_id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  created_at: string;
}

/** Resolve display score from a session record. */
export function sessionFormScore(session: MotionSession): number {
  return Math.round(session.avg_score ?? session.score ?? 0);
}

/** Resolve ROM in degrees from a session record. */
export function sessionRom(session: MotionSession): number {
  const summary = session.metrics_summary as { rom?: number } | undefined;
  return Math.round(session.range_of_motion ?? summary?.rom ?? 0);
}

/** Resolve joint tags for exercise card display. */
export function exerciseJointTags(exercise: Exercise): string[] {
  if (exercise.target_joints?.list?.length) {
    return exercise.target_joints.list;
  }
  if (exercise.target_joints?.landmarks?.length) {
    return exercise.target_joints.landmarks;
  }
  return [];
}

/** Stable patient identifier for API calls. */
export function patientApiId(patient: PatientListItem): string {
  return patient.patient_id || patient.auth_user_id || patient.id;
}

/** Session timestamp for display (prefer completed_at). */
export function sessionTimestamp(session: MotionSession): string {
  return session.completed_at || session.created_at;
}
