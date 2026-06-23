import uuid
from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import String, ForeignKey, DateTime, JSON, Float, Integer, Boolean, Numeric, Date, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    auth_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="patient", nullable=False) # 'admin' or 'patient'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient_profile: Mapped[Optional["Patient"]] = relationship(
        "Patient", 
        back_populates="user", 
        uselist=False, 
        cascade="all, delete-orphan",
        foreign_keys="[Patient.auth_user_id]"
    )
    admin_profile: Mapped[Optional["Admin"]] = relationship(
        "Admin", 
        back_populates="user", 
        uselist=False, 
        cascade="all, delete-orphan",
        foreign_keys="[Admin.auth_user_id]"
    )


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    admin_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    auth_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.auth_user_id", ondelete="CASCADE"), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="admin_profile", foreign_keys=[auth_user_id])


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    auth_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.auth_user_id", ondelete="CASCADE"), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    gender: Mapped[Optional[str]] = mapped_column(String(50))
    diagnosis: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    assigned_admin_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="patient_profile", foreign_keys=[auth_user_id])
    consents: Mapped[List["Consent"]] = relationship("Consent", back_populates="patient", cascade="all, delete-orphan", primaryjoin="Patient.patient_id == Consent.patient_id")
    assignments: Mapped[List["ExerciseAssignment"]] = relationship("ExerciseAssignment", back_populates="patient", cascade="all, delete-orphan", primaryjoin="Patient.patient_id == ExerciseAssignment.patient_id")
    sessions: Mapped[List["MotionSession"]] = relationship("MotionSession", back_populates="patient", cascade="all, delete-orphan", primaryjoin="Patient.patient_id == MotionSession.patient_id")
    motion_frames: Mapped[List["MotionFrame"]] = relationship("MotionFrame", back_populates="patient", cascade="all, delete-orphan", primaryjoin="Patient.patient_id == MotionFrame.patient_id")
    progress_reports: Mapped[List["ProgressReport"]] = relationship("ProgressReport", back_populates="patient", cascade="all, delete-orphan", primaryjoin="Patient.patient_id == ProgressReport.patient_id")


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(50), ForeignKey("patients.patient_id", ondelete="CASCADE"), nullable=False)
    consent_level: Mapped[str] = mapped_column(String(100), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="consents", primaryjoin="Consent.patient_id == Patient.patient_id")


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(2000))
    instructions: Mapped[Optional[str]] = mapped_column(String(2000))
    target_rom: Mapped[Optional[float]] = mapped_column(Float)
    thumbnail_url: Mapped[Optional[str]] = mapped_column(String(500))
    target_joints: Mapped[Optional[dict]] = mapped_column(JSON) # JSONB matching list of tracked points
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    assignments: Mapped[List["ExerciseAssignment"]] = relationship("ExerciseAssignment", back_populates="exercise")
    sessions: Mapped[List["MotionSession"]] = relationship("MotionSession", back_populates="exercise")
    rules: Mapped[List["ExerciseRule"]] = relationship(
        "ExerciseRule", 
        back_populates="exercise", 
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class ExerciseAssignment(Base):
    __tablename__ = "exercise_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(50), ForeignKey("patients.patient_id", ondelete="CASCADE"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(Integer, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False)
    assigned_by: Mapped[Optional[str]] = mapped_column(String(255))
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="assignments", primaryjoin="ExerciseAssignment.patient_id == Patient.patient_id")
    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="assignments")


