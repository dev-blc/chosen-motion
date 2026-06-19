from __future__ import annotations
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
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str = "patient"

class UserCreate(UserBase):
    id: str  # Matches Supabase UUID

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None

class UserResponse(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

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

class AdminResponse(AdminBase):
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

class PatientCreate(PatientBase):
    id: str

class PatientUpdate(BaseModel):
    date_of_birth: Optional[date] = None
    diagnosis: Optional[str] = None
    assigned_admin_id: Optional[str] = None
    is_archived: Optional[bool] = None

class PatientResponse(PatientBase):
    id: str
    full_name: str
    phone: Optional[str] = None
    user: UserResponse

    class Config:
        from_attributes = True

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

# Exercise Response
class ExerciseResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    instructions: Optional[str] = None
    target_rom: Optional[float] = None
    thumbnail_url: Optional[str] = None
    target_joints: Optional[Dict[str, Any]] = None
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

class ExerciseUpdateAdmin(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    target_rom: Optional[float] = None
    thumbnail_url: Optional[str] = None
    target_joints: Optional[Dict[str, Any]] = None

# Exercise Assignment Response
class ExerciseAssignmentResponse(BaseModel):
    id: int
    patient_id: str
    exercise_id: int
    assigned_by: Optional[str] = None
    assigned_at: datetime
    due_date: Optional[date] = None
    is_completed: bool
    exercise: Optional[ExerciseResponse] = None

    class Config:
        from_attributes = True

# Detailed Patient History Response
class PatientDetailFullResponse(BaseModel):
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

class SessionBase(BaseModel):
    title: str = "Motion Tracking Session"
    description: Optional[str] = None
    duration_seconds: int = 0
    avg_score: Optional[float] = None
    range_of_motion: Optional[float] = None
    metrics_summary: Optional[Dict[str, Any]] = None
    status: Optional[str] = None

class SessionCreate(SessionBase):
    telemetry_data: List[MotionDataCreate] = []

class SessionResponse(SessionBase):
    id: int
    patient_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class SessionDetailResponse(SessionResponse):
    telemetry_data: List[MotionDataResponse] = []

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
