import sys
from sqlalchemy import text
from app.core.database import engine

def sync():
    statements = [
        # motion_frames alterations
        ("ALTER TABLE motion_frames ADD COLUMN frame_number INTEGER DEFAULT 0 NOT NULL", "frame_number"),
        
        # motion_metrics alterations
        ("ALTER TABLE motion_metrics ADD COLUMN smoothness FLOAT", "smoothness"),
        ("ALTER TABLE motion_metrics ADD COLUMN repetitions INTEGER", "repetitions"),
        ("ALTER TABLE motion_metrics ADD COLUMN accuracy_score FLOAT", "accuracy_score"),
        ("ALTER TABLE motion_metrics ADD COLUMN detected_errors JSON", "detected_errors"),
        ("ALTER TABLE motion_metrics ADD COLUMN max_rom FLOAT", "max_rom"),
        ("ALTER TABLE motion_metrics ADD COLUMN joint_metrics JSON", "joint_metrics"),
        ("ALTER TABLE motion_metrics ADD COLUMN pace JSON", "pace"),
        ("ALTER TABLE motion_metrics ADD COLUMN rotation JSON", "rotation"),
        ("ALTER TABLE motion_metrics ADD COLUMN fatigue JSON", "fatigue"),
        ("ALTER TABLE exercises ADD COLUMN capture_config JSON", "capture_config"),
        ("ALTER TABLE exercises ADD COLUMN metric_definitions JSON", "metric_definitions"),
        ("ALTER TABLE exercises ADD COLUMN guide_content JSON", "guide_content"),
        ("ALTER TABLE exercise_assignments ADD COLUMN config JSON", "assignment_config"),
        ("ALTER TABLE motion_sessions ADD COLUMN assignment_id INTEGER", "assignment_id"),
        ("ALTER TABLE motion_sessions ADD COLUMN capture_config_snapshot JSON", "capture_config_snapshot"),
    ]
    
    with engine.connect() as conn:
        # Check if database is SQLite or Postgres
        dialect_name = engine.dialect.name
        print(f"Syncing columns for dialect: {dialect_name}")
        
        for sql, col_name in statements:
            try:
                # To be DB-agnostic, we run alter. If it fails (because column exists), we catch the error
                conn.execute(text(sql))
                conn.commit()
                print(f"Successfully added column: {col_name}")
            except Exception as e:
                # Typically fails if column already exists, which is fine
                print(f"Skipped adding column {col_name} (may already exist)")
                
if __name__ == "__main__":
    sync()
    print("Database sync complete.")
