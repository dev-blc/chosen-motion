import math
from typing import List, Dict, Any, Tuple

def calculate_angle(a: List[float], b: List[float], c: List[float]) -> float:
    """
    Calculate the angle at joint b formed by points a-b-c.
    Coordinates are [x, y, z] or [x, y].
    """
    if not a or not b or not c or len(a) < 2 or len(b) < 2 or len(c) < 2:
        return 0.0
    ba_x, ba_y = a[0] - b[0], a[1] - b[1]
    bc_x, bc_y = c[0] - b[0], c[1] - b[1]
    
    dot_product = ba_x * bc_x + ba_y * bc_y
    mag_ba = math.sqrt(ba_x * ba_x + ba_y * ba_y)
    mag_bc = math.sqrt(bc_x * bc_x + bc_y * bc_y)
    
    if mag_ba == 0.0 or mag_bc == 0.0:
        return 0.0
        
    cos_angle = dot_product / (mag_ba * mag_bc)
    clamped_cos = max(-1.0, min(1.0, cos_angle))
    radians = math.acos(clamped_cos)
    return round((radians * 180.0) / math.pi, 1)

def analyze_session_frames(
    frames: List[Dict[str, Any]], 
    target_rom: float = 120.0, 
    exercise_name: str = ""
) -> Dict[str, Any]:
    """
    Analyzes telemetry frames and extracts extended metrics + errors.
    
    Returns:
    {
        "accuracy_score": float,
        "detected_errors": list,
        "smoothness": float,
        "repetitions": int,
        "max_rom": float
    }
    """
    if not frames:
        return {
            "accuracy_score": 100.0,
            "detected_errors": [],
            "smoothness": 100.0,
            "repetitions": 0,
            "max_rom": 0.0
        }
        
    # Determine joint tracking details
    exercise_lower = exercise_name.lower()
    if "shoulder" in exercise_lower:
        joint_type = "shoulder"
        target_rom = target_rom or 150.0
    elif "knee" in exercise_lower:
        joint_type = "knee"
        target_rom = target_rom or 140.0
    else:
        joint_type = "elbow"
        target_rom = target_rom or 130.0

    # Lists to store joint coordinates for analysis
    angles = []
    timestamps = []
    
    detected_errors = []
    
    # 1. First Pass: Compute joint angles and extract variables for all frames
    hip_widths = []
    valid_frames = []
    
    for frame in frames:
        jc = frame.get("joint_coordinates") or {}
        ts = frame.get("timestamp_millis") or 0
        
        # Check if we have the necessary coordinates
        s_l = jc.get("shoulder_l")
        s_r = jc.get("shoulder_r")
        e_l = jc.get("elbow_l")
        e_r = jc.get("elbow_r")
        w_l = jc.get("wrist_l")
        w_r = jc.get("wrist_r")
        h_l = jc.get("hip_l")
        h_r = jc.get("hip_r")
        k_l = jc.get("knee_l")
        k_r = jc.get("knee_r")
        a_l = jc.get("ankle_l")
        a_r = jc.get("ankle_r")
        
        if not all([s_l, s_r, e_l, e_r, h_l, h_r, k_l, k_r]):
            continue
            
        valid_frames.append(frame)
        timestamps.append(ts)
        
        # Calculate angles
        angle_l = 0.0
        angle_r = 0.0
        
        if joint_type == "shoulder":
            angle_l = calculate_angle(h_l, s_l, e_l)
            angle_r = calculate_angle(h_r, s_r, e_r)
        elif joint_type == "knee" and a_l and a_r:
            angle_l = calculate_angle(h_l, k_l, a_l)
            angle_r = calculate_angle(h_r, k_r, a_r)
        elif joint_type == "elbow" and w_l and w_r:
            angle_l = calculate_angle(s_l, e_l, w_l)
            angle_r = calculate_angle(s_r, e_r, w_r)
            
        # We track the active side (whichever achieves higher max ROM or right side default)
        # For simplicity, let's store the average or the right-side/active-side. 
        # Let's take the right side as primary, or whichever is larger.
        active_angle = max(angle_l, angle_r)
        angles.append(active_angle)
        
        # Hip width for hip rotation detection
        hip_widths.append(abs(h_l[0] - h_r[0]))
        
    if not valid_frames:
        return {
            "accuracy_score": 100.0,
            "detected_errors": [],
            "smoothness": 100.0,
            "repetitions": 0,
            "max_rom": 0.0
        }
        
    max_rom = max(angles) if angles else 0.0
    
    # 2. Shoulder Compensation (tilt > 15 degrees)
    shoulder_comp_count = 0
    in_shoulder_comp = False
    comp_start_ts = 0
    
    # 3. Torso Lean (deviation from vertical > 12 degrees)
    torso_lean_count = 0
    in_torso_lean = False
    lean_start_ts = 0
    
    # 4. Hip Rotation (hip width shrunken > 20% compared to baseline max)
    max_hip_width = max(hip_widths) if hip_widths else 0
    hip_rot_count = 0
    in_hip_rot = False
    hip_rot_start_ts = 0
    
    # 5. Fast Movement (velocity > 90 deg/s sustained for > 500ms)
    fast_move_count = 0
    fast_move_start_ts = None
    
    # Repetition Counter State Machine
    reps_count = 0
    rep_state = "extended"
    
    # Velocity lists for smoothness
    velocities = []
    
    for i in range(len(valid_frames)):
        frame = valid_frames[i]
        jc = frame.get("joint_coordinates") or {}
        ts = timestamps[i]
        angle = angles[i]
        
        s_l = jc.get("shoulder_l")
        s_r = jc.get("shoulder_r")
        h_l = jc.get("hip_l")
        h_r = jc.get("hip_r")
        
        # --- Repetition Counting ---
        if joint_type == "shoulder":
            if angle > 95 and rep_state == "extended":
                rep_state = "flexed"
            elif angle < 40 and rep_state == "flexed":
                rep_state = "extended"
                reps_count += 1
        elif joint_type == "knee":
            if angle > 140 and rep_state == "flexed":
                rep_state = "extended"
                reps_count += 1
            elif angle < 90 and rep_state == "extended":
                rep_state = "flexed"
        else: # elbow
            if angle < 55 and rep_state == "extended":
                rep_state = "flexed"
            elif angle > 130 and rep_state == "flexed":
                rep_state = "extended"
                reps_count += 1
                
        # --- Shoulder Compensation ---
        s_dy = abs(s_l[1] - s_r[1])
        s_dx = abs(s_l[0] - s_r[0])
        if s_dx > 0:
            shoulder_tilt = math.atan(s_dy / s_dx) * 180 / math.pi
            if shoulder_tilt > 15.0:
                if not in_shoulder_comp:
                    in_shoulder_comp = True
                    comp_start_ts = ts
            else:
                if in_shoulder_comp:
                    duration = ts - comp_start_ts
                    if duration >= 500: # only register if sustained for >=500ms
                        shoulder_comp_count += 1
                        detected_errors.append({
                            "type": "Shoulder Compensation",
                            "severity": "medium" if duration < 2000 else "high",
                            "timestamp_ms": comp_start_ts,
                            "description": f"Shoulder elevated by {round(shoulder_tilt, 1)}° for {round(duration/1000, 1)}s."
                        })
                    in_shoulder_comp = False
                    
        # --- Torso Lean ---
        # Angle from vertical for left and right
        l_dy = abs(s_l[1] - h_l[1])
        l_dx = abs(s_l[0] - h_l[0])
        r_dy = abs(s_r[1] - h_r[1])
        r_dx = abs(s_r[0] - h_r[0])
        
        lean_l = math.atan2(l_dx, l_dy) * 180 / math.pi if l_dy > 0 else 0
        lean_r = math.atan2(r_dx, r_dy) * 180 / math.pi if r_dy > 0 else 0
        max_lean = max(lean_l, lean_r)
        
        if max_lean > 12.0:
            if not in_torso_lean:
                in_torso_lean = True
                lean_start_ts = ts
        else:
            if in_torso_lean:
                duration = ts - lean_start_ts
                if duration >= 500:
                    torso_lean_count += 1
                    detected_errors.append({
                        "type": "Torso Lean",
                        "severity": "low" if max_lean < 18 else "medium",
                        "timestamp_ms": lean_start_ts,
                        "description": f"Torso leaned by {round(max_lean, 1)}° from vertical."
                    })
                in_torso_lean = False
                
        # --- Hip Rotation ---
        hip_w = hip_widths[i]
        if max_hip_width > 0:
            shrinkage = (max_hip_width - hip_w) / max_hip_width
            if shrinkage > 0.20:
                if not in_hip_rot:
                    in_hip_rot = True
                    hip_rot_start_ts = ts
            else:
                if in_hip_rot:
                    duration = ts - hip_rot_start_ts
                    if duration >= 500:
                        hip_rot_count += 1
                        detected_errors.append({
                            "type": "Hip Rotation",
                            "severity": "medium",
                            "timestamp_ms": hip_rot_start_ts,
                            "description": f"Hips rotated, horizontal width decreased by {round(shrinkage * 100, 1)}%."
                        })
                    in_hip_rot = False
                    
        # --- Fast Movement & Velocity ---
        if i > 0:
            dt = (ts - timestamps[i-1]) / 1000.0
            if dt > 0.01:
                da = abs(angle - angles[i-1])
                vel = da / dt
                velocities.append(vel)
                
                if vel > 90.0:
                    if fast_move_start_ts is None:
                        fast_move_start_ts = ts
                else:
                    if fast_move_start_ts is not None:
                        duration = ts - fast_move_start_ts
                        if duration >= 500:
                            fast_move_count += 1
                            detected_errors.append({
                                "type": "Fast Movement",
                                "severity": "medium" if vel < 130 else "high",
                                "timestamp_ms": fast_move_start_ts,
                                "description": f"Movement velocity reached {round(vel, 1)}°/s (limit 90°/s)."
                            })
                        fast_move_start_ts = None

    # Handle active errors at end of session
    if in_shoulder_comp and (timestamps[-1] - comp_start_ts) >= 500:
        shoulder_comp_count += 1
        detected_errors.append({
            "type": "Shoulder Compensation",
            "severity": "medium",
            "timestamp_ms": comp_start_ts,
            "description": "Shoulder elevated at session end."
        })
    if in_torso_lean and (timestamps[-1] - lean_start_ts) >= 500:
        torso_lean_count += 1
        detected_errors.append({
            "type": "Torso Lean",
            "severity": "low",
            "timestamp_ms": lean_start_ts,
            "description": "Torso lean at session end."
        })
    if in_hip_rot and (timestamps[-1] - hip_rot_start_ts) >= 500:
        hip_rot_count += 1
        detected_errors.append({
            "type": "Hip Rotation",
            "severity": "medium",
            "timestamp_ms": hip_rot_start_ts,
            "description": "Hip rotation at session end."
        })
    if fast_move_start_ts is not None and (timestamps[-1] - fast_move_start_ts) >= 500:
        fast_move_count += 1
        detected_errors.append({
            "type": "Fast Movement",
            "severity": "medium",
            "timestamp_ms": fast_move_start_ts,
            "description": "Fast movement detected at session end."
        })

    # --- Incomplete ROM ---
    if max_rom < target_rom * 0.7:
        detected_errors.append({
            "type": "Incomplete ROM",
            "severity": "high",
            "timestamp_ms": timestamps[0],
            "description": f"Maximum ROM was {round(max_rom, 1)}°, which is under 70% of target ({round(target_rom, 1)}°)."
        })
        rom_deduction = 25.0
    else:
        rom_deduction = 0.0

    # --- Smoothness Calculation ---
    # Smoothness = 100 - average velocity variations
    if len(velocities) > 1:
        vel_jitter = [abs(velocities[j] - velocities[j-1]) for j in range(1, len(velocities))]
        avg_jitter = sum(vel_jitter) / len(vel_jitter)
        smoothness = max(20.0, min(100.0, 100.0 - avg_jitter * 1.5))
    else:
        smoothness = 100.0

    # --- Accuracy Score Calculation ---
    # Start at 100, deduct based on errors
    score = 100.0
    score -= (shoulder_comp_count * 6.0)
    score -= (torso_lean_count * 5.0)
    score -= (hip_rot_count * 5.0)
    score -= (fast_move_count * 5.0)
    score -= rom_deduction
    
    accuracy_score = max(10.0, min(100.0, score))

    return {
        "accuracy_score": round(accuracy_score, 1),
        "detected_errors": detected_errors,
        "smoothness": round(smoothness, 1),
        "repetitions": reps_count,
        "max_rom": round(max_rom, 1)
    }
