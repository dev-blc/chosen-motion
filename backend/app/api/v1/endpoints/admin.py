import uuid
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List, Optional
from app.core.database import get_db
from app.core.security import require_admin, UserPayload
from app.core.config import settings
from app.models.models import Patient, MotionSession as DbSession, User, Consent, ExerciseAssignment, Exercise, ExerciseRule, PatientLimitation, EnvironmentComponent, SessionFrameAnnotation, ExerciseEnvironmentRequirement, ProgressReport
from app.api.v1.endpoints.auth import generate_patient_id, get_supabase_auth_url
from app.services.query_helpers import session_load_options, assignment_load_options
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
    ExerciseUpdateAdmin,
    SessionResponse,
    ExerciseAssignmentCreate,
    ExerciseAssignmentUpdate,
    ExerciseAssignmentResponse,
    ExerciseRuleCreate,
    ExerciseRuleUpdate,
    ExerciseRuleResponse,
    PatientLimitationCreate,
    PatientLimitationUpdate,
    PatientLimitationResponse,
    EnvironmentComponentCreate,
    EnvironmentComponentResponse,
    SessionFrameAnnotationCreate,
    SessionFrameAnnotationUpdate,
    SessionFrameAnnotationResponse,
    ExerciseEnvironmentRequirementCreate,
    ExerciseEnvironmentRequirementResponse,
    ClinicAnalyticsResponse,
    PatientAnalyticsResponse,
    ProgressReportResponse,
    BackfillRecordsResponse,
)

router = APIRouter()

