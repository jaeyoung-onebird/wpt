from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "WorkProof Chain"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ubuntu:ubuntu123@localhost:5432/workproof"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # CORS
    CORS_ORIGINS: list = ["http://localhost:3000", "http://localhost:8080"]

    # Invite
    INVITE_CODE_LENGTH: int = 8
    INVITE_EXPIRE_DAYS: int = 7

    # Trust Score
    INITIAL_TRUST_SCORE: float = 3.0
    NO_SHOW_PENALTY: float = 0.3
    LATE_PENALTY: float = 0.1
    COMPLETION_BONUS: float = 0.05

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
