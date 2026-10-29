import os
from typing import List
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "Field-to-Record Clinical NLP Engine"
    API_V1_STR: str = "/api"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./field_to_record.db")
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]
    DEFAULT_ACTOR_ID: str = os.getenv("DEFAULT_ACTOR_ID", "EMS-PARAMEDIC-01")
    DEFAULT_TIMEZONE: str = os.getenv("DEFAULT_TIMEZONE", "UTC")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    SCHEMA_VERSION: str = "1.0"

settings = Settings()
