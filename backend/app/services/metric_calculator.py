"""
Compute semantic joint metrics, pace, rotation, and per-rep fatigue from telemetry frames.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

from app.services.error_detection import calculate_angle

TRACKED_JOINTS = [
    "elbow_l", "elbow_r", "knee_l", "knee_r", "hip_l", "hip_r",
    "shoulder_l", "shoulder_r",
]

JOINT_ANGLE_VERTICES = {
    "elbow_l": ("shoulder_l", "elbow_l", "wrist_l"),
    "elbow_r": ("shoulder_r", "elbow_r", "wrist_r"),
    "knee_l": ("hip_l", "knee_l", "ankle_l"),
    "knee_r": ("hip_r", "knee_r", "ankle_r"),
    "hip_l": ("shoulder_l", "hip_l", "knee_l"),
    "hip_r": ("shoulder_r", "hip_r", "knee_r"),
    "shoulder_l": ("hip_l", "shoulder_l", "elbow_l"),
    "shoulder_r": ("hip_r", "shoulder_r", "elbow_r"),
}


def _joint_angle(jc: Dict[str, List[float]], joint_key: str) -> float:
    verts = JOINT_ANGLE_VERTICES.get(joint_key)
    if not verts:
        return 0.0
    a, b, c = (jc.get(verts[0]), jc.get(verts[1]), jc.get(verts[2]))
    if not all([a, b, c]):
        return 0.0
    return calculate_angle(a, b, c)


def _infer_joint_type(exercise_name: str) -> str:
    name = exercise_name.lower()
    if "squat" in name or "knee" in name or "lunge" in name:
        return "knee"
    if "shoulder" in name:
        return "shoulder"
    if "hip" in name or "hinge" in name or "bridge" in name or "clamshell" in name:
        return "hip"
    return "elbow"


def _primary_joint_keys(joint_type: str) -> List[str]:
    if joint_type == "knee":
        return ["knee_l", "knee_r", "hip_l", "hip_r"]
    if joint_type == "shoulder":
        return ["shoulder_l", "shoulder_r", "elbow_l", "elbow_r"]
    if joint_type == "hip":
        return ["hip_l", "hip_r", "knee_l", "knee_r"]
    return ["elbow_l", "elbow_r", "shoulder_l", "shoulder_r"]


def _detect_rep_boundaries(
    frames: List[Dict[str, Any]], joint_type: str
) -> List[Tuple[int, int]]:
    """Return list of (start_idx, end_idx) frame indices per rep."""
    if len(frames) < 3:
        return [(0, max(0, len(frames) - 1))]

    boundaries: List[int] = [0]
    state = "extended"

    for i, frame in enumerate(frames):
        jc = frame.get("joint_coordinates") or {}
        if joint_type == "knee":
            kl = _joint_angle(jc, "knee_l")
            kr = _joint_angle(jc, "knee_r")
            angle = (kl + kr) / 2
            if state == "extended" and angle < 160:
                state = "flexed"
            elif state == "flexed" and angle > 155:
                state = "extended"
                boundaries.append(i)
        elif joint_type == "shoulder":
            sl = _joint_angle(jc, "shoulder_l")
            sr = _joint_angle(jc, "shoulder_r")
            angle = max(sl, sr)
            if state == "extended" and angle > 95:
                state = "flexed"
            elif state == "flexed" and angle < 40:
                state = "extended"
                boundaries.append(i)
        else:
            el = _joint_angle(jc, "elbow_l")
            er = _joint_angle(jc, "elbow_r")
            angle = max(el, er)
            if state == "extended" and angle < 55:
                state = "flexed"
            elif state == "flexed" and angle > 130:
                state = "extended"
                boundaries.append(i)

    if boundaries[-1] != len(frames) - 1:
        boundaries.append(len(frames) - 1)

    reps = []
    for i in range(len(boundaries) - 1):
        reps.append((boundaries[i], boundaries[i + 1]))
    if not reps:
        reps = [(0, len(frames) - 1)]
    return reps


def _rep_metrics(
    frames: List[Dict[str, Any]], start: int, end: int, joint_keys: List[str]
) -> Dict[str, Any]:
    segment = frames[start : end + 1]
    if not segment:
        return {}

    joint_angles: Dict[str, List[float]] = {k: [] for k in joint_keys}
    timestamps: List[int] = []
    velocities: List[float] = []
    prev_angle = None
    prev_ts = None

    for frame in segment:
        jc = frame.get("joint_coordinates") or {}
        ts = frame.get("timestamp_millis") or 0
        timestamps.append(ts)
        for key in joint_keys:
            joint_angles[key].append(_joint_angle(jc, key))

        primary = joint_keys[0]
        angle = joint_angles[primary][-1] if joint_angles[primary] else 0
        if prev_angle is not None and prev_ts is not None:
            dt = (ts - prev_ts) / 1000.0
            if dt > 0.01:
                velocities.append(abs(angle - prev_angle) / dt)
        prev_angle = angle
        prev_ts = ts

    duration_ms = timestamps[-1] - timestamps[0] if len(timestamps) > 1 else 0
    primary = joint_keys[0]
    angles = joint_angles.get(primary, [0])
    rom = max(angles) - min(angles) if angles else 0
    avg_vel = sum(velocities) / len(velocities) if velocities else 0
    variance = 0.0
    if len(angles) > 1:
        mean_a = sum(angles) / len(angles)
        variance = sum((a - mean_a) ** 2 for a in angles) / len(angles)

    symmetry = 100.0
    if "knee_l" in joint_angles and "knee_r" in joint_angles:
        kl, kr = joint_angles["knee_l"], joint_angles["knee_r"]
        if kl and kr:
            symmetry = max(0, 100 - abs(sum(kl) / len(kl) - sum(kr) / len(kr)) * 2)

    per_joint_rom: Dict[str, float] = {}
    per_joint_variance: Dict[str, float] = {}
    for key in joint_keys:
        vals = joint_angles.get(key, [])
        if vals:
            per_joint_rom[key] = round(max(vals) - min(vals), 1)
            if len(vals) > 1:
                m = sum(vals) / len(vals)
                per_joint_variance[key] = round(sum((v - m) ** 2 for v in vals) / len(vals), 2)

    return {
        "duration_ms": duration_ms,
        "rom": round(rom, 1),
        "avg_velocity": round(avg_vel, 1),
        "angle_variance": round(variance, 2),
        "symmetry": round(symmetry, 1),
        "per_joint_rom": per_joint_rom,
        "per_joint_variance": per_joint_variance,
    }


def _compute_fatigue(
    rep_metrics_list: List[Dict[str, Any]], joint_keys: List[str]
) -> Dict[str, Any]:
    if not rep_metrics_list:
        return {
            "overall_score": 0,
            "fatigue_onset_rep": None,
            "most_tiring_joint": None,
            "per_rep": [],
            "joint_summary": {},
        }

    baseline = rep_metrics_list[0]
    per_rep: List[Dict[str, Any]] = []
    joint_fatigue_totals: Dict[str, float] = {k: 0.0 for k in joint_keys}
    onset_rep = None

    for idx, metrics in enumerate(rep_metrics_list):
        rep_num = idx + 1
        if idx == 0:
            fatigue_score = 0.0
            joint_scores = {k: 0.0 for k in joint_keys}
        else:
            rom_drop = 0.0
            if baseline.get("rom", 0) > 0:
                rom_drop = max(0, (baseline["rom"] - metrics.get("rom", 0)) / baseline["rom"] * 40)

            vel_increase = 0.0
            base_vel = baseline.get("avg_velocity", 0) or 1
            vel_ratio = metrics.get("avg_velocity", 0) / base_vel
            if vel_ratio > 1.1:
                vel_increase = min(20, (vel_ratio - 1) * 30)
            var_increase = 0.0
            if baseline.get("angle_variance", 0) > 0:
                var_ratio = metrics.get("angle_variance", 0) / max(0.1, baseline["angle_variance"])
                var_increase = min(15, max(0, (var_ratio - 1) * 15))

            sym_drop = max(0, (baseline.get("symmetry", 100) - metrics.get("symmetry", 100)) * 0.3)

            dur_increase = 0.0
            base_dur = baseline.get("duration_ms", 0) or 1
            if metrics.get("duration_ms", 0) > base_dur * 1.15:
                dur_increase = min(10, (metrics["duration_ms"] / base_dur - 1) * 20)

            fatigue_score = round(min(100, rom_drop + vel_increase + var_increase + sym_drop + dur_increase), 1)

            joint_scores = {}
            for key in joint_keys:
                base_rom = baseline.get("per_joint_rom", {}).get(key, 0) or 1
                cur_rom = metrics.get("per_joint_rom", {}).get(key, 0)
                jfat = max(0, min(100, (base_rom - cur_rom) / base_rom * 100))
                base_var = baseline.get("per_joint_variance", {}).get(key, 0) or 0.1
                cur_var = metrics.get("per_joint_variance", {}).get(key, 0)
                jfat += max(0, min(30, (cur_var / base_var - 1) * 15)) if idx > 0 else 0
                joint_scores[key] = round(jfat, 1)
                joint_fatigue_totals[key] += jfat

        if onset_rep is None and fatigue_score > 35 and rep_num > 1:
            onset_rep = rep_num

        per_rep.append({
            "rep": rep_num,
            "fatigue_score": fatigue_score,
            "joints": joint_scores,
            "rom": metrics.get("rom", 0),
            "duration_ms": metrics.get("duration_ms", 0),
            "symmetry": metrics.get("symmetry", 100),
        })

    overall = round(sum(r["fatigue_score"] for r in per_rep) / len(per_rep), 1) if per_rep else 0
    most_tiring = max(joint_fatigue_totals, key=joint_fatigue_totals.get) if joint_fatigue_totals else None

    joint_summary = {}
    for key, total in joint_fatigue_totals.items():
        peak_rep = 1
        peak_val = 0.0
        for r in per_rep:
            jv = r.get("joints", {}).get(key, 0)
            if jv > peak_val:
                peak_val = jv
                peak_rep = r["rep"]
        joint_summary[key] = {
            "avg_fatigue": round(total / max(1, len(per_rep)), 1),
            "peak_rep": peak_rep,
            "peak_fatigue": round(peak_val, 1),
        }

    return {
        "overall_score": overall,
        "fatigue_onset_rep": onset_rep,
        "most_tiring_joint": most_tiring,
        "per_rep": per_rep,
        "joint_summary": joint_summary,
    }


def _semantic_joint_metrics(frames: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not frames:
        return {}

    torso_leans: List[float] = []
    knee_valgus: List[float] = []
    foot_widths: List[float] = []
    hand_heights: List[float] = []

    for frame in frames:
        jc = frame.get("joint_coordinates") or {}
        s_l, s_r = jc.get("shoulder_l"), jc.get("shoulder_r")
        h_l, h_r = jc.get("hip_l"), jc.get("hip_r")
        k_l, k_r = jc.get("knee_l"), jc.get("knee_r")
        a_l, a_r = jc.get("ankle_l"), jc.get("ankle_r")
        w_l, w_r = jc.get("wrist_l"), jc.get("wrist_r")

        if s_l and h_l:
            dy = abs(s_l[1] - h_l[1])
            dx = abs(s_l[0] - h_l[0])
            torso_leans.append(math.atan2(dx, dy) * 180 / math.pi if dy > 0 else 0)
        if k_l and a_l and h_l:
            knee_valgus.append(abs(k_l[0] - a_l[0]) * 100)
        if h_l and h_r and a_l and a_r:
            hip_w = abs(h_l[0] - h_r[0]) or 0.01
            foot_widths.append(abs(a_l[0] - a_r[0]) / hip_w)
        if w_l and h_l:
            hand_heights.append(w_l[1] - h_l[1])

    def summarize(vals: List[float], unit: str) -> Dict[str, Any]:
        if not vals:
            return {"avg": 0, "min": 0, "max": 0, "unit": unit}
        return {
            "avg": round(sum(vals) / len(vals), 2),
            "min": round(min(vals), 2),
            "max": round(max(vals), 2),
            "unit": unit,
        }

    return {
        "torso_lean": summarize(torso_leans, "deg"),
        "knee_valgus": summarize(knee_valgus, "ratio"),
        "foot_width_ratio": summarize(foot_widths, "ratio"),
        "hand_height": summarize(hand_heights, "ratio"),
        "implement_path": _implement_path_metrics(frames),
    }


def _implement_path_metrics(frames: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Wrist-proxy bar/dumbbell path tracking from vertical wrist displacement."""
    wrist_heights_l: List[float] = []
    wrist_heights_r: List[float] = []
    wrist_spread: List[float] = []

    for frame in frames:
        jc = frame.get("joint_coordinates") or {}
        w_l, w_r = jc.get("wrist_l"), jc.get("wrist_r")
        h_l, h_r = jc.get("hip_l"), jc.get("hip_r")
        s_l, s_r = jc.get("shoulder_l"), jc.get("shoulder_r")

        if w_l and h_l:
            wrist_heights_l.append(h_l[1] - w_l[1])
        if w_r and h_r:
            wrist_heights_r.append(h_r[1] - w_r[1])
        if w_l and w_r:
            wrist_spread.append(abs(w_l[0] - w_r[0]))

    def summarize_vals(vals: List[float]) -> Dict[str, float]:
        if not vals:
            return {"avg": 0, "min": 0, "max": 0, "variance": 0}
        mean = sum(vals) / len(vals)
        variance = sum((v - mean) ** 2 for v in vals) / len(vals) if len(vals) > 1 else 0
        return {
            "avg": round(mean, 3),
            "min": round(min(vals), 3),
            "max": round(max(vals), 3),
            "variance": round(variance, 4),
        }

    left = summarize_vals(wrist_heights_l)
    right = summarize_vals(wrist_heights_r)
    spread = summarize_vals(wrist_spread)

    implement_type = "bar_proxy"
    if spread["avg"] > 0.25:
        implement_type = "dumbbell_proxy"

    return {
        "implement_type": implement_type,
        "wrist_path_left": left,
        "wrist_path_right": right,
        "grip_width_ratio": spread,
        "peak_height_delta": round(max(left["max"], right["max"]) - min(left["min"], right["min"]), 3),
    }


