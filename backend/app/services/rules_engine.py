from typing import Any, Dict, List, Optional, Tuple

from app.models.models import ExerciseRule, PatientLimitation


def evaluate_rule(rule: ExerciseRule, metrics: Dict[str, Any]) -> str:
    """
    Evaluates a single rule against session metrics.
    Supported metrics dict keys: "rom", "speed", "symmetry"
    """
    if rule.rule_type == "threshold_comparison":
        params = rule.parameters or {}
        parameter_name = params.get("parameter", "angle")
        operator = params.get("operator", ">=")
        threshold = params.get("value", 0.0)

        val_key = "rom" if parameter_name in ("angle", "rom") else parameter_name
        actual_value = metrics.get(val_key, 0.0)
        if actual_value is None:
            actual_value = 0.0

        success = False
        try:
            if operator == ">=":
                success = float(actual_value) >= float(threshold)
            elif operator == "<=":
                success = float(actual_value) <= float(threshold)
            elif operator == ">":
                success = float(actual_value) > float(threshold)
            elif operator == "<":
                success = float(actual_value) < float(threshold)
            elif operator == "==":
                success = float(actual_value) == float(threshold)
        except (ValueError, TypeError):
            success = False

        return rule.status_on_success if success else rule.status_on_fail

    return "success"


def _limitation_applies(lim: PatientLimitation, exercise_id: Optional[int]) -> bool:
    if lim.scope_type == "global":
        return True
    if lim.scope_type == "exercise" and exercise_id is not None:
        return lim.scope_id == exercise_id
    return False


def evaluate_patient_limitations(
    limitations: List[PatientLimitation],
    exercise_id: Optional[int],
    metrics: Dict[str, float],
) -> Tuple[str, List[Dict[str, Any]]]:
    """Check active patient limitations against session metrics."""
    status = "success"
    violations: List[Dict[str, Any]] = []

    for lim in limitations:
        if not lim.active or not _limitation_applies(lim, exercise_id):
            continue

        params = lim.parameters or {}
        lim_type = lim.limitation_type

        if lim_type == "rom_cap":
            cap = float(params.get("max_rom", params.get("value", 999)))
            if metrics.get("rom", 0) > cap:
                status = "warning"
                violations.append({
                    "limitation_id": lim.id,
                    "type": lim_type,
                    "message": f"ROM {metrics.get('rom', 0):.1f}° exceeds patient cap of {cap:.1f}°",
                    "notes": lim.notes,
                })
        elif lim_type == "rom_floor":
            floor = float(params.get("min_rom", params.get("value", 0)))
            if metrics.get("rom", 0) < floor:
                status = "warning"
                violations.append({
                    "limitation_id": lim.id,
                    "type": lim_type,
                    "message": f"ROM {metrics.get('rom', 0):.1f}° below patient minimum of {floor:.1f}°",
                    "notes": lim.notes,
                })
        elif lim_type == "symmetry_min":
            minimum = float(params.get("min_symmetry", params.get("value", 0)))
            sym = metrics.get("symmetry", 0)
            sym_pct = sym if sym > 2 else sym * 100
            if sym_pct < minimum:
                status = "warning"
                violations.append({
                    "limitation_id": lim.id,
                    "type": lim_type,
                    "message": f"Symmetry {sym_pct:.1f}% below patient minimum of {minimum:.1f}%",
                    "notes": lim.notes,
                })
        elif lim_type == "speed_max":
            maximum = float(params.get("max_speed", params.get("value", 999)))
            if metrics.get("speed", 0) > maximum:
                status = "warning"
                violations.append({
                    "limitation_id": lim.id,
                    "type": lim_type,
                    "message": f"Speed {metrics.get('speed', 0):.1f}°/s exceeds patient limit of {maximum:.1f}°/s",
                    "notes": lim.notes,
                })
        elif lim_type == "joint_avoid":
            joint = params.get("joint", "")
            max_angle = params.get("max_angle")
            if joint and max_angle is not None:
                violations.append({
                    "limitation_id": lim.id,
                    "type": lim_type,
                    "message": f"Avoid exceeding {max_angle}° at {joint}",
                    "notes": lim.notes,
                })

    return status, violations


def apply_limitation_rule_overrides(
    rules: List[ExerciseRule],
    limitations: List[PatientLimitation],
    exercise_id: Optional[int],
) -> List[ExerciseRule]:
    """Soft-adjust rule thresholds based on patient ROM caps (in-memory only)."""
    rom_cap = None
    for lim in limitations:
        if not lim.active or not _limitation_applies(lim, exercise_id):
            continue
        if lim.limitation_type == "rom_cap":
            cap = lim.parameters.get("max_rom", lim.parameters.get("value"))
            if cap is not None:
                rom_cap = min(rom_cap, float(cap)) if rom_cap is not None else float(cap)

    if rom_cap is None:
        return rules

    adjusted = []
    for rule in rules:
        if rule.rule_type == "threshold_comparison":
            params = dict(rule.parameters or {})
            param_name = params.get("parameter", "angle")
            if param_name in ("angle", "rom") and params.get("operator") in (">=", ">"):
                current = float(params.get("value", 0))
                params["value"] = min(current, rom_cap)
                adjusted.append(
                    ExerciseRule(
                        id=rule.id,
                        exercise_id=rule.exercise_id,
                        rule_name=rule.rule_name,
                        rule_type=rule.rule_type,
                        parameters=params,
                        status_on_success=rule.status_on_success,
                        status_on_fail=rule.status_on_fail,
                    )
                )
                continue
        adjusted.append(rule)
    return adjusted


def evaluate_session_rules(
    rules: List[ExerciseRule],
    rom: float,
    speed: float = 0.0,
    symmetry: float = 0.0,
    limitations: Optional[List[PatientLimitation]] = None,
    exercise_id: Optional[int] = None,
) -> str:
    """
    Evaluates all rules for a session and returns the overall status ('success' or 'warning').
    Patient limitations can downgrade status to warning when violated.
    """
    metrics = {"rom": rom, "speed": speed, "symmetry": symmetry}

    effective_rules = rules
    if limitations:
        effective_rules = apply_limitation_rule_overrides(rules, limitations, exercise_id)

    overall_status = "success"
    if effective_rules:
        for rule in effective_rules:
            status = evaluate_rule(rule, metrics)
            if status == "warning":
                overall_status = "warning"

    if limitations:
        lim_status, _ = evaluate_patient_limitations(limitations, exercise_id, metrics)
        if lim_status == "warning":
            overall_status = "warning"

    return overall_status
