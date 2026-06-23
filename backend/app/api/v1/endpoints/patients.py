import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user, require_patient, UserPayload
from app.models.models import Patient, MotionSession as DbSession, MotionMetric, ExerciseAssignment, Exercise, MotionFrame
from app.schemas.schemas import (
    PatientResponse, 
    PatientUpdate, 
    SessionResponse, 
    SessionCreate, 
    SessionDetailResponse,
    ExerciseAssignmentResponse
)

router = APIRouter()

def get_user_uuid(user_id: str):
    try:
        return uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return user_id

@router.get("/profile", response_model=PatientResponse)
def get_patient_profile(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Get the current patient's clinical profile.
    """
    patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
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
    patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found."
        )
    
    if profile_data.full_name is not None:
        patient.full_name = profile_data.full_name
    if profile_data.phone is not None:
        patient.phone = profile_data.phone
    if profile_data.gender is not None:
        patient.gender = profile_data.gender
    if profile_data.date_of_birth is not None:
        patient.date_of_birth = profile_data.date_of_birth
    if profile_data.diagnosis is not None:
        patient.diagnosis = profile_data.diagnosis
    if profile_data.assigned_admin_id is not None:
        patient.assigned_admin_id = profile_data.assigned_admin_id

    db.commit()
    db.refresh(patient)
    return patient

@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient_by_id(
    patient_id: str,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get clinical profile for any patient by their formatted patient_id.
    """
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found."
        )
    
    # Restrict: Patient can only view their own profile, Clinician/Admin can view all
    if current_user.role.lower() != "admin" and str(patient.auth_user_id) != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. You do not have permission to view this profile."
        )
        
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
    patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient record not found. Please sync your account."
        )

    # Resolve exercise_id and rules by matching exercise title if possible
    exercise_id = None
    rules = []
    exercise = None
    if session_data.title:
        # Check if title includes date or exercise name
        # Simple match by name
        ex_name = session_data.title.split(" - ")[0] if " - " in session_data.title else session_data.title
        exercise = db.query(Exercise).filter(Exercise.name == ex_name).first()
        if exercise:
            exercise_id = exercise.id
            rules = exercise.rules

    # Extract ROM and other metrics first to evaluate rules
    rom = session_data.range_of_motion or (session_data.metrics_summary.get("rom") if session_data.metrics_summary else 0.0) or 0.0
    speed = session_data.speed or (session_data.metrics_summary.get("speed") if session_data.metrics_summary else 0.0) or 0.0
    symmetry = session_data.symmetry or (session_data.metrics_summary.get("symmetry") if session_data.metrics_summary else 0.0) or 0.0

    # Extended metrics defaults
    accuracy_score = session_data.avg_score or 100.0
    smoothness = 100.0
    repetitions = (session_data.metrics_summary.get("repetitions") if session_data.metrics_summary else 0) or 0
    detected_errors = {"errors": []}
    max_rom_val = rom

    # Compute extended metrics if telemetry data is provided
    if session_data.telemetry_data:
        from app.services.error_detection import analyze_session_frames
        target_rom_val = exercise.target_rom if (exercise and exercise.target_rom) else None
        ex_name = exercise.name if exercise else (session_data.title or "")
        
        analysis = analyze_session_frames(
            session_data.telemetry_data, 
            target_rom=target_rom_val, 
            exercise_name=ex_name
        )
        accuracy_score = analysis["accuracy_score"]
        smoothness = analysis["smoothness"]
        repetitions = analysis["repetitions"] or repetitions
        detected_errors = {"errors": analysis["detected_errors"]}
        max_rom_val = analysis["max_rom"]
        rom = max_rom_val

    from app.services.rules_engine import evaluate_session_rules
    session_status = evaluate_session_rules(rules, rom, speed, symmetry)

    # Create the session database record
    db_session = DbSession(
        patient_id=patient.patient_id,
        exercise_id=exercise_id,
        score=accuracy_score,
        duration_seconds=session_data.duration_seconds,
        status=session_status
    )
    db.add(db_session)
    db.flush()  # Retrieve session id

    # Save frames to database
    if session_data.telemetry_data:
        for idx, frame in enumerate(session_data.telemetry_data):
            db_frame = MotionFrame(
                patient_id=patient.patient_id,
                session_id=db_session.id,
                frame_number=idx,
                timestamp_millis=frame.get("timestamp_millis") or 0,
                joint_coordinates=frame.get("joint_coordinates") or {},
                sensor_signals=frame.get("sensor_signals")
            )
            db.add(db_frame)

    db_metric = MotionMetric(
        session_id=db_session.id,
        patient_id=patient.patient_id,
        rom=rom,
        speed=speed,
        symmetry=symmetry,
        smoothness=smoothness,
        repetitions=repetitions,
        accuracy_score=accuracy_score,
        detected_errors=detected_errors,
        max_rom=max_rom_val
    )
    db.add(db_metric)

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
    patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
    if not patient:
        return []
    
    sessions = db.query(DbSession).filter(DbSession.patient_id == patient.patient_id).order_by(DbSession.completed_at.desc()).all()
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
    patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found."
        )

    session = db.query(DbSession).filter(
        DbSession.id == session_id,
        DbSession.patient_id == patient.patient_id
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
    patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
    if not patient:
        return []

    assignments = db.query(ExerciseAssignment).filter(
        ExerciseAssignment.patient_id == patient.patient_id
    ).order_by(ExerciseAssignment.assigned_at.desc()).all()
    return assignments
