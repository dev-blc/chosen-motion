from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any, List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_patient, UserPayload
from app.models.models import Patient, MotionSession, MotionFrame, MotionMetric, Exercise
from app.services.exercise_engines import SquatEngine, EXERCISE_CONFIGS
from app.services.patient_resolver import get_patient_for_user, resolve_patient_for_user

router = APIRouter()

# Pydantic Schemas for Requests/Responses
class SquatStartResponse(BaseModel):
    session_id: int

class FrameSubmitRequest(BaseModel):
    session_id: int
    frame_number: int
    timestamp_ms: int
    joint_coordinates: Dict[str, Any]

class LiveFeedbackResponse(BaseModel):
    reps: int
    feedback: str
    status: str
    angles: Dict[str, float]
    detected_errors: List[Dict[str, Any]]
    current_error: Optional[Dict[str, Any]] = None

class SquatEndRequest(BaseModel):
    session_id: int

class SquatEndResponse(BaseModel):
    session_id: int
    status: str
    score: float
    duration_seconds: int
    repetitions: int
    accuracy_score: float

# Helper to verify session ownership
def verify_session_access(session_id: int, current_user: UserPayload, db: Session):
    session = db.query(MotionSession).filter(MotionSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    # Patient isolation check
    if current_user.role.lower() != "admin":
        patient = resolve_patient_for_user(current_user, db, link_auth=False)
        if not patient or patient.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not own this session."
            )
    return session

@router.post("/start", response_model=SquatStartResponse, status_code=status.HTTP_201_CREATED)
def start_squat_session(
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Initialize a new Squat exercise tracking session.
    """
    patient = get_patient_for_user(current_user, db)

    # Squat exercise is ID 5
    exercise = db.query(Exercise).filter(Exercise.name == "Squat").first()
    exercise_id = exercise.id if exercise else 5

    session = MotionSession(
        patient_id=patient.patient_id,
        exercise_id=exercise_id,
        status="started",
        score=0.0,
        duration_seconds=0
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return SquatStartResponse(session_id=session.id)

@router.post("/frame", response_model=LiveFeedbackResponse)
def submit_squat_frame(
    request_data: FrameSubmitRequest,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Process a single joint coordinate frame in real time, saving it and returning postural feedback.
    """
    session = verify_session_access(request_data.session_id, current_user, db)
    
    # Save the frame coordinate record
    db_frame = MotionFrame(
        patient_id=session.patient_id,
        session_id=session.id,
        frame_number=request_data.frame_number,
        timestamp_millis=request_data.timestamp_ms,
        joint_coordinates=request_data.joint_coordinates
    )
    db.add(db_frame)
    db.commit()

    # Fetch all frames of the session to feed to the state machine
    frames = (
        db.query(MotionFrame)
        .filter(MotionFrame.session_id == session.id)
        .order_by(MotionFrame.frame_number.asc())
        .all()
    )

    # Process using SquatEngine
    engine = SquatEngine(EXERCISE_CONFIGS["squat"])
    
    # Transform frames list to engine format
    engine_frames = []
    for f in frames:
        engine_frames.append({
            "timestamp_millis": f.timestamp_millis,
            "joint_coordinates": f.joint_coordinates
        })

    analysis = engine.process_frames(engine_frames)
    return LiveFeedbackResponse(
        reps=analysis["reps"],
        feedback=analysis["feedback"],
        status=analysis["status"],
        angles=analysis["angles"],
        detected_errors=analysis["detected_errors"],
        current_error=analysis["current_error"]
    )

@router.post("/end", response_model=SquatEndResponse)
def end_squat_session(
    request_data: SquatEndRequest,
    current_user: UserPayload = Depends(require_patient),
    db: Session = Depends(get_db)
):
    """
    Finalize the Squat session, computing aggregated metrics and updating status.
    """
    session = verify_session_access(request_data.session_id, current_user, db)

    # Fetch all session frames
    frames = (
        db.query(MotionFrame)
        .filter(MotionFrame.session_id == session.id)
        .order_by(MotionFrame.frame_number.asc())
        .all()
    )

    if not frames:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot end session with no recorded frames."
        )

    # Process all frames using SquatEngine
    engine = SquatEngine(EXERCISE_CONFIGS["squat"])
    engine_frames = [
        {"timestamp_millis": f.timestamp_millis, "joint_coordinates": f.joint_coordinates}
        for f in frames
    ]
    analysis = engine.process_frames(engine_frames)
    metrics = analysis["metrics"]

    # Calculate duration
    duration = max(1, int((frames[-1].timestamp_millis - frames[0].timestamp_millis) / 1000))

    # Add or update MotionMetric
    metric = db.query(MotionMetric).filter(MotionMetric.session_id == session.id).first()
    if not metric:
        metric = MotionMetric(
            session_id=session.id,
            patient_id=session.patient_id,
            rom=metrics["rom"],
            speed=metrics["speed"],
            symmetry=metrics["symmetry"],
            smoothness=metrics["smoothness"],
            repetitions=metrics["repetitions"],
            accuracy_score=metrics["accuracy_score"],
            detected_errors={"errors": analysis["detected_errors"]},
            max_rom=metrics["max_rom"]
        )
        db.add(metric)
    else:
        metric.rom = metrics["rom"]
        metric.speed = metrics["speed"]
        metric.symmetry = metrics["symmetry"]
        metric.smoothness = metrics["smoothness"]
        metric.repetitions = metrics["repetitions"]
        metric.accuracy_score = metrics["accuracy_score"]
        metric.detected_errors = {"errors": analysis["detected_errors"]}
        metric.max_rom = metrics["max_rom"]

    # Update session status
    session.score = metrics["accuracy_score"]
    session.duration_seconds = duration
    session.status = "success" if metrics["accuracy_score"] >= 75 else "warning"
    
    db.commit()
    db.refresh(session)

    return SquatEndResponse(
        session_id=session.id,
        status=session.status,
        score=float(session.score),
        duration_seconds=session.duration_seconds,
        repetitions=metrics["repetitions"],
        accuracy_score=metrics["accuracy_score"]
    )

