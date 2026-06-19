from datetime import datetime, date
from typing import List, Optional
from sqlalchemy import String, ForeignKey, DateTime, JSON, Float, Integer, Boolean, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="patient", nullable=False) # 'admin' or 'patient'
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient_profile: Mapped[Optional["Patient"]] = relationship(
        "Patient", 
        back_populates="user", 
        uselist=False, 
        cascade="all, delete-orphan"
    )
    assignments_created: Mapped[List["ExerciseAssignment"]] = relationship(
        "ExerciseAssignment", 
        back_populates="assigner"
    )


class Patient(Base):
    __tablename__ = "patients"

    user_id: Mapped[str] = mapped_column(String(255), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="patient_profile")
    consents: Mapped[List["Consent"]] = relationship("Consent", back_populates="patient", cascade="all, delete-orphan")
    assignments: Mapped[List["ExerciseAssignment"]] = relationship("ExerciseAssignment", back_populates="patient", cascade="all, delete-orphan")
    sessions: Mapped[List["MotionSession"]] = relationship("MotionSession", back_populates="patient", cascade="all, delete-orphan")


class Consent(Base):
    __tablename__ = "consents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(255), ForeignKey("patients.user_id", ondelete="CASCADE"), nullable=False)
    consent_level: Mapped[str] = mapped_column(String(100), nullable=False)
    granted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="consents")


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
    patient_id: Mapped[str] = mapped_column(String(255), ForeignKey("patients.user_id", ondelete="CASCADE"), nullable=False)
    exercise_id: Mapped[int] = mapped_column(Integer, ForeignKey("exercises.id", ondelete="CASCADE"), nullable=False)
    assigned_by: Mapped[Optional[str]] = mapped_column(String(255), ForeignKey("users.id", ondelete="SET NULL"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="assignments")
    exercise: Mapped["Exercise"] = relationship("Exercise", back_populates="assignments")
    assigner: Mapped[Optional["User"]] = relationship("User", back_populates="assignments_created")


class MotionSession(Base):
    __tablename__ = "motion_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    patient_id: Mapped[str] = mapped_column(String(255), ForeignKey("patients.user_id", ondelete="CASCADE"), nullable=False)
    exercise_name: Mapped[Optional[str]] = mapped_column(String(255))
    form_score: Mapped[Optional[float]] = mapped_column(Float)
    rom: Mapped[Optional[float]] = mapped_column(Float)
    speed: Mapped[Optional[float]] = mapped_column(Float)
    symmetry: Mapped[Optional[float]] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    patient: Mapped["Patient"] = relationship("Patient", back_populates="sessions")
    frames: Mapped[List["MotionFrame"]] = relationship("MotionFrame", back_populates="session", cascade="all, delete-orphan")

    @property
    def title(self) -> str:
        return self.exercise_name or "Motion Tracking Session"

    @property
    def description(self) -> str:
        return f"Movement session for {self.exercise_name or 'exercise'}"

    @property
    def avg_score(self) -> float:
        return self.form_score if self.form_score is not None else 0.0

    @property
    def range_of_motion(self) -> float:
        return self.rom if self.rom is not None else 0.0

    @property
    def metrics_summary(self) -> dict:
        return {
            "rom": self.rom or 0.0,
            "speed": self.speed or 0.0,
            "symmetry": self.symmetry or 0.0
        }

    @property
    def duration_seconds(self) -> int:
        if self.frames and len(self.frames) > 1:
            start_t = self.frames[0].timestamp_ms
            end_t = self.frames[-1].timestamp_ms
            return max(int((end_t - start_t) / 1000), 0)
        return 180  # Default fallback

    @property
    def telemetry_data(self) -> list:
        mapped_frames = []
        for idx, frame in enumerate(self.frames):
            mapped_frames.append({
                "id": frame.id or (idx + 1),
                "session_id": self.id,
                "timestamp_millis": frame.timestamp_ms,
                "joint_coordinates": frame.landmarks_json,
                "sensor_signals": None
            })
        return mapped_frames


class MotionFrame(Base):
    __tablename__ = "motion_frames"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("motion_sessions.id", ondelete="CASCADE"), nullable=False)
    frame_number: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    landmarks_json: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Relationships
    session: Mapped["MotionSession"] = relationship("MotionSession", back_populates="frames")


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
