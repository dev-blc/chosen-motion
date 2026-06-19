-- Migration V2: Skeleton Motion Storage Schema
-- Date: 2026-06-13

-- Drop existing tables to perform clean migration for the new schema
DROP TABLE IF EXISTS motion_metrics CASCADE;
DROP TABLE IF EXISTS motion_sessions CASCADE;
DROP TABLE IF EXISTS motion_frames CASCADE;

-- Recreate motion_sessions with the exact required fields
CREATE TABLE motion_sessions (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL,
    exercise_name VARCHAR(255),
    form_score FLOAT,
    rom FLOAT,
    speed FLOAT,
    symmetry FLOAT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create motion_frames with the exact required fields
CREATE TABLE motion_frames (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES motion_sessions(id) ON DELETE CASCADE,
    frame_number INTEGER NOT NULL,
    timestamp_ms INTEGER NOT NULL,
    landmarks_json JSONB NOT NULL
);

-- Optimization Indices
CREATE INDEX IF NOT EXISTS idx_motion_sessions_patient ON motion_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_motion_frames_session ON motion_frames(session_id);