class MotionSession(Base):
    __tablename__ = "motion_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(50), ForeignKey("patients.patient_id", ondelete="CASCADE"), nullable=False)
    exercise_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("exercises.id", ondelete="SET NULL"))
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Numeric(5, 2))
    status: Mapped[Optional[str]] = mapped_column(String(50))
    duration_seconds: Mapped[int] = mapped_column(Integer, default=180, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="sessions", primaryjoin="MotionSession.patient_id == Patient.patient_id")
    exercise: Mapped[Optional["Exercise"]] = relationship("Exercise", back_populates="sessions")
    metrics: Mapped[List["MotionMetric"]] = relationship("MotionSession" if False else "MotionMetric", back_populates="session", cascade="all, delete-orphan")
    frames: Mapped[List["MotionFrame"]] = relationship("MotionFrame", back_populates="session", cascade="all, delete-orphan")

    @property
    def title(self) -> str:
        return self.exercise.name if self.exercise else "Motion Tracking Session"

    @property
    def description(self) -> str:
        return self.exercise.description if (self.exercise and self.exercise.description) else "General movement session"

    @property
    def avg_score(self) -> float:
        return float(self.score) if self.score is not None else 0.0

    @property
    def range_of_motion(self) -> float:
        if self.metrics and len(self.metrics) > 0:
            return self.metrics[0].rom if self.metrics[0].rom is not None else 0.0
        return 0.0

    @property
    def speed(self) -> float:
        if self.metrics and len(self.metrics) > 0:
            return self.metrics[0].speed if self.metrics[0].speed is not None else 0.0
        return 0.0

    @property
    def symmetry(self) -> float:
        if self.metrics and len(self.metrics) > 0:
            return self.metrics[0].symmetry if self.metrics[0].symmetry is not None else 0.0
        return 0.0

    @property
    def metrics_summary(self) -> dict:
        if self.metrics and len(self.metrics) > 0:
            m = self.metrics[0]
            return {
                "rom": m.rom or 0.0,
                "speed": m.speed or 0.0,
                "symmetry": m.symmetry or 0.0,
                "smoothness": getattr(m, "smoothness", 0.0) or 0.0,
                "repetitions": getattr(m, "repetitions", 0) or 0,
                "accuracy_score": getattr(m, "accuracy_score", 0.0) or 0.0,
                "max_rom": getattr(m, "max_rom", 0.0) or 0.0,
                "detected_errors": getattr(m, "detected_errors", {}) or {}
            }
        return {
            "rom": 0.0,
            "speed": 0.0,
            "symmetry": 0.0,
            "smoothness": 0.0,
            "repetitions": 0,
            "accuracy_score": 0.0,
            "max_rom": 0.0,
            "detected_errors": {}
        }

    @property
    def telemetry_data(self) -> list:
        return self.frames


class MotionMetric(Base):
    __tablename__ = "motion_metrics"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("motion_sessions.id", ondelete="CASCADE"), nullable=False)
    patient_id: Mapped[str] = mapped_column(String(50), ForeignKey("patients.patient_id", ondelete="CASCADE"), nullable=False)
    rom: Mapped[Optional[float]] = mapped_column(Float) # Range of Motion
    speed: Mapped[Optional[float]] = mapped_column(Float)
    symmetry: Mapped[Optional[float]] = mapped_column(Float)
    smoothness: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    repetitions: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    accuracy_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    detected_errors: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    max_rom: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Relationships
    session: Mapped["MotionSession"] = relationship("MotionSession", back_populates="metrics")


class WebsiteContent(Base):
    __tablename__ = "website_content"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    page_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    content_data: Mapped[dict] = mapped_column(JSON, nullable=False) # Structured content config
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Settings(Base):
    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    setting_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    setting_value: Mapped[dict] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ExerciseRule(Base):
    __tablename__ = "exercise_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    exercise_id: Mapped[int] = mapped_column(Integer, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False)
    rule_name: Mapped[str] = mapped_column(String(255), nullable=False)
    rule_type: Mapped[str] = mapped_column(String(100), nullable=False)
    parameters: Mapped[dict] = mapped_column(JSON, nullable=False)
    status_on_success: Mapped[str] = mapped_column(String(50), default="success", nullable=False)
    status_on_fail: Mapped[str] = mapped_column(String(50), default="warning", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="rules")


class MotionFrame(Base):
    __tablename__ = "motion_frames"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[str] = mapped_column(String(50), ForeignKey("patients.patient_id", ondelete="CASCADE"), nullable=False)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("motion_sessions.id", ondelete="CASCADE"), nullable=False)
    frame_number: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    timestamp_millis: Mapped[int] = mapped_column(Integer, nullable=False)
    joint_coordinates: Mapped[dict] = mapped_column(JSON, nullable=False)
    sensor_signals: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship(
        "Patient", 
        back_populates="motion_frames", 
        primaryjoin="MotionFrame.patient_id == Patient.patient_id"
    )
    session: Mapped["MotionSession"] = relationship("MotionSession", back_populates="frames")


class ProgressReport(Base):
    __tablename__ = "progress_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(50), ForeignKey("patients.patient_id", ondelete="CASCADE"), nullable=False)
    report_date: Mapped[date] = mapped_column(Date, default=date.today, nullable=False)
    summary: Mapped[str] = mapped_column(String(4000), nullable=False)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship(
        "Patient", 
        back_populates="progress_reports", 
        primaryjoin="ProgressReport.patient_id == Patient.patient_id"
    )
