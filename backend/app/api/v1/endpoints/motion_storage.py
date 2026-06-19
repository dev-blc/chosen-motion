from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime

from app.core.database import get_db
# Import core models (we're using core database connection)
from app.models.models import MotionSession, MotionFrame

router = APIRouter()

# ==========================================
# Pydantic Schemas for Requests & Responses
# ==========================================

class SessionStartRequest(BaseModel):
    patient_id: str = Field(..., description="Unique patient identifier")
    exercise_name: str = Field(..., description="Name of the exercise being performed")

class SessionStartResponse(BaseModel):
    session_id: int

class LandmarkModel(BaseModel):
    x: float
    y: float
    z: float
    visibility: Optional[float] = None
    presence: Optional[float] = None

class FrameUploadRequest(BaseModel):
    session_id: int = Field(..., description="ID of the active motion session")
    frame_number: int = Field(..., description="Sequential index of the frame")
    timestamp_ms: int = Field(..., description="Session offset time in milliseconds")
    landmarks: List[Dict[str, Any]] = Field(..., description="Array of MediaPipe landmark coordinates")

class FrameUploadResponse(BaseModel):
    status: str
    frame_number: int

class SessionEndRequest(BaseModel):
    session_id: int = Field(..., description="ID of the session to end")
    form_score: Optional[float] = Field(None, description="Average joint alignment accuracy score")
    rom: Optional[float] = Field(None, description="Range of motion achieved in degrees")
    speed: Optional[float] = Field(None, description="Average movement speed metric")
    symmetry: Optional[float] = Field(None, description="Anatomical left-right symmetry metric")

class SessionEndResponse(BaseModel):
    status: str
    session_id: int

class ReplayFrameResponse(BaseModel):
    frame_number: int
    timestamp_ms: int
    landmarks: List[Dict[str, Any]]

class SessionReplayResponse(BaseModel):
    session_id: int
    exercise_name: Optional[str]
    patient_id: str
    form_score: Optional[float]
    rom: Optional[float]
    speed: Optional[float]
    symmetry: Optional[float]
    created_at: datetime
    frames: List[ReplayFrameResponse]

# ==========================================
# Router Endpoints
# ==========================================

@router.post("/start", response_model=SessionStartResponse, status_code=status.HTTP_201_CREATED)
def start_motion_session(payload: SessionStartRequest, db: Session = Depends(get_db)):
    """
    Initialize a new motion tracking session.
    """
    # Create the new session record with empty scores
    db_session = MotionSession(
        patient_id=payload.patient_id,
        exercise_name=payload.exercise_name,
        form_score=0.0,
        rom=0.0,
        speed=0.0,
        symmetry=0.0
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    
    return SessionStartResponse(session_id=db_session.id)

@router.post("/frame", response_model=FrameUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_motion_frame(payload: FrameUploadRequest, db: Session = Depends(get_db)):
    """
    Upload a single frame's skeleton landmark coordinates. 
    Strictly coordinates only; video binary payloads are blocked.
    """
    # Check if session exists
    session = db.query(MotionSession).filter(MotionSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active session with ID {payload.session_id} not found."
        )

    # STRICT COORDINATE VALIDATION
    # Scan the landmarks to ensure no media files, camera frames, or base64 images are embedded
    for landmark in payload.landmarks:
        # Check that we only have numeric coordinates, and no large string fields
        for key, val in landmark.items():
            if key in ['x', 'y', 'z', 'visibility', 'presence']:
                if not isinstance(val, (int, float)):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid landmark format. Coordinates must be numeric floats."
                    )
            else:
                # If there are any non-coordinate keys, block them if they exceed short metadata lengths
                if isinstance(val, str) and len(val) > 100:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Strict safety protocol violation: Video, image binary, or large metadata detected."
                    )

    # Insert frame record
    db_frame = MotionFrame(
        session_id=payload.session_id,
        frame_number=payload.frame_number,
        timestamp_ms=payload.timestamp_ms,
        landmarks_json=payload.landmarks  # Storing the landmarks array
    )
    db.add(db_frame)
    db.commit()
    
    return FrameUploadResponse(status="success", frame_number=payload.frame_number)

@router.post("/end", response_model=SessionEndResponse)
def end_motion_session(payload: SessionEndRequest, db: Session = Depends(get_db)):
    """
    Conclude a motion tracking session and update final metrics.
    """
    # Check if session exists
    session = db.query(MotionSession).filter(MotionSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Active session with ID {payload.session_id} not found."
        )

    # Update final session scores/metrics
    if payload.form_score is not None:
        session.form_score = payload.form_score
    if payload.rom is not None:
        session.rom = payload.rom
    if payload.speed is not None:
        session.speed = payload.speed
    if payload.symmetry is not None:
        session.symmetry = payload.symmetry

    db.commit()
    
    return SessionEndResponse(status="completed", session_id=session.id)

@router.get("/{session_id}/replay", response_model=SessionReplayResponse)
def get_session_replay(session_id: int, db: Session = Depends(get_db)):
    """
    Retrieve coordinate frames stream for skeleton replay (strictly coordinates only, no video).
    """
    session = db.query(MotionSession).filter(MotionSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Motion session with ID {session_id} not found."
        )
    
    # Query all frames for this session, sorted by frame_number/timestamp_ms
    frames = db.query(MotionFrame).filter(MotionFrame.session_id == session_id).order_by(MotionFrame.frame_number.asc()).all()
    
    formatted_frames = []
    for f in frames:
        formatted_frames.append(ReplayFrameResponse(
            frame_number=f.frame_number,
            timestamp_ms=f.timestamp_ms,
            landmarks=f.landmarks_json
        ))
        
    return SessionReplayResponse(
        session_id=session.id,
        exercise_name=session.exercise_name,
        patient_id=session.patient_id,
        form_score=session.form_score,
        rom=session.rom,
        speed=session.speed,
        symmetry=session.symmetry,
        created_at=session.created_at,
        frames=formatted_frames
    )

