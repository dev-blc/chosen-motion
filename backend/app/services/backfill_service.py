"""Backfill patient exercise records from historical sessions."""

from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.models.models import MotionSession, PatientExerciseRecord
from app.services.record_service import get_or_create_record, update_records_for_session


def backfill_patient_records(
    db: Session,
    patient_id: Optional[str] = None,
) -> Dict[str, int]:
    """
    Recompute best/worst records from all historical sessions.
    Returns counts of sessions processed and records updated.
    """
    query = db.query(MotionSession).filter(MotionSession.exercise_id.isnot(None))
    if patient_id:
        query = query.filter(MotionSession.patient_id == patient_id)
    sessions = query.order_by(MotionSession.id.asc()).all()

    if patient_id:
        db.query(PatientExerciseRecord).filter(
            PatientExerciseRecord.patient_id == patient_id
        ).delete()

    processed = 0
    records_touched: set = set()

    for session in sessions:
        key = (session.patient_id, session.exercise_id)
        get_or_create_record(db, session.patient_id, session.exercise_id)
        update_records_for_session(db, session)
        records_touched.add(key)
        processed += 1

    db.flush()
    return {
        "sessions_processed": processed,
        "records_updated": len(records_touched),
    }
