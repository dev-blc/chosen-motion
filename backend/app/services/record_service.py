"""Personal best / worst record tracking per patient and exercise."""

from datetime import datetime
from typing import Dict, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.models import MotionSession, PatientExerciseRecord
from app.services.metric_definitions import (
    DEFAULT_RECORD_METRICS,
    extract_session_metrics,
    is_better,
)


def get_or_create_record(
    db: Session, patient_id: str, exercise_id: int
) -> PatientExerciseRecord:
    record = (
        db.query(PatientExerciseRecord)
        .filter(
            PatientExerciseRecord.patient_id == patient_id,
            PatientExerciseRecord.exercise_id == exercise_id,
        )
        .first()
    )
    if not record:
        record = PatientExerciseRecord(
            patient_id=patient_id,
            exercise_id=exercise_id,
            metric_keys={"metrics": DEFAULT_RECORD_METRICS},
        )
        db.add(record)
        db.flush()
    return record


def update_records_for_session(
    db: Session, session: MotionSession
) -> Tuple[bool, Optional[PatientExerciseRecord]]:
    """
    Update best/worst records after a session is finalized.
    Returns (is_new_best, record_row).
    """
    if not session.exercise_id:
        return False, None

    metrics = extract_session_metrics(session)
    record = get_or_create_record(db, session.patient_id, session.exercise_id)
    is_new_best = False

    if not record.best_metrics:
        record.best_metrics = metrics.copy()
        record.best_session_id = session.id
        record.best_recorded_at = session.completed_at or datetime.utcnow()
        is_new_best = True
    else:
        for key, val in metrics.items():
            best_val = float(record.best_metrics.get(key, 0.0) or 0.0)
            if is_better(key, val, best_val):
                is_new_best = True
                break
        if is_new_best:
            record.best_metrics = metrics.copy()
            record.best_session_id = session.id
            record.best_recorded_at = session.completed_at or datetime.utcnow()

    if not record.worst_metrics:
        record.worst_metrics = metrics.copy()
        record.worst_session_id = session.id
        record.worst_recorded_at = session.completed_at or datetime.utcnow()
    else:
        is_new_worst = False
        for key, val in metrics.items():
            worst_val = float(record.worst_metrics.get(key, 0.0) or 0.0)
            if not is_better(key, val, worst_val):
                is_new_worst = True
                break
        if is_new_worst:
            record.worst_metrics = metrics.copy()
            record.worst_session_id = session.id
            record.worst_recorded_at = session.completed_at or datetime.utcnow()

    record.updated_at = datetime.utcnow()
    db.flush()
    return is_new_best, record


def compare_to_record(
    current_metrics: Dict[str, float],
    record_metrics: Optional[Dict[str, float]],
) -> Dict[str, Dict[str, float]]:
    if not record_metrics:
        return {}
    result = {}
    for key, current in current_metrics.items():
        record_val = float(record_metrics.get(key, 0.0) or 0.0)
        result[key] = {
            "current": round(current, 1),
            "record": round(record_val, 1),
            "delta": round(current - record_val, 1),
            "is_new_best": is_better(key, current, record_val) if record_val else True,
        }
    return result
