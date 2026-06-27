"""Canonical metric keys and comparison rules for session records."""

from typing import Dict, List, Tuple

# Metrics where higher values indicate better performance
HIGHER_IS_BETTER = {"rom", "accuracy", "smoothness", "symmetry", "repetitions"}

# Metrics where lower values indicate better performance
LOWER_IS_BETTER = {"speed"}

DEFAULT_RECORD_METRICS = ["accuracy", "rom", "smoothness", "symmetry", "repetitions", "speed"]

ALLOWED_LANDMARKS = [
    "shoulder_l", "shoulder_r", "elbow_l", "elbow_r", "wrist_l", "wrist_r",
    "hip_l", "hip_r", "knee_l", "knee_r", "ankle_l", "ankle_r",
    "heel_l", "heel_r", "foot_index_l", "foot_index_r", "index_l", "index_r",
]

MEDIAPIPE_LANDMARK_MAP = {
    "shoulder_l": 11, "shoulder_r": 12, "elbow_l": 13, "elbow_r": 14,
    "wrist_l": 15, "wrist_r": 16, "index_l": 19, "index_r": 20,
    "hip_l": 23, "hip_r": 24, "knee_l": 25, "knee_r": 26,
    "ankle_l": 27, "ankle_r": 28, "heel_l": 29, "heel_r": 30,
    "foot_index_l": 31, "foot_index_r": 32,
}


def is_better(metric_key: str, current: float, record: float) -> bool:
    if metric_key in LOWER_IS_BETTER:
        return current < record
    return current > record


def extract_session_metrics(session) -> Dict[str, float]:
    summary = session.metrics_summary if session else {}
    return {
        "rom": float(summary.get("rom", 0.0) or 0.0),
        "speed": float(summary.get("speed", 0.0) or 0.0),
        "symmetry": float(summary.get("symmetry", 0.0) or 0.0),
        "smoothness": float(summary.get("smoothness", 0.0) or 0.0),
        "repetitions": float(summary.get("repetitions", 0) or 0),
        "accuracy": float(session.score) if session and session.score is not None else 0.0,
    }
