import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.core.database import get_db
from app.core.security import get_current_user, UserPayload
from app.models.models import MotionSession, MotionFrame, Patient
from app.schemas.schemas import (
    SessionDetailResponse,
    SessionFramesResponse,
    SessionAccuracyResponse,
    SessionComparisonResponse,
    MetricCompare
)

router = APIRouter()

def get_user_uuid(user_id: str):
    try:
        return uuid.UUID(str(user_id))
    except (ValueError, TypeError):
        return user_id

@router.get("/{session_id}", response_model=SessionDetailResponse)
def get_session_detail(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed telemetry metrics and coordinates for a specific recording session.
    """
    session = db.query(MotionSession).filter(MotionSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    # Authorization Check: Admin can view all, Patient can only view their own
    if current_user.role.lower() != "admin":
        patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
        if not patient or patient.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view this session."
            )
            
    return session

@router.get("/{session_id}/frames", response_model=SessionFramesResponse)
def get_session_frames(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all coordinate frames sorted by frame_number for skeleton replay.
    """
    session = db.query(MotionSession).filter(MotionSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    # Authorization Check
    if current_user.role.lower() != "admin":
        patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
        if not patient or patient.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view this session's telemetry."
            )

    frames = (
        db.query(MotionFrame)
        .filter(MotionFrame.session_id == session_id)
        .order_by(MotionFrame.frame_number.asc())
        .all()
    )
    return SessionFramesResponse(session_id=session_id, frames=frames)

@router.get("/{session_id}/metrics")
def get_session_metrics(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get metrics summary including ROM, speed, symmetry, smoothness, repetitions, and accuracy.
    """
    session = db.query(MotionSession).filter(MotionSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    # Authorization Check
    if current_user.role.lower() != "admin":
        patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
        if not patient or patient.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view this session's metrics."
            )

    return session.metrics_summary

@router.get("/{session_id}/accuracy", response_model=SessionAccuracyResponse)
def get_session_accuracy(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get accuracy score and list of detected form errors.
    """
    session = db.query(MotionSession).filter(MotionSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    # Authorization Check
    if current_user.role.lower() != "admin":
        patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
        if not patient or patient.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view this session's accuracy detail."
            )

    accuracy_score = float(session.score) if session.score is not None else 100.0
    errors = []
    if session.metrics and len(session.metrics) > 0:
        m = session.metrics[0]
        raw_errors = m.detected_errors or {}
        errors = raw_errors.get("errors", [])

    return SessionAccuracyResponse(
        accuracy_score=accuracy_score,
        detected_errors=errors
    )

@router.get("/{session_id}/comparison", response_model=SessionComparisonResponse)
def get_session_comparison(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Compare current session metrics against the patient's previous session for the same exercise.
    """
    session = db.query(MotionSession).filter(MotionSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    # Authorization Check
    if current_user.role.lower() != "admin":
        patient = db.query(Patient).filter(Patient.auth_user_id == get_user_uuid(current_user.id)).first()
        if not patient or patient.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view this session's comparison."
            )

    # Find the latest session of the same exercise recorded prior to this session
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
        return MetricCompare(
            current=curr_val,
            previous=prev_val,
            delta=round(curr_val - prev_val, 1)
        )

    return SessionComparisonResponse(
        current_session_id=session.id,
        previous_session_id=prev_session.id if prev_session else None,
        rom=compare_metric("rom"),
        speed=compare_metric("speed"),
        symmetry=compare_metric("symmetry"),
        accuracy=compare_metric("accuracy"),
        smoothness=compare_metric("smoothness"),
        repetitions=compare_metric("repetitions")
    )
