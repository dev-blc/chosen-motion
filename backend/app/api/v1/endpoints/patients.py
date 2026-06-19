from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import require_patient, UserPayload
from app.models.models import Patient, MotionSession as DbSession, MotionFrame, ExerciseAssignment, Exercise
from app.schemas.schemas import (
    PatientResponse, 
    PatientUpdate, 
    SessionResponse, 
    SessionCreate, 
    SessionDetailResponse,
    ExerciseAssignmentResponse
)

router = APIRouter()

@router.get("/profile", response_model=PatientResponse)
def get_patient_profile(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Get the current patient's clinical profile.
    """
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found."
        )
    return patient

@router.put("/profile", response_model=PatientResponse)
def update_patient_profile(
    profile_data: PatientUpdate,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Update the current patient's medical metadata.
    """
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found."
        )
    
    if profile_data.date_of_birth is not None:
        patient.date_of_birth = profile_data.date_of_birth
    if profile_data.diagnosis is not None:
        patient.diagnosis = profile_data.diagnosis
    if profile_data.assigned_admin_id is not None:
        patient.assigned_admin_id = profile_data.assigned_admin_id

    db.commit()
    db.refresh(patient)
    return patient

@router.post("/sessions", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def upload_motion_session(
    session_data: SessionCreate,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Upload a completed motion tracking session, complete with coordinate streams.
    """
    # Verify patient exists
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient record not found. Please sync your account."
        )

    # Resolve exercise rules by matching exercise title if possible
    rules = []
    if session_data.title:
        exercise = db.query(Exercise).filter(Exercise.name == session_data.title).first()
        if exercise:
            rules = exercise.rules

    # Extract ROM and other metrics first to evaluate rules
    rom = session_data.range_of_motion or (session_data.metrics_summary.get("rom") if session_data.metrics_summary else 0.0) or 0.0
    speed = (session_data.metrics_summary.get("speed") if session_data.metrics_summary else 0.0) or 0.0
    symmetry = (session_data.metrics_summary.get("symmetry") if session_data.metrics_summary else 0.0) or 0.0

    from app.services.rules_engine import evaluate_session_rules
    session_status = evaluate_session_rules(rules, rom, speed, symmetry)

    # Create the session database record
    db_session = DbSession(
        patient_id=current_user.id,
        exercise_name=session_data.title,
        form_score=session_data.avg_score,
        rom=rom,
        speed=speed,
        symmetry=symmetry
    )
    db.add(db_session)
    db.flush()  # Retrieve session id

    # Create individual frame records in motion_frames
    for idx, tele in enumerate(session_data.telemetry_data):
        db_frame = MotionFrame(
            session_id=db_session.id,
            frame_number=idx + 1,
            timestamp_ms=tele.timestamp_millis,
            landmarks_json=tele.joint_coordinates
        )
        db.add(db_frame)

    db.commit()
    db.refresh(db_session)
    return db_session

@router.get("/sessions", response_model=List[SessionResponse])
def list_my_sessions(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    List all motion tracking sessions recorded by the authenticated patient.
    """
    sessions = db.query(DbSession).filter(DbSession.patient_id == current_user.id).order_by(DbSession.created_at.desc()).all()
    return sessions

@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def get_session_detail(
    session_id: int,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Get detailed telemetry metrics and coordinates for a specific recording session.
    """
    session = db.query(DbSession).filter(
        DbSession.id == session_id,
        DbSession.patient_id == current_user.id
    ).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or permission denied."
        )
    return session

@router.get("/assignments", response_model=List[ExerciseAssignmentResponse])
def list_my_assignments(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    List all exercise assignments assigned to the authenticated patient.
    """
    assignments = db.query(ExerciseAssignment).filter(
        ExerciseAssignment.patient_id == current_user.id
    ).order_by(ExerciseAssignment.assigned_at.desc()).all()
    return assignments
