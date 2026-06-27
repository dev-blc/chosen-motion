"""Merge exercise template, assignment overrides, and patient limitations."""

from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.models import ExerciseAssignment, PatientLimitation


def get_active_limitations(
    db: Session, patient_id: str, exercise_id: Optional[int] = None
) -> List[PatientLimitation]:
    query = db.query(PatientLimitation).filter(
        PatientLimitation.patient_id == patient_id,
        PatientLimitation.active == True,
    )
    limitations = query.all()
    if exercise_id is None:
        return limitations
    return [
        lim for lim in limitations
        if lim.scope_type == "global"
        or (lim.scope_type == "exercise" and lim.scope_id == exercise_id)
    ]


def merge_assignment_config(assignment: ExerciseAssignment) -> Dict[str, Any]:
    exercise = assignment.exercise
    base_config: Dict[str, Any] = {
        "sets": 3,
        "reps": 10,
        "rest_seconds": 30,
        "target_rom": exercise.target_rom if exercise else None,
        "difficulty": "Light",
        "duration": "5 mins",
        "body_part": "General",
        "category": "Rehabilitation",
    }
    if assignment.config:
        base_config.update(assignment.config)
    if assignment.config and assignment.config.get("target_rom_override") is not None:
        base_config["target_rom"] = assignment.config["target_rom_override"]
    return base_config


def build_prescription(db: Session, assignment_id: int) -> Dict[str, Any]:
    assignment = (
        db.query(ExerciseAssignment)
        .filter(ExerciseAssignment.id == assignment_id)
        .first()
    )
    if not assignment or not assignment.exercise:
        return {}

    exercise = assignment.exercise
    limitations = get_active_limitations(db, assignment.patient_id, exercise.id)

    merged_rules = []
    for rule in exercise.rules or []:
        rule_dict = {
            "id": rule.id,
            "rule_name": rule.rule_name,
            "rule_type": rule.rule_type,
            "parameters": dict(rule.parameters or {}),
            "status_on_success": rule.status_on_success,
            "status_on_fail": rule.status_on_fail,
        }
        if assignment.config and assignment.config.get("rule_overrides"):
            for override in assignment.config["rule_overrides"]:
                if override.get("rule_id") == rule.id and "value" in override:
                    rule_dict["parameters"]["value"] = override["value"]
        merged_rules.append(rule_dict)

    guide = exercise.guide_content or {}
    metadata = merge_assignment_config(assignment)

    return {
        "assignment_id": assignment.id,
        "patient_id": assignment.patient_id,
        "exercise_id": exercise.id,
        "exercise_name": exercise.name,
        "target_rom": metadata.get("target_rom"),
        "target_joints": exercise.target_joints,
        "capture_config": exercise.capture_config,
        "metric_definitions": exercise.metric_definitions,
        "rules": merged_rules,
        "config": metadata,
        "guide": {
            "description": guide.get("description") or exercise.description,
            "instructions": guide.get("instructions") or ([exercise.instructions] if exercise.instructions else []),
            "preparation_tips": guide.get("preparation_tips", []),
            "common_mistakes": guide.get("common_mistakes", []),
            "safety_notes": guide.get("safety_notes", []),
            "target_muscles": guide.get("target_muscles", []),
            "required_equipment": guide.get("required_equipment", "None (Bodyweight)"),
        },
        "limitations": [
            {
                "id": lim.id,
                "scope_type": lim.scope_type,
                "scope_id": lim.scope_id,
                "limitation_type": lim.limitation_type,
                "parameters": lim.parameters,
                "notes": lim.notes,
            }
            for lim in limitations
        ],
    }
