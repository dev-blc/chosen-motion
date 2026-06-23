import os
import sys
sys.path.insert(0, r"d:\Works\Motion_tracking\backend")

from sqlalchemy import text
from app.core.database import engine

def apply_migrations():
    dialect_name = engine.dialect.name
    print(f"Applying migrations for dialect: {dialect_name}")

    if dialect_name != "postgresql":
        print("Database is not PostgreSQL. Skipping Supabase RLS and PG function migrations.")
        return

    statements = [
        # 1. Create helper functions
        """
        CREATE OR REPLACE FUNCTION public.is_admin()
        RETURNS boolean AS $$
        BEGIN
          RETURN (
            coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role', '') = 'admin'
            OR coalesce(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role', '') = 'admin'
          );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """,
        
        """
        CREATE OR REPLACE FUNCTION public.get_current_patient_id()
        RETURNS varchar AS $$
        DECLARE
          p_id varchar;
        BEGIN
          SELECT patient_id INTO p_id
          FROM public.patients
          WHERE auth_user_id = auth.uid();
          RETURN p_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
        """,

        # 2. Add columns to motion_metrics
        "ALTER TABLE public.motion_metrics ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50);",
        
        # 3. Populate patient_id in motion_metrics
        """
        UPDATE public.motion_metrics m 
        SET patient_id = s.patient_id 
        FROM public.motion_sessions s 
        WHERE m.session_id = s.id AND m.patient_id IS NULL;
        """,
        
        # 4. Fill in placeholder for any remaining nulls (safety fallback)
        "UPDATE public.motion_metrics SET patient_id = 'SYSTEM' WHERE patient_id IS NULL;",
        
        # 5. Set patient_id to NOT NULL
        "ALTER TABLE public.motion_metrics ALTER COLUMN patient_id SET NOT NULL;",

        # 6. Add constraints if not already exists (safely drop first or try/catch)
        """
        ALTER TABLE public.motion_metrics 
        DROP CONSTRAINT IF EXISTS fk_motion_metrics_patient_id,
        ADD CONSTRAINT fk_motion_metrics_patient_id FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
        """,

        # 7. Add constraints to motion_frames
        """
        ALTER TABLE public.motion_frames 
        DROP CONSTRAINT IF EXISTS fk_motion_frames_patient_id,
        ADD CONSTRAINT fk_motion_frames_patient_id FOREIGN KEY (patient_id) REFERENCES public.patients(patient_id) ON DELETE CASCADE;
        """,
        
        """
        ALTER TABLE public.motion_frames 
        DROP CONSTRAINT IF EXISTS fk_motion_frames_session_id,
        ADD CONSTRAINT fk_motion_frames_session_id FOREIGN KEY (session_id) REFERENCES public.motion_sessions(id) ON DELETE CASCADE;
        """,

        # 8. Enable Row Level Security (RLS)
        "ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;",
        "ALTER TABLE public.motion_sessions ENABLE ROW LEVEL SECURITY;",
        "ALTER TABLE public.motion_metrics ENABLE ROW LEVEL SECURITY;",
        "ALTER TABLE public.motion_frames ENABLE ROW LEVEL SECURITY;",
        "ALTER TABLE public.exercise_assignments ENABLE ROW LEVEL SECURITY;",
        "ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;",
        "ALTER TABLE public.progress_reports ENABLE ROW LEVEL SECURITY;",

        # 9. Define policies
        # Patients table policy
        "DROP POLICY IF EXISTS patients_policy ON public.patients;",
        """
        CREATE POLICY patients_policy ON public.patients
          FOR ALL
          USING (public.is_admin() OR auth.uid() = auth_user_id)
          WITH CHECK (public.is_admin() OR auth.uid() = auth_user_id);
        """,

        # Motion sessions table policy
        "DROP POLICY IF EXISTS motion_sessions_policy ON public.motion_sessions;",
        """
        CREATE POLICY motion_sessions_policy ON public.motion_sessions
          FOR ALL
          USING (public.is_admin() OR patient_id = public.get_current_patient_id())
          WITH CHECK (public.is_admin() OR patient_id = public.get_current_patient_id());
        """,

        # Motion metrics table policy
        "DROP POLICY IF EXISTS motion_metrics_policy ON public.motion_metrics;",
        """
        CREATE POLICY motion_metrics_policy ON public.motion_metrics
          FOR ALL
          USING (public.is_admin() OR patient_id = public.get_current_patient_id())
          WITH CHECK (public.is_admin() OR patient_id = public.get_current_patient_id());
        """,

        # Motion frames table policy
        "DROP POLICY IF EXISTS motion_frames_policy ON public.motion_frames;",
        """
        CREATE POLICY motion_frames_policy ON public.motion_frames
          FOR ALL
          USING (public.is_admin() OR patient_id = public.get_current_patient_id())
          WITH CHECK (public.is_admin() OR patient_id = public.get_current_patient_id());
        """,

        # Exercise assignments table policy
        "DROP POLICY IF EXISTS exercise_assignments_policy ON public.exercise_assignments;",
        """
        CREATE POLICY exercise_assignments_policy ON public.exercise_assignments
          FOR ALL
          USING (public.is_admin() OR patient_id = public.get_current_patient_id())
          WITH CHECK (public.is_admin() OR patient_id = public.get_current_patient_id());
        """,

        # Consents table policy
        "DROP POLICY IF EXISTS consents_policy ON public.consents;",
        """
        CREATE POLICY consents_policy ON public.consents
          FOR ALL
          USING (public.is_admin() OR patient_id = public.get_current_patient_id())
          WITH CHECK (public.is_admin() OR patient_id = public.get_current_patient_id());
        """,

        # Progress reports table policy
        "DROP POLICY IF EXISTS progress_reports_policy ON public.progress_reports;",
        """
        CREATE POLICY progress_reports_policy ON public.progress_reports
          FOR ALL
          USING (public.is_admin() OR patient_id = public.get_current_patient_id())
          WITH CHECK (public.is_admin() OR patient_id = public.get_current_patient_id());
        """
    ]

    with engine.connect() as conn:
        for stmt in statements:
            stmt_clean = stmt.strip()
            if not stmt_clean:
                continue
            try:
                conn.execute(text(stmt_clean))
                conn.commit()
                # Print single line preview
                first_line = stmt_clean.split("\n")[0][:60]
                print(f"Executed: {first_line}...")
            except Exception as e:
                print(f"Failed to execute statement: {stmt_clean}\nError: {e}")
                sys.exit(1)

if __name__ == "__main__":
    apply_migrations()
    print("Database migrations applied successfully!")
