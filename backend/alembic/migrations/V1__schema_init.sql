-- Chosen Motion PostgreSQL Schema Initialization Migration
-- Date: 2026-06-10

-- 1. Users table (linked to Supabase identity ids)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'patient')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Patients table (sub-profile referencing users)
CREATE TABLE IF NOT EXISTS patients (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    phone VARCHAR(50),
    is_archived BOOLEAN DEFAULT FALSE NOT NULL
);

-- 3. Consents table
CREATE TABLE IF NOT EXISTS consents (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    consent_level VARCHAR(100) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Exercises catalog
CREATE TABLE IF NOT EXISTS exercises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    target_rom FLOAT,
    thumbnail_url VARCHAR(500),
    target_joints JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 5. Exercise assignments from Clinicians (Admins) to Patients
CREATE TABLE IF NOT EXISTS exercise_assignments (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    assigned_by VARCHAR(255) REFERENCES users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    due_date DATE,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL
);

-- 6. Motion sessions recorded by patients
CREATE TABLE IF NOT EXISTS motion_sessions (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(255) NOT NULL REFERENCES patients(user_id) ON DELETE CASCADE,
    exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    score NUMERIC(5, 2),
    status VARCHAR(50)
);

-- 7. Motion capture coordinate metrics
CREATE TABLE IF NOT EXISTS motion_metrics (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES motion_sessions(id) ON DELETE CASCADE,
    rom FLOAT, -- Range of Motion
    speed FLOAT,
    symmetry FLOAT,
    telemetry_frames JSONB -- Coordinate data arrays
);

-- 8. Website content editor storage
CREATE TABLE IF NOT EXISTS website_content (
    id SERIAL PRIMARY KEY,
    page_key VARCHAR(100) UNIQUE NOT NULL,
    content_data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. General application settings
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 10. Exercise rules definitions
CREATE TABLE IF NOT EXISTS exercise_rules (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL,
    status_on_success VARCHAR(50) DEFAULT 'success' NOT NULL,
    status_on_fail VARCHAR(50) DEFAULT 'warning' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Optimization Indices
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_consents_patient_id ON consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_assignments_patient_id ON exercise_assignments(patient_id);
CREATE INDEX IF NOT EXISTS idx_sessions_patient_id ON motion_sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_metrics_session_id ON motion_metrics(session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_rules_exercise_id ON exercise_rules(exercise_id);
