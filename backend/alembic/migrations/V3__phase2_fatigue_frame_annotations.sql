-- Phase 2: fatigue metrics and clinician frame annotations

ALTER TABLE motion_metrics ADD COLUMN IF NOT EXISTS fatigue JSONB;

CREATE TABLE IF NOT EXISTS session_frame_annotations (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES motion_sessions(id) ON DELETE CASCADE,
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    issue_tags JSONB,
    notes VARCHAR(4000),
    suggestions VARCHAR(4000),
    created_by VARCHAR(255),
    visible_to_patient BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frame_annotations_session ON session_frame_annotations(session_id);
CREATE INDEX IF NOT EXISTS idx_frame_annotations_patient ON session_frame_annotations(patient_id);
