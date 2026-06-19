from typing import List, Dict, Any
from app.models.models import ExerciseRule

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
        
        # Resolve the actual metric value to compare (map "angle" to "rom" parameter)
        val_key = "rom" if parameter_name in ("angle", "rom") else parameter_name
        actual_value = metrics.get(val_key, 0.0)
        if actual_value is None:
            actual_value = 0.0
            
        # Perform comparison
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
            # Fallback on parse failure
            success = False
            
        return rule.status_on_success if success else rule.status_on_fail
    
    # Extensible case for other rule types in the future (e.g. hold_duration, symmetry_limit)
    return "success"

def evaluate_session_rules(rules: List[ExerciseRule], rom: float, speed: float = 0.0, symmetry: float = 0.0) -> str:
    """
    Evaluates all rules for a session and returns the overall status ('success' or 'warning').
    If any single rule returns a 'warning', the overall status is a 'warning'.
    """
    if not rules:
        return "success"
        
    metrics = {"rom": rom, "speed": speed, "symmetry": symmetry}
    
    overall_status = "success"
    for rule in rules:
        status = evaluate_rule(rule, metrics)
        if status == "warning":
            overall_status = "warning"
            
    return overall_status