def _pace_metrics(rep_metrics_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not rep_metrics_list:
        return {}
    durations = [m.get("duration_ms", 0) for m in rep_metrics_list]
    avg_ms = sum(durations) / len(durations) if durations else 0
    return {
        "rep_duration_ms": {"avg": round(avg_ms), "min": min(durations), "max": max(durations)},
        "tempo_ratio": round(max(durations) / max(1, min(durations)), 2) if durations else 1.0,
        "rep_count": len(rep_metrics_list),
    }


def _rotation_metrics(frames: List[Dict[str, Any]]) -> Dict[str, Any]:
    hip_angles: List[float] = []
    shoulder_angles: List[float] = []

    for frame in frames:
        jc = frame.get("joint_coordinates") or {}
        h_l, h_r = jc.get("hip_l"), jc.get("hip_r")
        s_l, s_r = jc.get("shoulder_l"), jc.get("shoulder_r")
        if h_l and h_r:
            hip_angles.append(math.atan2(h_r[1] - h_l[1], h_r[0] - h_l[0]) * 180 / math.pi)
        if s_l and s_r:
            shoulder_angles.append(math.atan2(s_r[1] - s_l[1], s_r[0] - s_l[0]) * 180 / math.pi)

    def drift(vals: List[float]) -> float:
        if len(vals) < 2:
            return 0.0
        return round(max(vals) - min(vals), 1)

    return {
        "hip_rotation_drift_deg": drift(hip_angles),
        "shoulder_rotation_drift_deg": drift(shoulder_angles),
    }


def compute_extended_metrics(
    frames: List[Dict[str, Any]],
    exercise_name: str = "",
) -> Dict[str, Any]:
    """Full extended metric bundle for session storage."""
    joint_type = _infer_joint_type(exercise_name)
    joint_keys = _primary_joint_keys(joint_type)
    rep_bounds = _detect_rep_boundaries(frames, joint_type)

    rep_metrics_list = [
        _rep_metrics(frames, start, end, joint_keys) for start, end in rep_bounds
    ]

    fatigue = _compute_fatigue(rep_metrics_list, joint_keys)

    return {
        "joint_metrics": _semantic_joint_metrics(frames),
        "pace": _pace_metrics(rep_metrics_list),
        "rotation": _rotation_metrics(frames),
        "fatigue": fatigue,
        "repetitions_detected": len(rep_bounds),
    }
