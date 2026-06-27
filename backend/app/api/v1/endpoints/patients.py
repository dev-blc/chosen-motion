from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, require_patient, UserPayload
from app.models.models import (
    Patient,
    MotionSession as DbSession,
    MotionMetric,
    ExerciseAssignment,
    Exercise,
    MotionFrame,
    SessionEnvironment,
    PatientExerciseRecord,
)
from app.services.query_helpers import session_load_options, assignment_load_options
from app.services.patient_resolver import get_patient_for_user, resolve_patient_for_user
from app.services.prescription_service import build_prescription
from app.services.record_service import update_records_for_session
from app.schemas.schemas import (
    PatientResponse,
    PatientUpdate,
    SessionResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionUploadResponse,
    ExerciseAssignmentResponse,
    PrescriptionResponse,
    PatientExerciseRecordResponse,
)

router = APIRouter()


@router.get("/profile", response_model=PatientResponse)
def get_patient_profile(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    return get_patient_for_user(current_user, db)


@router.put("/profile", response_model=PatientResponse)
def update_patient_profile(
    profile_data: PatientUpdate,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    patient = get_patient_for_user(current_user, db)

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


@router.get("/sessions", response_model=List[SessionResponse])
def list_my_sessions(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    patient = resolve_patient_for_user(current_user, db)
    if not patient:
        return []

    sessions = (
        db.query(DbSession)
        .filter(DbSession.patient_id == patient.patient_id)
        .options(*session_load_options())
        .order_by(DbSession.completed_at.desc())
        .all()
    )
    return sessions


@router.post("/sessions", response_model=SessionUploadResponse, status_code=status.HTTP_201_CREATED)
def upload_motion_session(
    session_data: SessionCreate,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    patient = get_patient_for_user(current_user, db)

    exercise_id = session_data.exercise_id
    assignment_id = session_data.assignment_id
    rules = []
    exercise = None
    assignment = None

    if assignment_id:
        assignment = (
            db.query(ExerciseAssignment)
            .filter(
                ExerciseAssignment.id == assignment_id,
                ExerciseAssignment.patient_id == patient.patient_id,
            )
            .options(*assignment_load_options())
            .first()
        )
        if assignment:
            exercise = assignment.exercise
            exercise_id = exercise.id if exercise else exercise_id
            rules = exercise.rules if exercise else []

    if not exercise_id and session_data.title:
        ex_name = session_data.title.split(" - ")[0] if " - " in session_data.title else session_data.title
        exercise = db.query(Exercise).filter(Exercise.name == ex_name).first()
        if exercise:
            exercise_id = exercise.id
            rules = exercise.rules

    if not rules and exercise:
        rules = exercise.rules

    rom = session_data.range_of_motion or (session_data.metrics_summary.get("rom") if session_data.metrics_summary else 0.0) or 0.0
    speed = session_data.speed or (session_data.metrics_summary.get("speed") if session_data.metrics_summary else 0.0) or 0.0
    symmetry = session_data.symmetry or (session_data.metrics_summary.get("symmetry") if session_data.metrics_summary else 0.0) or 0.0

    accuracy_score = session_data.avg_score or 100.0
    smoothness = 100.0
    repetitions = (session_data.metrics_summary.get("repetitions") if session_data.metrics_summary else 0) or 0
    detected_errors = {"errors": []}
    max_rom_val = rom

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

    db_session = DbSession(
        patient_id=patient.patient_id,
        exercise_id=exercise_id,
        assignment_id=assignment_id,
        capture_config_snapshot=session_data.capture_config_snapshot,
        score=accuracy_score,
        duration_seconds=session_data.duration_seconds,
        status=session_status
    )
    db.add(db_session)
    db.flush()

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

    if session_data.environment:
        env = SessionEnvironment(
            session_id=db_session.id,
            declared_components={"components": session_data.environment.declared_components or []},
            noise_level=session_data.environment.noise_level,
            mirror_present=session_data.environment.mirror_present,
            other_users_present=session_data.environment.other_users_present,
        )
        db.add(env)

    if assignment:
        assignment.is_completed = True

    db.commit()
    db.refresh(db_session)

    is_new_best, _ = update_records_for_session(db, db_session)
    db.commit()

    response = SessionUploadResponse.model_validate(db_session)
    response.is_new_personal_best = is_new_best
    response.assignment_id = assignment_id
    return response


@router.get("/sessions/{session_id}", response_model=SessionDetailResponse)
def get_session_detail(
    session_id: int,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    patient = get_patient_for_user(current_user, db)

    session = (
        db.query(DbSession)
        .filter(
            DbSession.id == session_id,
            DbSession.patient_id == patient.patient_id
        )
        .options(*session_load_options())
        .first()
    )
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
    patient = resolve_patient_for_user(current_user, db)
    if not patient:
        return []

    assignments = (
        db.query(ExerciseAssignment)
        .filter(ExerciseAssignment.patient_id == patient.patient_id)
        .options(*assignment_load_options())
        .order_by(ExerciseAssignment.assigned_at.desc())
        .all()
    )
    return assignments


@router.get("/assignments/{assignment_id}/prescription", response_model=PrescriptionResponse)
def get_assignment_prescription(
    assignment_id: int,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    patient = get_patient_for_user(current_user, db)
    assignment = (
        db.query(ExerciseAssignment)
        .filter(
            ExerciseAssignment.id == assignment_id,
            ExerciseAssignment.patient_id == patient.patient_id,
        )
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found.")
    prescription = build_prescription(db, assignment_id)
    if not prescription:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prescription not available.")
    return prescription


@router.get("/records", response_model=List[PatientExerciseRecordResponse])
def list_my_records(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    patient = get_patient_for_user(current_user, db)
    records = (
        db.query(PatientExerciseRecord)
        .filter(PatientExerciseRecord.patient_id == patient.patient_id)
        .all()
    )
    return records


@router.get("/records/{exercise_id}", response_model=PatientExerciseRecordResponse)
def get_exercise_record(
    exercise_id: int,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    patient = get_patient_for_user(current_user, db)
    record = (
        db.query(PatientExerciseRecord)
        .filter(
            PatientExerciseRecord.patient_id == patient.patient_id,
            PatientExerciseRecord.exercise_id == exercise_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No records for this exercise yet.")
    return record


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient_by_id(
    patient_id: str,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found."
        )

    if current_user.role.lower() != "admin":
        own_patient = resolve_patient_for_user(current_user, db, link_auth=False)
        if not own_patient or own_patient.patient_id != patient.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view this profile."
            )

    return patient
