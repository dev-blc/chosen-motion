"""Generate clinical progress reports from session history."""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.models import MotionSession, ProgressReport, Patient
from app.services.metric_definitions import extract_session_metrics


def generate_patient_progress_report(
    db: Session,
    patient_id: str,
    days: int = 30,
) -> ProgressReport:
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise ValueError("Patient not found")

    since = datetime.utcnow() - timedelta(days=days)
    sessions = (
        db.query(MotionSession)
        .filter(
            MotionSession.patient_id == patient_id,
            MotionSession.completed_at >= since,
        )
        .order_by(MotionSession.completed_at.desc())
        .all()
    )

    if not sessions:
        summary = f"No motion sessions recorded in the last {days} days for {patient.full_name}."
        metrics_payload: Dict[str, Any] = {"session_count": 0, "period_days": days}
    else:
        all_metrics = [extract_session_metrics(s) for s in sessions]
        avg_accuracy = sum(m["accuracy"] for m in all_metrics) / len(all_metrics)
        avg_rom = sum(m["rom"] for m in all_metrics) / len(all_metrics)
        avg_symmetry = sum(m["symmetry"] for m in all_metrics) / len(all_metrics)
        best_session = max(sessions, key=lambda s: float(s.score or 0))

        exercise_counts: Dict[str, int] = {}
        for s in sessions:
            name = s.exercise.name if s.exercise else "General"
            exercise_counts[name] = exercise_counts.get(name, 0) + 1

        top_exercise = max(exercise_counts, key=exercise_counts.get) if exercise_counts else "N/A"

        summary = (
            f"{patient.full_name} completed {len(sessions)} sessions over {days} days. "
            f"Average form score {avg_accuracy:.1f}%, ROM {avg_rom:.1f}°, symmetry {avg_symmetry:.1f}%. "
            f"Most practiced: {top_exercise}. Best session score: {float(best_session.score or 0):.1f}%."
        )

        metrics_payload = {
            "session_count": len(sessions),
            "period_days": days,
            "avg_accuracy": round(avg_accuracy, 1),
            "avg_rom": round(avg_rom, 1),
            "avg_symmetry": round(avg_symmetry, 1),
            "best_session_id": best_session.id,
            "best_score": float(best_session.score or 0),
            "exercise_breakdown": exercise_counts,
        }

    report = ProgressReport(
        patient_id=patient_id,
        report_date=date.today(),
        summary=summary,
        metrics=metrics_payload,
    )
    db.add(report)
    db.flush()
    return report
