from __future__ import annotations
import uuid
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional, Dict, Any

# ==========================================
# Common / Shared Schemas
# ==========================================

class MessageResponse(BaseModel):
    message: str

# ==========================================
# User Schemas
# ==========================================

class UserBase(BaseModel):
    email: EmailStr
    role: str = "patient"

class UserCreate(UserBase):
    auth_user_id: Optional[uuid.UUID] = None
    id: Optional[uuid.UUID] = None

class UserUpdate(BaseModel):
    role: Optional[str] = None

class UserResponse(UserBase):
    id: uuid.UUID
    auth_user_id: uuid.UUID
    created_at: datetime

    class Config:
        from_attributes = True

class AdminProfileResponse(BaseModel):
    id: uuid.UUID
    admin_id: str
    auth_user_id: uuid.UUID
    email: EmailStr
    full_name: str
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# Admin Schemas
# ==========================================

class AdminBase(BaseModel):
    department: Optional[str] = None
    access_level: str = "standard"

class AdminCreate(AdminBase):
    id: str

class AdminUpdate(BaseModel):
    department: Optional[str] = None
    access_level: Optional[str] = None

class AdminWithUserResponse(AdminBase):
    id: str
    user: UserResponse

    class Config:
        from_attributes = True

# ==========================================
# Patient Schemas
# ==========================================

from datetime import datetime, date

class PatientBase(BaseModel):
    date_of_birth: Optional[date] = None
    diagnosis: Optional[str] = None
    assigned_admin_id: Optional[str] = None
    is_archived: bool = False
    gender: Optional[str] = None

class PatientCreate(PatientBase):
    id: uuid.UUID
    patient_id: str
    auth_user_id: str
    email: EmailStr
    full_name: str
    phone: Optional[str] = None

class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    diagnosis: Optional[str] = None
    assigned_admin_id: Optional[str] = None
    is_archived: Optional[bool] = None

class PatientResponse(PatientBase):
    id: uuid.UUID
    patient_id: str
    auth_user_id: uuid.UUID
    email: EmailStr
    full_name: str
    phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserSignUpRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "patient" # 'patient' or 'admin'
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None

class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user_id: str
    role: str = "patient"
    patient_id: Optional[str] = None
    admin_id: Optional[str] = None

# Administrative CRUD Schemas
class PatientCreateAdmin(BaseModel):
    email: EmailStr
    full_name: str
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    diagnosis: Optional[str] = None
    consent_level: Optional[str] = "Full Consent"

