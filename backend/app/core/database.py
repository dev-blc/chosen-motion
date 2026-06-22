
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from typing import Generator
from app.core.config import settings

# Adjust sqlite compatibility for testing if database_url starts with sqlite
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}
print(settings.DATABASE_URL)
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db() -> Generator:
    """
    Dependency to get a database session.
    Yields a session, ensuring it's closed after usage.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