def find_patient_robust(patient_id: str, db: Session) -> Optional[Patient]:
    patient = None
    try:
        uuid_val = uuid.UUID(patient_id)
        patient = db.query(Patient).filter((Patient.id == uuid_val) | (Patient.auth_user_id == uuid_val)).first()
    except ValueError:
        pass
    if not patient:
        patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    return patient

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
    avg_score = db.query(func.avg(DbSession.score)).join(Patient).filter(Patient.is_archived == False).scalar() or 0.0

    # Get recent sessions across active patients
    recent_sessions = (
        db.query(DbSession)
        .join(Patient)
        .filter(Patient.is_archived == False)
        .options(*session_load_options())
        .order_by(DbSession.completed_at.desc())
        .limit(5)
        .all()
    )

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
    query = db.query(Patient)
    
    if not include_archived:
        query = query.filter(Patient.is_archived == False)
        
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            or_(
                Patient.full_name.ilike(search_filter),
                Patient.email.ilike(search_filter),
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

    # Try to register user in Supabase Auth to get a real auth_user_id
    auth_user_id = None
    temp_password = f"TempPass{uuid.uuid4().hex[:8]}!"
    if settings.SUPABASE_ANON_KEY:
        try:
            auth_url = get_supabase_auth_url()
            headers = {
                "apikey": settings.SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            }
            payload = {
                "email": patient_data.email,
                "password": temp_password,
                "options": {
                    "data": {
                        "role": "patient",
                        "full_name": patient_data.full_name
                    }
                }
            }
            resp = requests.post(f"{auth_url}/signup", json=payload, headers=headers)
            if resp.status_code in (200, 201):
                resp_data = resp.json()
                user_data = resp_data.get("user")
                if user_data:
                    auth_user_id = uuid.UUID(user_data.get("id"))
        except Exception:
            pass

    # Fallback to random UUID if offline/failed
    if not auth_user_id:
        auth_user_id = uuid.uuid4()

    # 1. Create User Identity
    new_user = User(
        id=uuid.uuid4(),
        auth_user_id=auth_user_id,
        email=patient_data.email,
        role="patient"
    )
    db.add(new_user)
    db.flush()

    # 2. Create Patient Profile
    patient_id = generate_patient_id(db)
    new_patient = Patient(
        id=uuid.uuid4(),
        patient_id=patient_id,
        auth_user_id=auth_user_id,
        email=patient_data.email,
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
            patient_id=patient_id,
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
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found."
        )
        
    # Retrieve relations
    consents = db.query(Consent).filter(Consent.patient_id == patient.patient_id).all()
    assignments = (
        db.query(ExerciseAssignment)
        .filter(ExerciseAssignment.patient_id == patient.patient_id)
        .options(*assignment_load_options())
        .all()
    )
    sessions = (
        db.query(DbSession)
        .filter(DbSession.patient_id == patient.patient_id)
        .options(*session_load_options())
        .order_by(DbSession.completed_at.desc())
        .all()
    )

    return PatientDetailFullResponse(
        patient_id=patient.patient_id,
        user_id=str(patient.auth_user_id),
        email=patient.email,
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
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found."
        )
        
    if update_data.full_name is not None:
        patient.full_name = update_data.full_name
            
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

# ==========================================
# Exercise Assignment Endpoints
# ==========================================

@router.post(
    "/patients/{patient_id}/assignments",
    response_model=ExerciseAssignmentResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_exercise_to_patient(
    patient_id: str,
    assignment_data: ExerciseAssignmentCreate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Assign an exercise from the catalog to a patient.
    """
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        )

    exercise = db.query(Exercise).filter(Exercise.id == assignment_data.exercise_id).first()
    if not exercise:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Exercise not found in catalog.",
        )

    existing = (
        db.query(ExerciseAssignment)
        .filter(
            ExerciseAssignment.patient_id == patient.patient_id,
            ExerciseAssignment.exercise_id == assignment_data.exercise_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exercise '{exercise.name}' is already assigned to this patient.",
        )

    new_assignment = ExerciseAssignment(
        patient_id=patient.patient_id,
        exercise_id=assignment_data.exercise_id,
        assigned_by=current_user.email,
        due_date=assignment_data.due_date,
        is_completed=False,
        config=assignment_data.config,
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)

    assignment = (
        db.query(ExerciseAssignment)
        .filter(ExerciseAssignment.id == new_assignment.id)
        .options(*assignment_load_options())
        .first()
    )
    return assignment


@router.delete(
    "/patients/{patient_id}/assignments/{assignment_id}",
    response_model=MessageResponse,
)
def remove_exercise_assignment(
    patient_id: str,
    assignment_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Remove an exercise assignment from a patient.
    """
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        )

    assignment = (
        db.query(ExerciseAssignment)
        .filter(
            ExerciseAssignment.id == assignment_id,
            ExerciseAssignment.patient_id == patient.patient_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found for this patient.",
        )

    exercise_name = assignment.exercise.name if assignment.exercise else "Exercise"
    db.delete(assignment)
    db.commit()
    return MessageResponse(
        message=f"Assignment for '{exercise_name}' has been removed from the patient."
    )


@router.put(
    "/patients/{patient_id}/assignments/{assignment_id}",
    response_model=ExerciseAssignmentResponse,
)
def update_exercise_assignment(
    patient_id: str,
    assignment_id: int,
    update_data: ExerciseAssignmentUpdate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Update an exercise assignment (due date or completion status).
    """
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found.",
        )

    assignment = (
        db.query(ExerciseAssignment)
        .filter(
            ExerciseAssignment.id == assignment_id,
            ExerciseAssignment.patient_id == patient.patient_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found for this patient.",
        )

    if update_data.due_date is not None:
        assignment.due_date = update_data.due_date
    if update_data.is_completed is not None:
        assignment.is_completed = update_data.is_completed
    if update_data.config is not None:
        assignment.config = update_data.config

    db.commit()
    db.refresh(assignment)

    assignment = (
        db.query(ExerciseAssignment)
        .filter(ExerciseAssignment.id == assignment.id)
        .options(*assignment_load_options())
        .first()
    )
    return assignment


@router.delete("/patients/{patient_id}", response_model=MessageResponse)
def archive_patient(
    patient_id: str,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Soft-delete/Archive a patient from the active roster.
    """
    patient = find_patient_robust(patient_id, db)
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
    session = (
        db.query(DbSession)
        .filter(DbSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
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
        target_joints=exercise_data.target_joints,
        capture_config=exercise_data.capture_config,
        metric_definitions=exercise_data.metric_definitions,
        guide_content=exercise_data.guide_content,
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
    if update_data.capture_config is not None:
        exercise.capture_config = update_data.capture_config
    if update_data.metric_definitions is not None:
        exercise.metric_definitions = update_data.metric_definitions
    if update_data.guide_content is not None:
        exercise.guide_content = update_data.guide_content

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

@router.get("/sessions", response_model=List[SessionResponse])
def list_motion_sessions(
    patient_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    List workout session reports for the Motion Reports admin view.
    Optionally filter by patient_id. Returns sessions with exercise and metrics loaded.
    """
    query = (
        db.query(DbSession)
        .join(Patient)
        .filter(Patient.is_archived == False)
        .options(*session_load_options())
    )

    if patient_id:
        patient = find_patient_robust(patient_id, db)
        if not patient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Patient not found."
            )
        query = query.filter(DbSession.patient_id == patient.patient_id)

    sessions = (
        query
        .order_by(DbSession.completed_at.desc())
        .offset(max(offset, 0))
        .limit(min(max(limit, 1), 200))
        .all()
    )
    return sessions


# ==========================================
# Exercise Rules CRUD
# ==========================================

@router.post("/exercises/{exercise_id}/rules", response_model=ExerciseRuleResponse, status_code=status.HTTP_201_CREATED)
def create_exercise_rule(
    exercise_id: int,
    rule_data: ExerciseRuleCreate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found.")
    rule = ExerciseRule(
        exercise_id=exercise_id,
        rule_name=rule_data.rule_name,
        rule_type=rule_data.rule_type,
        parameters=rule_data.parameters,
        status_on_success=rule_data.status_on_success,
        status_on_fail=rule_data.status_on_fail,
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/exercises/{exercise_id}/rules/{rule_id}", response_model=ExerciseRuleResponse)
def update_exercise_rule(
    exercise_id: int,
    rule_id: int,
    rule_data: ExerciseRuleUpdate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rule = db.query(ExerciseRule).filter(ExerciseRule.id == rule_id, ExerciseRule.exercise_id == exercise_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")
    if rule_data.rule_name is not None:
        rule.rule_name = rule_data.rule_name
    if rule_data.rule_type is not None:
        rule.rule_type = rule_data.rule_type
    if rule_data.parameters is not None:
        rule.parameters = rule_data.parameters
    if rule_data.status_on_success is not None:
        rule.status_on_success = rule_data.status_on_success
    if rule_data.status_on_fail is not None:
        rule.status_on_fail = rule_data.status_on_fail
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/exercises/{exercise_id}/rules/{rule_id}", response_model=MessageResponse)
def delete_exercise_rule(
    exercise_id: int,
    rule_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    rule = db.query(ExerciseRule).filter(ExerciseRule.id == rule_id, ExerciseRule.exercise_id == exercise_id).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found.")
    db.delete(rule)
    db.commit()
    return MessageResponse(message="Exercise rule deleted.")


# ==========================================
# Patient Limitations CRUD
# ==========================================

@router.get("/patients/{patient_id}/limitations", response_model=List[PatientLimitationResponse])
def list_patient_limitations(
    patient_id: str,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    return db.query(PatientLimitation).filter(PatientLimitation.patient_id == patient.patient_id).all()


@router.post("/patients/{patient_id}/limitations", response_model=PatientLimitationResponse, status_code=status.HTTP_201_CREATED)
def create_patient_limitation(
    patient_id: str,
    data: PatientLimitationCreate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    limitation = PatientLimitation(
        patient_id=patient.patient_id,
        scope_type=data.scope_type,
        scope_id=data.scope_id,
        limitation_type=data.limitation_type,
        parameters=data.parameters,
        notes=data.notes,
        active=data.active,
        created_by=current_user.email,
    )
    db.add(limitation)
    db.commit()
    db.refresh(limitation)
    return limitation


@router.put("/patients/{patient_id}/limitations/{limitation_id}", response_model=PatientLimitationResponse)
def update_patient_limitation(
    patient_id: str,
    limitation_id: int,
    data: PatientLimitationUpdate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    limitation = db.query(PatientLimitation).filter(
        PatientLimitation.id == limitation_id,
        PatientLimitation.patient_id == patient.patient_id,
    ).first()
    if not limitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Limitation not found.")
    if data.scope_type is not None:
        limitation.scope_type = data.scope_type
    if data.scope_id is not None:
        limitation.scope_id = data.scope_id
    if data.limitation_type is not None:
        limitation.limitation_type = data.limitation_type
    if data.parameters is not None:
        limitation.parameters = data.parameters
    if data.notes is not None:
        limitation.notes = data.notes
    if data.active is not None:
        limitation.active = data.active
    db.commit()
    db.refresh(limitation)
    return limitation


@router.delete("/patients/{patient_id}/limitations/{limitation_id}", response_model=MessageResponse)
def delete_patient_limitation(
    patient_id: str,
    limitation_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    limitation = db.query(PatientLimitation).filter(
        PatientLimitation.id == limitation_id,
        PatientLimitation.patient_id == patient.patient_id,
    ).first()
    if not limitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Limitation not found.")
    db.delete(limitation)
    db.commit()
    return MessageResponse(message="Limitation removed.")


# ==========================================
# Session Frame Annotations (Clinician Notes)
# ==========================================

def _get_session_or_404(session_id: int, db: Session) -> DbSession:
    session = (
        db.query(DbSession)
        .filter(DbSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return session


@router.get("/sessions/{session_id}/frame-annotations", response_model=List[SessionFrameAnnotationResponse])
def list_session_frame_annotations(
    session_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _get_session_or_404(session_id, db)
    return (
        db.query(SessionFrameAnnotation)
        .filter(SessionFrameAnnotation.session_id == session_id)
        .order_by(SessionFrameAnnotation.frame_number.asc(), SessionFrameAnnotation.created_at.asc())
        .all()
    )


@router.post("/sessions/{session_id}/frame-annotations", response_model=SessionFrameAnnotationResponse, status_code=status.HTTP_201_CREATED)
def create_session_frame_annotation(
    session_id: int,
    data: SessionFrameAnnotationCreate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    session = _get_session_or_404(session_id, db)
    annotation = SessionFrameAnnotation(
        session_id=session.id,
        patient_id=session.patient_id,
        frame_number=data.frame_number,
        issue_tags=data.issue_tags or [],
        notes=data.notes,
        suggestions=data.suggestions,
        created_by=current_user.email,
        visible_to_patient=data.visible_to_patient,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return annotation


@router.put("/sessions/{session_id}/frame-annotations/{annotation_id}", response_model=SessionFrameAnnotationResponse)
def update_session_frame_annotation(
    session_id: int,
    annotation_id: int,
    data: SessionFrameAnnotationUpdate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _get_session_or_404(session_id, db)
    annotation = db.query(SessionFrameAnnotation).filter(
        SessionFrameAnnotation.id == annotation_id,
        SessionFrameAnnotation.session_id == session_id,
    ).first()
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found.")
    if data.frame_number is not None:
        annotation.frame_number = data.frame_number
    if data.issue_tags is not None:
        annotation.issue_tags = data.issue_tags
    if data.notes is not None:
        annotation.notes = data.notes
    if data.suggestions is not None:
        annotation.suggestions = data.suggestions
    if data.visible_to_patient is not None:
        annotation.visible_to_patient = data.visible_to_patient
    db.commit()
    db.refresh(annotation)
    return annotation


@router.delete("/sessions/{session_id}/frame-annotations/{annotation_id}", response_model=MessageResponse)
def delete_session_frame_annotation(
    session_id: int,
    annotation_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    _get_session_or_404(session_id, db)
    annotation = db.query(SessionFrameAnnotation).filter(
        SessionFrameAnnotation.id == annotation_id,
        SessionFrameAnnotation.session_id == session_id,
    ).first()
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found.")
    db.delete(annotation)
    db.commit()
    return MessageResponse(message="Frame annotation deleted.")


# ==========================================
# Environment Components CRUD
# ==========================================

@router.get("/environment-components", response_model=List[EnvironmentComponentResponse])
def list_environment_components(
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.services.environment_service import ensure_default_components
    ensure_default_components(db)
    db.commit()
    return db.query(EnvironmentComponent).order_by(EnvironmentComponent.name).all()


@router.get("/exercises/{exercise_id}/environment-requirements", response_model=List[ExerciseEnvironmentRequirementResponse])
def list_exercise_environment_requirements(
    exercise_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.services.environment_service import get_exercise_environment_requirements
    return get_exercise_environment_requirements(db, exercise_id)


@router.post("/exercises/{exercise_id}/environment-requirements", response_model=ExerciseEnvironmentRequirementResponse, status_code=status.HTTP_201_CREATED)
def add_exercise_environment_requirement(
    exercise_id: int,
    data: ExerciseEnvironmentRequirementCreate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    if not exercise:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercise not found.")
    component = db.query(EnvironmentComponent).filter(EnvironmentComponent.id == data.component_id).first()
    if not component:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Environment component not found.")
    existing = db.query(ExerciseEnvironmentRequirement).filter(
        ExerciseEnvironmentRequirement.exercise_id == exercise_id,
        ExerciseEnvironmentRequirement.component_id == data.component_id,
    ).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requirement already exists.")
    req = ExerciseEnvironmentRequirement(
        exercise_id=exercise_id,
        component_id=data.component_id,
        required=data.required,
        config=data.config,
    )
    db.add(req)
    db.commit()
    from app.services.environment_service import get_exercise_environment_requirements
    rows = get_exercise_environment_requirements(db, exercise_id)
    match = next((r for r in rows if r["component_id"] == data.component_id), None)
    return match or req


@router.delete("/exercises/{exercise_id}/environment-requirements/{requirement_id}", response_model=MessageResponse)
def remove_exercise_environment_requirement(
    exercise_id: int,
    requirement_id: int,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    req = db.query(ExerciseEnvironmentRequirement).filter(
        ExerciseEnvironmentRequirement.id == requirement_id,
        ExerciseEnvironmentRequirement.exercise_id == exercise_id,
    ).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Requirement not found.")
    db.delete(req)
    db.commit()
    return MessageResponse(message="Environment requirement removed.")


@router.get("/analytics/clinic", response_model=ClinicAnalyticsResponse)
def get_clinic_analytics(
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.services.analytics_service import get_clinic_analytics
    return get_clinic_analytics(db)


@router.get("/analytics/patient/{patient_id}", response_model=PatientAnalyticsResponse)
def get_patient_analytics(
    patient_id: str,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    from app.services.analytics_service import get_patient_analytics
    return get_patient_analytics(db, patient.patient_id)


@router.post("/patients/{patient_id}/progress-reports", response_model=ProgressReportResponse, status_code=status.HTTP_201_CREATED)
def create_progress_report(
    patient_id: str,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    from app.services.progress_report_service import generate_patient_progress_report
    report = generate_patient_progress_report(db, patient.patient_id)
    db.commit()
    db.refresh(report)
    return report


@router.get("/patients/{patient_id}/progress-reports", response_model=List[ProgressReportResponse])
def list_progress_reports(
    patient_id: str,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    patient = find_patient_robust(patient_id, db)
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
    return (
        db.query(ProgressReport)
        .filter(ProgressReport.patient_id == patient.patient_id)
        .order_by(ProgressReport.created_at.desc())
        .limit(20)
        .all()
    )


@router.post("/records/backfill", response_model=BackfillRecordsResponse)
def backfill_exercise_records(
    patient_id: Optional[str] = None,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    from app.services.backfill_service import backfill_patient_records
    if patient_id:
        patient = find_patient_robust(patient_id, db)
        if not patient:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found.")
        patient_id = patient.patient_id
    result = backfill_patient_records(db, patient_id)
    db.commit()
    return result


@router.post("/environment-components", response_model=EnvironmentComponentResponse, status_code=status.HTTP_201_CREATED)
def create_environment_component(
    data: EnvironmentComponentCreate,
    current_user: UserPayload = Depends(require_admin),
    db: Session = Depends(get_db),
):
    component = EnvironmentComponent(
        name=data.name,
        slug=data.slug,
        category=data.category,
        icon_url=data.icon_url,
        setup_instructions=data.setup_instructions,
        affects_tracking=data.affects_tracking,
    )
    db.add(component)
    db.commit()
    db.refresh(component)
    return component

