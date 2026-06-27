"""Environment catalog, exercise requirements, and session environment scoring."""

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.models import (
    EnvironmentComponent,
    ExerciseEnvironmentRequirement,
    MotionSession,
    SessionEnvironment,
)

DEFAULT_COMPONENTS = [
    {"name": "Resistance Band", "slug": "resistance_band", "category": "equipment", "affects_tracking": False},
    {"name": "Exercise Bench", "slug": "bench", "category": "equipment", "affects_tracking": False},
    {"name": "Box / Platform", "slug": "box_squat", "category": "equipment", "affects_tracking": True},
    {"name": "Olympic Bar", "slug": "olympic_bar", "category": "equipment", "affects_tracking": True},
    {"name": "Dumbbells", "slug": "dumbbells", "category": "equipment", "affects_tracking": True},
    {"name": "Wall Mirror", "slug": "mirror", "category": "distraction", "affects_tracking": False},
    {"name": "Crowded Space", "slug": "crowded_gym", "category": "distraction", "affects_tracking": True},
    {"name": "Clear Floor Space", "slug": "clear_floor", "category": "setup", "affects_tracking": False},
]


def ensure_default_components(db: Session) -> None:
    if db.query(EnvironmentComponent).count() > 0:
        return
    for item in DEFAULT_COMPONENTS:
        db.add(EnvironmentComponent(**item))
    db.flush()


def get_exercise_environment_requirements(
    db: Session, exercise_id: int
) -> List[Dict[str, Any]]:
    rows = (
        db.query(ExerciseEnvironmentRequirement, EnvironmentComponent)
        .join(EnvironmentComponent, ExerciseEnvironmentRequirement.component_id == EnvironmentComponent.id)
        .filter(ExerciseEnvironmentRequirement.exercise_id == exercise_id)
        .all()
    )
    return [
        {
            "id": req.id,
            "exercise_id": req.exercise_id,
            "component_id": comp.id,
            "slug": comp.slug,
            "name": comp.name,
            "category": comp.category,
            "required": req.required,
            "affects_tracking": comp.affects_tracking,
            "setup_instructions": comp.setup_instructions,
            "config": req.config or {},
        }
        for req, comp in rows
    ]


def compute_environment_score(
    declared_slugs: List[str],
    noise_level: Optional[int] = None,
    mirror_present: Optional[bool] = None,
    other_users_present: Optional[bool] = None,
) -> float:
    """Informational score 0-100; lower noise and fewer distractions = higher score."""
    score = 100.0
    if noise_level is not None:
        score -= min(30, noise_level * 3)
    if mirror_present:
        score -= 5
    if other_users_present:
        score -= 10
    if "crowded_gym" in declared_slugs:
        score -= 15
    return round(max(0, min(100, score)), 1)


def build_session_environment(
    db: Session,
    session: MotionSession,
    declared_components: Optional[List[str]] = None,
    noise_level: Optional[int] = None,
    mirror_present: Optional[bool] = None,
    other_users_present: Optional[bool] = None,
) -> SessionEnvironment:
    slugs = declared_components or []
    env_score = compute_environment_score(slugs, noise_level, mirror_present, other_users_present)
    env = SessionEnvironment(
        session_id=session.id,
        declared_components={"components": slugs},
        noise_level=noise_level,
        mirror_present=mirror_present,
        other_users_present=other_users_present,
        environment_score=env_score,
    )
    db.add(env)
    return env
