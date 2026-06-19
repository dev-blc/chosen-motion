from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class MotionSession(Base):
    __tablename__ = "motion_sessions"

    id = Column(Integer, primary_key=True)
    patient_id = Column(String, nullable=False)
    exercise_name = Column(String)
    form_score = Column(Float)
    rom = Column(Float)
    speed = Column(Float)
    symmetry = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationship to frames
    frames = relationship("MotionFrame", back_populates="session", cascade="all, delete-orphan")

class MotionFrame(Base):
    __tablename__ = "motion_frames"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("motion_sessions.id", ondelete="CASCADE"), nullable=False)
    frame_number = Column(Integer, nullable=False)
    timestamp_ms = Column(Integer, nullable=False)
    landmarks_json = Column(JSON, nullable=False)  # Raw MediaPipe landmarks array

    # Relationship back to session
    session = relationship("MotionSession", back_populates="frames")