class PatientUpdateAdmin(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    diagnosis: Optional[str] = None
    is_archived: Optional[bool] = None

# Consent Response
class ConsentResponse(BaseModel):
    id: int
    patient_id: str
    consent_level: str
    granted_at: datetime

    class Config:
        from_attributes = True

class ExerciseRuleResponse(BaseModel):
    id: int
    exercise_id: int
    rule_name: str
    rule_type: str
    parameters: Dict[str, Any]
    status_on_success: str
    status_on_fail: str
    created_at: datetime

    class Config:
        from_attributes = True

class ExerciseRuleCreate(BaseModel):
    rule_name: str
    rule_type: str = "threshold_comparison"
    parameters: Dict[str, Any]
    status_on_success: str = "success"
    status_on_fail: str = "warning"

class ExerciseRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    rule_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    status_on_success: Optional[str] = None
    status_on_fail: Optional[str] = None

class ExerciseGuideContent(BaseModel):
    description: Optional[str] = None
    instructions: List[str] = []
    preparation_tips: List[str] = []
    common_mistakes: List[str] = []
    safety_notes: List[str] = []
    target_muscles: List[str] = []
    required_equipment: Optional[str] = "None (Bodyweight)"
    sets: Optional[int] = 3
    reps: Optional[int] = 10
    rest: Optional[str] = "30s"
    difficulty: Optional[str] = "Light"
    duration: Optional[str] = "5 mins"
    body_part: Optional[str] = "General"
    category: Optional[str] = "Rehabilitation"

# Exercise Response
class ExerciseResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    target_rom: Optional[float] = None
    thumbnail_url: Optional[str] = None
    target_joints: Optional[Dict[str, Any]] = None
    capture_config: Optional[Dict[str, Any]] = None
    metric_definitions: Optional[Dict[str, Any]] = None
    guide_content: Optional[Dict[str, Any]] = None
    created_at: datetime
    rules: List[ExerciseRuleResponse] = []

    class Config:
        from_attributes = True

# Administrative Exercise CRUD Schemas
class ExerciseCreateAdmin(BaseModel):
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    target_rom: Optional[float] = None
    thumbnail_url: Optional[str] = None
    target_joints: Optional[Dict[str, Any]] = None
    capture_config: Optional[Dict[str, Any]] = None
    metric_definitions: Optional[Dict[str, Any]] = None
    guide_content: Optional[Dict[str, Any]] = None
    capture_config: Optional[Dict[str, Any]] = None
    metric_definitions: Optional[Dict[str, Any]] = None
    guide_content: Optional[Dict[str, Any]] = None

class ExerciseUpdateAdmin(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    target_rom: Optional[float] = None
    thumbnail_url: Optional[str] = None
    target_joints: Optional[Dict[str, Any]] = None
    capture_config: Optional[Dict[str, Any]] = None
    metric_definitions: Optional[Dict[str, Any]] = None
    guide_content: Optional[Dict[str, Any]] = None

class AssignmentConfig(BaseModel):
    target_rom_override: Optional[float] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    rest_seconds: Optional[int] = None
    rule_overrides: Optional[List[Dict[str, Any]]] = None
    notes: Optional[str] = None
    difficulty: Optional[str] = None
    duration: Optional[str] = None
    body_part: Optional[str] = None
    category: Optional[str] = None

# Exercise Assignment Schemas
class ExerciseAssignmentCreate(BaseModel):
    exercise_id: int
    due_date: Optional[date] = None
    config: Optional[Dict[str, Any]] = None

class ExerciseAssignmentUpdate(BaseModel):
    due_date: Optional[date] = None
    is_completed: Optional[bool] = None
    config: Optional[Dict[str, Any]] = None

class ExerciseAssignmentResponse(BaseModel):
    id: int
    patient_id: str
    exercise_id: int
    assigned_by: Optional[str] = None
    assigned_at: datetime
    due_date: Optional[date] = None
    is_completed: bool
    config: Optional[Dict[str, Any]] = None
    exercise: Optional[ExerciseResponse] = None

    class Config:
        from_attributes = True

# ==========================================
# Motion Telemetry Schemas
# ==========================================

class MotionDataBase(BaseModel):
    timestamp_millis: int
    joint_coordinates: Dict[str, List[float]] # e.g. {"left_elbow": [x, y, z]}
    sensor_signals: Optional[Dict[str, Any]] = None

class MotionDataCreate(MotionDataBase):
    pass

class MotionDataResponse(MotionDataBase):
    id: int
    session_id: int

    class Config:
        from_attributes = True

# ==========================================
# Session Schemas
# ==========================================

class MotionFrameResponse(BaseModel):
    id: uuid.UUID
    session_id: int
    frame_number: int
    timestamp_millis: int
    joint_coordinates: Dict[str, Any]
    sensor_signals: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class SessionFramesResponse(BaseModel):
    session_id: int
    frames: List[MotionFrameResponse]

class SessionErrorDetail(BaseModel):
    type: str
    severity: str
    timestamp_ms: int
    description: str

class SessionAccuracyResponse(BaseModel):
    accuracy_score: float
    detected_errors: List[SessionErrorDetail] = []

class MetricCompare(BaseModel):
    current: float
    previous: float
    delta: float

class RecordMetricCompare(BaseModel):
    current: float
    record: float
    delta: float
    is_new_best: bool = False

class SessionComparisonResponse(BaseModel):
    current_session_id: int
    previous_session_id: Optional[int] = None
    mode: str = "previous"
    rom: MetricCompare
    speed: MetricCompare
    symmetry: MetricCompare
    accuracy: MetricCompare
    smoothness: MetricCompare
    repetitions: MetricCompare
    best_session_id: Optional[int] = None
    worst_session_id: Optional[int] = None
    best: Optional[Dict[str, RecordMetricCompare]] = None
    worst: Optional[Dict[str, RecordMetricCompare]] = None
    is_new_personal_best: bool = False

class SessionEnvironmentInput(BaseModel):
    declared_components: Optional[List[str]] = None
    noise_level: Optional[int] = None
    mirror_present: Optional[bool] = None
    other_users_present: Optional[bool] = None

class SessionUploadResponse(SessionResponse):
    is_new_personal_best: bool = False
    assignment_id: Optional[int] = None

class SessionBase(BaseModel):
    title: str = "Motion Tracking Session"
    description: Optional[str] = None
    duration_seconds: int = 0
    avg_score: Optional[float] = None
    range_of_motion: Optional[float] = None
    speed: Optional[float] = None
    symmetry: Optional[float] = None
    metrics_summary: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

class SessionCreate(SessionBase):
    telemetry_data: Optional[List[Any]] = None
    exercise_id: Optional[int] = None
    assignment_id: Optional[int] = None
    environment: Optional[SessionEnvironmentInput] = None
    capture_config_snapshot: Optional[Dict[str, Any]] = None

class SessionResponse(SessionBase):
    id: int
    patient_id: str
    exercise_id: Optional[int] = None
    assignment_id: Optional[int] = None
    score: Optional[float] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Detailed Patient History Response
class PatientDetailFullResponse(BaseModel):
    patient_id: str
    user_id: str
    email: str
    full_name: str
    date_of_birth: Optional[date] = None
    phone: Optional[str] = None
    diagnosis: Optional[str] = None
    is_archived: bool
    consents: List[ConsentResponse] = []
    assignments: List[ExerciseAssignmentResponse] = []
    sessions: List[SessionResponse] = []

    class Config:
        from_attributes = True

class SessionDetailResponse(SessionResponse):
    telemetry_data: List[MotionFrameResponse] = []
    environment_context: Dict[str, Any] = {}

    class Config:
        from_attributes = True

# ==========================================
# Aggregated Analytics/Dashboard Schemas
# ==========================================

class PatientDetailResponse(PatientResponse):
    sessions: List[SessionResponse] = []

    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_patients: int
    total_sessions: int
    average_duration_seconds: float
    average_session_score: float
    recent_activity: List[SessionResponse] = []

class PatientExerciseRecordResponse(BaseModel):
    id: int
    patient_id: str
    exercise_id: int
    best_session_id: Optional[int] = None
    best_metrics: Optional[Dict[str, Any]] = None
    best_recorded_at: Optional[datetime] = None
    worst_session_id: Optional[int] = None
    worst_metrics: Optional[Dict[str, Any]] = None
    worst_recorded_at: Optional[datetime] = None
    metric_keys: Optional[Dict[str, Any]] = None
    updated_at: datetime

    class Config:
        from_attributes = True

class PrescriptionResponse(BaseModel):
    assignment_id: int
    patient_id: str
    exercise_id: int
    exercise_name: str
    target_rom: Optional[float] = None
    target_joints: Optional[Dict[str, Any]] = None
    capture_config: Optional[Dict[str, Any]] = None
    metric_definitions: Optional[Dict[str, Any]] = None
    rules: List[Dict[str, Any]] = []
    config: Dict[str, Any] = {}
    guide: Dict[str, Any] = {}
    limitations: List[Dict[str, Any]] = []
    environment_requirements: List[Dict[str, Any]] = []
    capture_guidance: Dict[str, Any] = {}

class PatientLimitationCreate(BaseModel):
    scope_type: str
    scope_id: Optional[int] = None
    limitation_type: str
    parameters: Dict[str, Any] = {}
    notes: Optional[str] = None
    active: bool = True

class PatientLimitationUpdate(BaseModel):
    scope_type: Optional[str] = None
    scope_id: Optional[int] = None
    limitation_type: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    active: Optional[bool] = None

class PatientLimitationResponse(BaseModel):
    id: int
    patient_id: str
    scope_type: str
    scope_id: Optional[int] = None
    limitation_type: str
    parameters: Dict[str, Any]
    notes: Optional[str] = None
    active: bool
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class EnvironmentComponentResponse(BaseModel):
    id: int
    name: str
    slug: str
    category: str
    icon_url: Optional[str] = None
    setup_instructions: Optional[str] = None
    affects_tracking: bool
    created_at: datetime

    class Config:
        from_attributes = True

class EnvironmentComponentCreate(BaseModel):
    name: str
    slug: str
    category: str
    icon_url: Optional[str] = None
    setup_instructions: Optional[str] = None
    affects_tracking: bool = False


class SessionFrameAnnotationCreate(BaseModel):
    frame_number: int
    issue_tags: Optional[List[str]] = None
    notes: Optional[str] = None
    suggestions: Optional[str] = None
    visible_to_patient: bool = True


class SessionFrameAnnotationUpdate(BaseModel):
    frame_number: Optional[int] = None
    issue_tags: Optional[List[str]] = None
    notes: Optional[str] = None
    suggestions: Optional[str] = None
    visible_to_patient: Optional[bool] = None


class SessionFrameAnnotationResponse(BaseModel):
    id: int
    session_id: int
    patient_id: str
    frame_number: int
    issue_tags: Optional[List[str]] = None
    notes: Optional[str] = None
    suggestions: Optional[str] = None
    created_by: Optional[str] = None
    visible_to_patient: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExerciseEnvironmentRequirementCreate(BaseModel):
    component_id: int
    required: bool = True
    config: Optional[Dict[str, Any]] = None


class ExerciseEnvironmentRequirementResponse(BaseModel):
    id: int
    exercise_id: int
    component_id: int
    slug: Optional[str] = None
    name: Optional[str] = None
    category: Optional[str] = None
    required: bool
    affects_tracking: Optional[bool] = None
    setup_instructions: Optional[str] = None
    config: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True


class WeeklyMetricPoint(BaseModel):
    label: str
    avg_rom: float = 0
    session_count: int = 0


class AlignmentScorePoint(BaseModel):
    label: str
    score: float = 0
    session_count: int = 0
    avg_rom: Optional[float] = None


class ClinicAnalyticsResponse(BaseModel):
    rom_progress: List[WeeklyMetricPoint] = []
    alignment_scores: List[AlignmentScorePoint] = []
    total_sessions: int = 0
    average_session_score: float = 0
    active_patients: int = 0


class PatientAnalyticsResponse(BaseModel):
    patient_id: str
    rom_progress: List[WeeklyMetricPoint] = []
    alignment_scores: List[AlignmentScorePoint] = []
    total_sessions: int = 0
    recent_sessions: List[Dict[str, Any]] = []


class ProgressReportResponse(BaseModel):
    id: int
    patient_id: str
    report_date: date
    summary: str
    metrics: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BackfillRecordsResponse(BaseModel):
    sessions_processed: int
    records_updated: int
