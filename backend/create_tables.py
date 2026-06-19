from sqlalchemy import create_engine
from app.core.database import engine, Base
# Import all models to register them with SQLAlchemy Base
from app.models.models import (
    User, 
    Patient, 
    Consent, 
    Exercise, 
    ExerciseAssignment, 
    MotionSession, 
    MotionFrame, 
    WebsiteContent, 
    Settings, 
    ExerciseRule
)

try:
    print(f"Attempting to create tables on database URL...")
    Base.metadata.create_all(bind=engine)
    print("All database tables created successfully on primary database.")
except Exception as e:
    print(f"Primary database connection failed: {e}")
    print("Falling back to local SQLite database (test.db)...")
    fallback_engine = create_engine("sqlite:///./test.db", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=fallback_engine)
    print("All database tables created successfully in local SQLite fallback.")