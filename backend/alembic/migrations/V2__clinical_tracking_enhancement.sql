-- Clinical tracking enhancement schema (Phase 1)

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS capture_config JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS metric_definitions JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS guide_content JSONB;

ALTER TABLE exercise_assignments ADD COLUMN IF NOT EXISTS config JSONB;

ALTER TABLE motion_sessions ADD COLUMN IF NOT EXISTS assignment_id INTEGER REFERENCES exercise_assignments(id) ON DELETE SET NULL;
ALTER TABLE motion_sessions ADD COLUMN IF NOT EXISTS capture_config_snapshot JSONB;

ALTER TABLE motion_metrics ADD COLUMN IF NOT EXISTS joint_metrics JSONB;
ALTER TABLE motion_metrics ADD COLUMN IF NOT EXISTS pace JSONB;
ALTER TABLE motion_metrics ADD COLUMN IF NOT EXISTS rotation JSONB;

CREATE TABLE IF NOT EXISTS muscle_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    body_region VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    muscle_group_id INTEGER NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'primary'
);

CREATE TABLE IF NOT EXISTS patient_limitations (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    scope_type VARCHAR(50) NOT NULL,
    scope_id INTEGER,
    limitation_type VARCHAR(100) NOT NULL,
    parameters JSONB NOT NULL DEFAULT '{}',
    notes VARCHAR(2000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS environment_components (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    icon_url VARCHAR(500),
    setup_instructions VARCHAR(2000),
    affects_tracking BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_environment_requirements (
    id SERIAL PRIMARY KEY,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    component_id INTEGER NOT NULL REFERENCES environment_components(id) ON DELETE CASCADE,
    required BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB
);

CREATE TABLE IF NOT EXISTS session_environments (
    id SERIAL PRIMARY KEY,
    session_id INTEGER UNIQUE NOT NULL REFERENCES motion_sessions(id) ON DELETE CASCADE,
    declared_components JSONB,
    noise_level INTEGER,
    mirror_present BOOLEAN,
    other_users_present BOOLEAN,
    environment_score FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_exercise_records (
    id SERIAL PRIMARY KEY,
    patient_id VARCHAR(50) NOT NULL REFERENCES patients(patient_id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    best_session_id INTEGER REFERENCES motion_sessions(id) ON DELETE SET NULL,
    best_metrics JSONB,
    best_recorded_at TIMESTAMPTZ,
    worst_session_id INTEGER REFERENCES motion_sessions(id) ON DELETE SET NULL,
    worst_metrics JSONB,
    worst_recorded_at TIMESTAMPTZ,
    metric_keys JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(patient_id, exercise_id)
);
