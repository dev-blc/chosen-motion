import sys
from app.core.database import SessionLocal
from app.models.models import User, Patient
from app.schemas.schemas import SessionCreate, SessionResponse
from app.core.security import UserPayload
from app.api.v1.endpoints.patients import upload_motion_session

def run_direct_test():
    db = SessionLocal()
    try:
        # Check or create user
        user = db.query(User).filter(User.email == "test_patient@chosenmotion.com").first()
        if not user:
            import uuid
            user = User(
                id=uuid.uuid4(),
                auth_user_id=uuid.uuid4(),
                email="test_patient@chosenmotion.com",
                role="patient"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
        patient = db.query(Patient).filter(Patient.email == user.email).first()
        if not patient:
            patient = Patient(
                patient_id="PAT-999999",
                auth_user_id=user.auth_user_id,
                email=user.email,
                full_name="Test Patient"
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)
            
        # Build payload schemas
        session_data = SessionCreate(
            title="Elbow Flexion - Test Direct Session",
            description="Test session uploads direct",
            duration_seconds=10,
            avg_score=90.0,
            range_of_motion=85.0,
            speed=15.0,
            symmetry=1.0,
            status="success",
            metrics_summary={
                "repetitions": 3,
                "final_score": 90,
                "max_rom": 85
            },
            telemetry_data=[
                {
                    "timestamp_millis": 0,
                    "joint_coordinates": {
                        "shoulder_l": [0.1, 0.2, 0.3],
                        "shoulder_r": [0.1, 0.2, 0.3],
                        "elbow_l": [0.1, 0.2, 0.3],
                        "elbow_r": [0.1, 0.2, 0.3],
                        "wrist_l": [0.1, 0.2, 0.3],
                        "wrist_r": [0.1, 0.2, 0.3],
                        "hip_l": [0.1, 0.2, 0.3],
                        "hip_r": [0.1, 0.2, 0.3],
                        "knee_l": [0.1, 0.2, 0.3],
                        "knee_r": [0.1, 0.2, 0.3],
                        "ankle_l": [0.1, 0.2, 0.3],
                        "ankle_r": [0.1, 0.2, 0.3]
                    },
                    "sensor_signals": {"framerate": 30, "confidence": 0.95}
                }
            ]
        )
        
        current_user = UserPayload(
            id=str(user.auth_user_id),
            email=user.email,
            role="patient"
        )
        
        print("Invoking upload_motion_session directly...")
        result = upload_motion_session(session_data, current_user, db)
        print("Success! Created Session ID:", result.id)
        
        # Test serialization
        print("Validating with Pydantic SessionResponse...")
        serialized = SessionResponse.model_validate(result)
        print("Serialization validated successfully!")
        print("Serialized data:", serialized.model_dump())
        
    except Exception as e:
        print(f"Error executing direct test: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_direct_test()
