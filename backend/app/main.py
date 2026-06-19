from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router

# Seed default exercises and rules
def seed_default_exercises_and_rules():
    from app.core.database import SessionLocal
    from app.models.models import Exercise, ExerciseRule
    
    db = SessionLocal()
    try:
        # Check if exercises already exist. If empty, seed defaults.
        if db.query(Exercise).count() == 0:
            print("Database has no exercises. Seeding defaults...")
            
            # 1. Shoulder Raise
            shoulder_raise = Exercise(
                name="Shoulder Raise",
                description="Raise arm upwards to measure shoulder range of motion.",
                instructions="Stand straight, lift arm slowly to the front/side, keep elbow straight, reach target angle, return.",
                target_rom=150.0,
                thumbnail_url="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=150",
                target_joints={"list": ["Shoulder R"]}
            )
            db.add(shoulder_raise)
            db.flush()
            
            sr_rule = ExerciseRule(
                exercise_id=shoulder_raise.id,
                rule_name="Shoulder Raise Target ROM",
                rule_type="threshold_comparison",
                parameters={"joint": "shoulder", "side": "right", "parameter": "angle", "operator": ">=", "value": 150.0},
                status_on_success="success",
                status_on_fail="warning"
            )
            db.add(sr_rule)
            
            # Also seed Shoulder Abduction since the patient dashboard mock matches this name
            shoulder_abduction = Exercise(
                name="Shoulder Abduction",
                description="Raise arm sideways to measure shoulder flexibility.",
                instructions="Stand straight, lift arm slowly to the side, keep elbow straight, repeat.",
                target_rom=120.0,
                thumbnail_url="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=150",
                target_joints={"list": ["Shoulder R"]}
            )
            db.add(shoulder_abduction)
            db.flush()
            
            sa_rule = ExerciseRule(
                exercise_id=shoulder_abduction.id,
                rule_name="Shoulder Abduction Target ROM",
                rule_type="threshold_comparison",
                parameters={"joint": "shoulder", "side": "right", "parameter": "angle", "operator": ">=", "value": 120.0},
                status_on_success="success",
                status_on_fail="warning"
            )
            db.add(sa_rule)

            # 2. Elbow Flexion
            elbow_flexion = Exercise(
                name="Elbow Flexion",
                description="Bend arm at the elbow to test range of motion.",
                instructions="Hold weights, lift forearm upwards, bend elbow fully, return to start.",
                target_rom=135.0,
                thumbnail_url="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=150",
                target_joints={"list": ["Elbow R"]}
            )
            db.add(elbow_flexion)
            db.flush()
            
            ef_rule = ExerciseRule(
                exercise_id=elbow_flexion.id,
                rule_name="Elbow Flexion ROM Target",
                rule_type="threshold_comparison",
                parameters={"joint": "elbow", "side": "right", "parameter": "angle", "operator": "<=", "value": 55.0},
                status_on_success="success",
                status_on_fail="warning"
            )
            db.add(ef_rule)
            
            # 3. Knee Extension
            knee_extension = Exercise(
                name="Knee Extension",
                description="Straighten leg from sitting position to trace knee angles.",
                instructions="Sit on a chair, slowly lift leg straight out, hold, return.",
                target_rom=90.0,
                thumbnail_url="https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=150",
                target_joints={"list": ["Knee R"]}
            )
            db.add(knee_extension)
            db.flush()
            
            ke_rule = ExerciseRule(
                exercise_id=knee_extension.id,
                rule_name="Knee Extension ROM Target",
                rule_type="threshold_comparison",
                parameters={"joint": "knee", "side": "right", "parameter": "angle", "operator": ">=", "value": 140.0},
                status_on_success="success",
                status_on_fail="warning"
            )
            db.add(ke_rule)
            
            db.commit()
            print("Successfully seeded exercises and rules.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {str(e)}")
    finally:
        db.close()

# Auto-create tables for local/dev environments.
# In production, Alembic migrations should be used.
try:
    Base.metadata.create_all(bind=engine)
    seed_default_exercises_and_rules()
except Exception as e:
    print(f"Database table generation deferred or failed: {str(e)}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Chosen Motion API - Advanced clinical motion tracking coordinate sync service.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# CORS middleware configuration
# Adjust origins based on settings.ENVIRONMENT in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/")
def read_root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "docs_url": "/docs",
        "api_prefix": settings.API_V1_STR
    }

# Health check
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "healthy"}

# Include api v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Register the motion capture storage router directly at the root level
from app.api.v1.endpoints.motion_storage import router as motion_storage_router
app.include_router(motion_storage_router, prefix="/motion-session", tags=["Motion Capture Storage"])