@router.get("/session/{id}")
def get_squat_session_detail(
    id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed telemetry metrics and info for a Squat session.
    """
    session = verify_session_access(id, current_user, db)
    return {
        "id": session.id,
        "patient_id": session.patient_id,
        "exercise_id": session.exercise_id,
        "title": session.title,
        "description": session.description,
        "score": float(session.score) if session.score is not None else 0.0,
        "status": session.status,
        "duration_seconds": session.duration_seconds,
        "completed_at": session.completed_at,
        "metrics_summary": session.metrics_summary
    }

@router.get("/session/{id}/frames")
def get_squat_session_frames(
    id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get coordinate frames for Squat skeleton replay.
    """
    session = verify_session_access(id, current_user, db)
    frames = (
        db.query(MotionFrame)
        .filter(MotionFrame.session_id == session.id)
        .order_by(MotionFrame.frame_number.asc())
        .all()
    )
    return {
        "session_id": session.id,
        "frames": [
            {
                "id": str(f.id),
                "session_id": f.session_id,
                "frame_number": f.frame_number,
                "timestamp_millis": f.timestamp_millis,
                "joint_coordinates": f.joint_coordinates
            }
            for f in frames
        ]
    }

@router.get("/session/{id}/metrics")
def get_squat_session_metrics(
    id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get metrics details for a Squat session.
    """
    session = verify_session_access(id, current_user, db)
    return session.metrics_summary

@router.get("/session/{id}/comparison")
def get_squat_session_comparison(
    id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compare Squat session metrics against previous Squat sessions.
    """
    session = verify_session_access(id, current_user, db)
    
    # Find the latest Squat session recorded prior to this session
    prev_session = (
        db.query(MotionSession)
        .filter(
            MotionSession.patient_id == session.patient_id,
            MotionSession.exercise_id == session.exercise_id,
            MotionSession.id < session.id
        )
        .order_by(MotionSession.id.desc())
        .first()
    )

    def get_metrics_dict(s):
        if not s:
            return {
                "rom": 0.0,
                "speed": 0.0,
                "symmetry": 0.0,
                "smoothness": 0.0,
                "repetitions": 0.0,
                "accuracy": 0.0
            }
        summary = s.metrics_summary
        return {
            "rom": summary.get("rom", 0.0) or 0.0,
            "speed": summary.get("speed", 0.0) or 0.0,
            "symmetry": summary.get("symmetry", 0.0) or 0.0,
            "smoothness": summary.get("smoothness", 0.0) or 0.0,
            "repetitions": float(summary.get("repetitions", 0) or 0),
            "accuracy": float(s.score) if s.score is not None else 0.0
        }

    curr_metrics = get_metrics_dict(session)
    prev_metrics = get_metrics_dict(prev_session)

    def compare_metric(key):
        curr_val = curr_metrics[key]
        prev_val = prev_metrics[key]
        return {
            "current": curr_val,
            "previous": prev_val,
            "delta": round(curr_val - prev_val, 1)
        }

    return {
        "current_session_id": session.id,
        "previous_session_id": prev_session.id if prev_session else None,
        "rom": compare_metric("rom"),
        "speed": compare_metric("speed"),
        "symmetry": compare_metric("symmetry"),
        "accuracy": compare_metric("accuracy"),
        "smoothness": compare_metric("smoothness"),
        "repetitions": compare_metric("repetitions")
    }
