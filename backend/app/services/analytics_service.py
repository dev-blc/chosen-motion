"""Clinic-wide and per-patient analytics for admin dashboard."""

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.models import MotionSession, MotionMetric, Patient, Exercise
from app.services.metric_definitions import extract_session_metrics


def _week_label(dt: datetime, now: datetime) -> str:
    weeks_ago = (now - dt).days // 7
    if weeks_ago == 0:
        return "This week"
    return f"Week {4 - weeks_ago}" if weeks_ago < 4 else dt.strftime("%b %d")


def get_clinic_analytics(db: Session) -> Dict[str, Any]:
    now = datetime.utcnow()
    four_weeks_ago = now - timedelta(weeks=4)

    sessions = (
        db.query(MotionSession)
        .join(Patient, MotionSession.patient_id == Patient.patient_id)
        .filter(Patient.is_archived == False, MotionSession.completed_at >= four_weeks_ago)
        .all()
    )

    weekly_rom: Dict[str, List[float]] = defaultdict(list)
    weekly_accuracy: Dict[str, List[float]] = defaultdict(list)
    exercise_accuracy: Dict[str, List[float]] = defaultdict(list)

    for session in sessions:
        metrics = extract_session_metrics(session)
        week_key = _week_label(session.completed_at or now, now)
        weekly_rom[week_key].append(metrics.get("rom", 0))
        weekly_accuracy[week_key].append(metrics.get("accuracy", 0))
        ex_name = session.exercise.name if session.exercise else "General"
        exercise_accuracy[ex_name].append(metrics.get("accuracy", 0))

    rom_progress = []
    for i in range(4):
        week_start = now - timedelta(weeks=3 - i)
        label = f"Week {i + 1}"
        vals = weekly_rom.get(label, [])
        if not vals and i == 3:
            vals = weekly_rom.get("This week", [])
        rom_progress.append({
            "label": label,
            "avg_rom": round(sum(vals) / len(vals), 1) if vals else 0,
            "session_count": len(vals),
        })

    # Fill from actual week buckets if empty
    if not any(w["avg_rom"] for w in rom_progress) and weekly_rom:
        rom_progress = [
            {"label": k, "avg_rom": round(sum(v) / len(v), 1), "session_count": len(v)}
            for k, v in sorted(weekly_rom.items())[-4:]
        ]

    alignment_scores = [
        {
            "label": name,
            "score": round(sum(vals) / len(vals), 1),
            "session_count": len(vals),
        }
        for name, vals in sorted(exercise_accuracy.items(), key=lambda x: -len(x[1]))[:6]
    ]

    total_sessions = db.query(MotionSession).join(Patient).filter(Patient.is_archived == False).count()
    avg_score = (
        db.query(func.avg(MotionSession.score))
        .join(Patient)
        .filter(Patient.is_archived == False)
        .scalar()
    )

    return {
        "rom_progress": rom_progress,
        "alignment_scores": alignment_scores,
        "total_sessions": total_sessions,
        "average_session_score": round(float(avg_score or 0), 1),
        "active_patients": db.query(Patient).filter(Patient.is_archived == False).count(),
    }


def get_patient_analytics(db: Session, patient_id: str) -> Dict[str, Any]:
    now = datetime.utcnow()
    four_weeks_ago = now - timedelta(weeks=4)

    sessions = (
        db.query(MotionSession)
        .filter(
            MotionSession.patient_id == patient_id,
            MotionSession.completed_at >= four_weeks_ago,
        )
        .order_by(MotionSession.completed_at.asc())
        .all()
    )

    weekly_rom: Dict[str, List[float]] = defaultdict(list)
    weekly_accuracy: Dict[str, List[float]] = defaultdict(list)
    exercise_breakdown: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"rom": [], "accuracy": []})

    for session in sessions:
        metrics = extract_session_metrics(session)
        week_key = _week_label(session.completed_at or now, now)
        weekly_rom[week_key].append(metrics.get("rom", 0))
        weekly_accuracy[week_key].append(metrics.get("accuracy", 0))
        ex_name = session.exercise.name if session.exercise else "General"
        exercise_breakdown[ex_name]["rom"].append(metrics.get("rom", 0))
        exercise_breakdown[ex_name]["accuracy"].append(metrics.get("accuracy", 0))

    rom_progress = [
        {
            "label": f"Week {i + 1}",
            "avg_rom": round(
                sum(weekly_rom.get(f"Week {i + 1}", weekly_rom.get("This week", [])))
                / max(1, len(weekly_rom.get(f"Week {i + 1}", weekly_rom.get("This week", [])))),
                1,
            )
            if weekly_rom.get(f"Week {i + 1}") or weekly_rom.get("This week")
            else 0,
            "session_count": len(weekly_rom.get(f"Week {i + 1}", [])),
        }
        for i in range(4)
    ]

    if sessions:
        rom_progress = []
        buckets: Dict[int, List[float]] = defaultdict(list)
        for s in sessions:
            days_ago = (now - (s.completed_at or now)).days
            bucket = min(3, days_ago // 7)
            buckets[3 - bucket].append(extract_session_metrics(s).get("rom", 0))
        for i in range(4):
            vals = buckets.get(i, [])
            rom_progress.append({
                "label": f"Week {i + 1}",
                "avg_rom": round(sum(vals) / len(vals), 1) if vals else 0,
                "session_count": len(vals),
            })

    alignment_scores = [
        {
            "label": name,
            "score": round(sum(data["accuracy"]) / len(data["accuracy"]), 1),
            "avg_rom": round(sum(data["rom"]) / len(data["rom"]), 1),
            "session_count": len(data["accuracy"]),
        }
        for name, data in exercise_breakdown.items()
    ]

    return {
        "patient_id": patient_id,
        "rom_progress": rom_progress,
        "alignment_scores": alignment_scores,
        "total_sessions": len(sessions),
        "recent_sessions": [
            {
                "id": s.id,
                "exercise": s.exercise.name if s.exercise else "Session",
                "score": float(s.score or 0),
                "completed_at": (s.completed_at or s.created_at).isoformat(),
            }
            for s in sessions[-10:]
        ],
    }
