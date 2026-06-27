"""Shared SQLAlchemy query options for consistent API responses."""
from sqlalchemy.orm import joinedload, selectinload
from app.models.models import MotionSession, ExerciseAssignment


def session_load_options():
    """Eager-load exercise, metrics, and environment for session serialization."""
    return (
        joinedload(MotionSession.exercise),
        selectinload(MotionSession.metrics),
        joinedload(MotionSession.session_environment),
    )


def assignment_load_options():
    """Eager-load exercise details for assignment responses."""
    return (joinedload(ExerciseAssignment.exercise),)
