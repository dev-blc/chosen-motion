from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Chosen Motion"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database Settings
    DATABASE_URL: str = "postgresql://postgres:postgrespassword@localhost:5432/chosen_motion"

    # Supabase Settings (Auth)
    SUPABASE_URL: str
    SUPABASE_JWT_SECRET: str

    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
