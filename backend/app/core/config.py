from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://agentguard:agentguard_secret@localhost:5432/agentguard"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Clerk
    CLERK_SECRET_KEY: str = ""
    CLERK_PUBLISHABLE_KEY: str = ""

    # Google AI
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash-exp"

    # Arize Phoenix
    PHOENIX_ENDPOINT: str = "http://localhost:6006"
    PHOENIX_API_KEY: str = ""
    PHOENIX_SPACE_ID: str = ""
    PHOENIX_PROJECT_NAME: str = "agentguard"

    # Slack (for autonomous notifications)
    SLACK_WEBHOOK_URL: str = ""
    SLACK_ENABLED: bool = False

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    # Celery
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # LangGraph
    LANGGRAPH_ENABLED: bool = True
    INVESTIGATION_TIMEOUT_SECONDS: int = 60

    # ML Prediction
    PREDICTION_MIN_DATAPOINTS: int = 10

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
