import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from app.core.database import get_db
from app.core.security import require_admin, UserPayload
from app.models.models import Patient, MotionSession as DbSession, User, Consent, ExerciseAssignment, Exercise
from app.schemas.schemas import (
    PatientResponse, 
    DashboardStats, 
    SessionDetailResponse,
    PatientCreateAdmin, 
    PatientUpdateAdmin, 
    PatientDetailFullResponse, 
    MessageResponse,
    ExerciseResponse,
    ExerciseCreateAdmin,
    ExerciseUpdateAdmin
)

router = APIRouter()

@router.get("/dashboard-stats", response_model=DashboardStats)
def get_dashboard_statistics(
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Get aggregated dashboard telemetry statistics across active patients.
    """
    total_patients = db.query(Patient).filter(Patient.is_archived == False).count()
    total_sessions = db.query(DbSession).join(Patient).filter(Patient.is_archived == False).count()
    
    # Calculate averages
    avg_duration = db.query(func.avg(DbSession.duration_seconds)).join(Patient).filter(Patient.is_archived == False).scalar() or 0.0
    avg_score = db.query(func.avg(DbSession.avg_score)).join(Patient).filter(Patient.is_archived == False).scalar() or 0.0

    # Get recent sessions across active patients
    recent_sessions = db.query(DbSession).join(Patient).filter(Patient.is_archived == False).order_by(DbSession.created_at.desc()).limit(5).all()

    return DashboardStats(
        total_patients=total_patients,
        total_sessions=total_sessions,
        average_duration_seconds=float(avg_duration),
        average_session_score=float(avg_score),
        recent_activity=recent_sessions
    )

@router.get("/patients", response_model=List[PatientResponse])
def list_patients(
    search: Optional[str] = None,
    include_archived: bool = False,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    List and search patients registered in the clinic system.
    Supports filtering by active/archived status and query search.
    """
    query = db.query(Patient).join(User)
    
    if not include_archived:
        query = query.filter(Patient.is_archived == False)
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Patient.full_name.ilike(search_filter),
                User.email.ilike(search_filter),
                Patient.diagnosis.ilike(search_filter)
            )
        )
        
    return query.all()

