from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user, UserPayload
from app.models.models import MotionSession, MotionFrame, PatientExerciseRecord, SessionFrameAnnotation
from app.services.query_helpers import session_load_options
from app.services.patient_resolver import resolve_patient_for_user
from app.services.metric_definitions import extract_session_metrics
from app.services.record_service import compare_to_record
from app.schemas.schemas import (
    SessionDetailResponse,
    SessionFramesResponse,
    SessionAccuracyResponse,
    SessionComparisonResponse,
    MetricCompare,
    RecordMetricCompare,
    SessionFrameAnnotationResponse,
)

router = APIRouter()


def _authorize_session(session: MotionSession, current_user: UserPayload, db: Session):
    if current_user.role.lower() != "admin":
        patient = resolve_patient_for_user(current_user, db, link_auth=False)
        if not patient or patient.patient_id != session.patient_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. You do not have permission to view this session."
            )


def _compare_metric(key: str, curr_metrics: dict, ref_metrics: dict) -> MetricCompare:
    curr_val = curr_metrics[key]
    ref_val = ref_metrics[key]
    return MetricCompare(
        current=curr_val,
        previous=ref_val,
        delta=round(curr_val - ref_val, 1)
    )


@router.get("/{session_id}", response_model=SessionDetailResponse)
def get_session_detail(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = (
        db.query(MotionSession)
        .filter(MotionSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _authorize_session(session, current_user, db)
    return session


@router.get("/{session_id}/frames", response_model=SessionFramesResponse)
def get_session_frames(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = (
        db.query(MotionSession)
        .filter(MotionSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _authorize_session(session, current_user, db)

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
    session = (
        db.query(MotionSession)
        .filter(MotionSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _authorize_session(session, current_user, db)
    return session.metrics_summary


@router.get("/{session_id}/accuracy", response_model=SessionAccuracyResponse)
def get_session_accuracy(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = (
        db.query(MotionSession)
        .filter(MotionSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _authorize_session(session, current_user, db)

    accuracy_score = float(session.score) if session.score is not None else 100.0
    errors = []
    if session.metrics and len(session.metrics) > 0:
        m = session.metrics[0]
        raw_errors = m.detected_errors or {}
        errors = raw_errors.get("errors", [])

    return SessionAccuracyResponse(accuracy_score=accuracy_score, detected_errors=errors)


@router.get("/{session_id}/frame-annotations", response_model=List[SessionFrameAnnotationResponse])
def get_session_frame_annotations(
    session_id: int,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(MotionSession)
        .filter(MotionSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _authorize_session(session, current_user, db)

    query = db.query(SessionFrameAnnotation).filter(SessionFrameAnnotation.session_id == session_id)
    if current_user.role.lower() != "admin":
        query = query.filter(SessionFrameAnnotation.visible_to_patient == True)

    return query.order_by(
        SessionFrameAnnotation.frame_number.asc(),
        SessionFrameAnnotation.created_at.asc(),
    ).all()


@router.get("/{session_id}/comparison", response_model=SessionComparisonResponse)
def get_session_comparison(
    session_id: int,
    mode: str = Query("previous", pattern="^(previous|best|worst|all)$"),
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session = (
        db.query(MotionSession)
        .filter(MotionSession.id == session_id)
        .options(*session_load_options())
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    _authorize_session(session, current_user, db)

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

    curr_metrics = extract_session_metrics(session)
    prev_metrics = extract_session_metrics(prev_session)

    record = None
    if session.exercise_id:
        record = (
            db.query(PatientExerciseRecord)
            .filter(
                PatientExerciseRecord.patient_id == session.patient_id,
                PatientExerciseRecord.exercise_id == session.exercise_id,
            )
            .first()
        )

    best_compare = None
    worst_compare = None
    is_new_best = False
    if record and record.best_metrics and mode in ("best", "all"):
        raw = compare_to_record(curr_metrics, record.best_metrics)
        best_compare = {k: RecordMetricCompare(**v) for k, v in raw.items()}
        is_new_best = any(v.is_new_best for v in best_compare.values()) if best_compare else False
    if record and record.worst_metrics and mode in ("worst", "all"):
        raw = compare_to_record(curr_metrics, record.worst_metrics)
        worst_compare = {k: RecordMetricCompare(**v) for k, v in raw.items()}

    ref_metrics = prev_metrics
    if mode == "best" and record and record.best_metrics:
        ref_metrics = {k: float(v) for k, v in record.best_metrics.items()}
    elif mode == "worst" and record and record.worst_metrics:
        ref_metrics = {k: float(v) for k, v in record.worst_metrics.items()}

    return SessionComparisonResponse(
        current_session_id=session.id,
        previous_session_id=prev_session.id if prev_session else None,
        mode=mode,
        rom=_compare_metric("rom", curr_metrics, ref_metrics),
        speed=_compare_metric("speed", curr_metrics, ref_metrics),
        symmetry=_compare_metric("symmetry", curr_metrics, ref_metrics),
        accuracy=_compare_metric("accuracy", curr_metrics, ref_metrics),
        smoothness=_compare_metric("smoothness", curr_metrics, ref_metrics),
        repetitions=_compare_metric("repetitions", curr_metrics, ref_metrics),
        best_session_id=record.best_session_id if record else None,
        worst_session_id=record.worst_session_id if record else None,
        best=best_compare,
        worst=worst_compare,
        is_new_personal_best=is_new_best,
    )