@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
def create_patient(
    patient_data: PatientCreateAdmin,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new patient user profile, sync record in User table, 
    and initialize consent levels.
    """
    # Check if email is already taken
    existing_user = db.query(User).filter(User.email == patient_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    # 1. Create User Identity
    generated_uuid = f"admin-gen-{uuid.uuid4()}"
    name_parts = patient_data.full_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    new_user = User(
        id=generated_uuid,
        email=patient_data.email,
        role="patient",
        first_name=first_name,
        last_name=last_name
    )
    db.add(new_user)
    db.flush()

    # 2. Create Patient Profile
    new_patient = Patient(
        user_id=new_user.id,
        full_name=patient_data.full_name,
        date_of_birth=patient_data.date_of_birth,
        phone=patient_data.phone,
        diagnosis=patient_data.diagnosis,
        is_archived=False
    )
    db.add(new_patient)
    db.flush()

    # 3. Create Consent record
    if patient_data.consent_level:
        new_consent = Consent(
            patient_id=new_patient.user_id,
            consent_level=patient_data.consent_level
        )
        db.add(new_consent)

    db.commit()
    db.refresh(new_patient)
    return new_patient

@router.get("/patients/{patient_id}/profile", response_model=PatientDetailFullResponse)
def get_patient_profile(
    patient_id: str,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Fetch comprehensive profile history for a patient including personal details,
    consent settings, assigned programs, and tracking metrics logs.
    """
    patient = db.query(Patient).filter(Patient.user_id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found."
        )
        
    user = db.query(User).filter(User.id == patient_id).first()
    
    # Retrieve relations
    consents = db.query(Consent).filter(Consent.patient_id == patient_id).all()
    assignments = db.query(ExerciseAssignment).filter(ExerciseAssignment.patient_id == patient_id).all()
    sessions = db.query(DbSession).filter(DbSession.patient_id == patient_id).order_by(DbSession.created_at.desc()).all()

    return PatientDetailFullResponse(
        user_id=patient.user_id,
        email=user.email if user else "",
        full_name=patient.full_name,
        date_of_birth=patient.date_of_birth,
        phone=patient.phone,
        diagnosis=patient.diagnosis,
        is_archived=patient.is_archived,
        consents=consents,
        assignments=assignments,
        sessions=sessions
    )

@router.put("/patients/{patient_id}", response_model=PatientResponse)
def edit_patient(
    patient_id: str,
    update_data: PatientUpdateAdmin,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update patient personal details, rehab diagnosis, or archive status.
    """
    patient = db.query(Patient).filter(Patient.user_id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found."
        )
        
    if update_data.full_name is not None:
        patient.full_name = update_data.full_name
        # Also update User first/last name if user exists
        user = db.query(User).filter(User.id == patient_id).first()
        if user:
            name_parts = update_data.full_name.split(" ", 1)
            user.first_name = name_parts[0]
            user.last_name = name_parts[1] if len(name_parts) > 1 else ""
            
    if update_data.date_of_birth is not None:
        patient.date_of_birth = update_data.date_of_birth
    if update_data.phone is not None:
        patient.phone = update_data.phone
    if update_data.diagnosis is not None:
        patient.diagnosis = update_data.diagnosis
    if update_data.is_archived is not None:
        patient.is_archived = update_data.is_archived

    db.commit()
    db.refresh(patient)
    return patient

@router.delete("/patients/{patient_id}", response_model=MessageResponse)
def archive_patient(
    patient_id: str,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Soft-delete/Archive a patient from the active roster.
    """
    patient = db.query(Patient).filter(Patient.user_id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found."
        )
    
    patient.is_archived = True
    db.commit()
    return MessageResponse(message=f"Patient {patient.full_name} has been archived successfully.")

@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def get_any_session_detail(
    session_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Access coordinates and metrics for any tracking session across the workspace.
    """
    session = db.query(DbSession).filter(DbSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session recording not found."
        )
    return session

# ==========================================
# Exercise Catalog CRUD Endpoints
# ==========================================

@router.get("/exercises", response_model=List[ExerciseResponse])
def list_exercises(
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    List all exercises in the library.
    """
    return db.query(Exercise).all()

@router.post("/exercises", response_model=ExerciseResponse, status_code=status.HTTP_201_CREATED)
def create_exercise_endpoint(
    exercise_data: ExerciseCreateAdmin,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new exercise template in the library.
    """
    new_exercise = Exercise(
        name=exercise_data.name,
        description=exercise_data.description,
        instructions=exercise_data.instructions,
        target_rom=exercise_data.target_rom,
        thumbnail_url=exercise_data.thumbnail_url,
        target_joints=exercise_data.target_joints
    )
    db.add(new_exercise)
    db.commit()
    db.refresh(new_exercise)
    return new_exercise

@router.put("/exercises/{exercise_id}", response_model=ExerciseResponse)
def edit_exercise_endpoint(
    exercise_id: int,
    update_data: ExerciseUpdateAdmin,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update an exercise template's instructions, descriptions, or target limits.
    """
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found in catalog."
        )

    if update_data.name is not None:
        exercise.name = update_data.name
    if update_data.description is not None:
        exercise.description = update_data.description
    if update_data.instructions is not None:
        exercise.instructions = update_data.instructions
    if update_data.target_rom is not None:
        exercise.target_rom = update_data.target_rom
    if update_data.thumbnail_url is not None:
        exercise.thumbnail_url = update_data.thumbnail_url
    if update_data.target_joints is not None:
        exercise.target_joints = update_data.target_joints

    db.commit()
    db.refresh(exercise)
    return exercise

@router.delete("/exercises/{exercise_id}", response_model=MessageResponse)
def delete_exercise_endpoint(
    exercise_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete an exercise template from the library catalog.
    """
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found in catalog."
        )

    db.delete(exercise)
    db.commit()
    return MessageResponse(message=f"Exercise '{exercise.name}' has been successfully deleted.")
