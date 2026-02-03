"""API Configuration using pydantic-settings"""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings

# 프로젝트 루트 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class Settings(BaseSettings):
    """API 설정"""
    # App
    APP_NAME: str = "WorkProof Chain API"
    DEBUG: bool = False

    # Database (PostgreSQL)
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/workproof"

    # Legacy SQLite (deprecated)
    DB_PATH: str = "data/workproof.db"

    # JWT
    JWT_SECRET: str = "workproof_jwt_secret_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7일

    # Telegram
    ADMIN_BOT_TOKEN: str = ""
    WORKER_BOT_TOKEN: str = ""
    WORKER_BOT_USERNAME: str = ""
    ADMIN_TELEGRAM_IDS: str = ""

    # Blockchain
    POLYGON_RPC_URL: str = "https://rpc-amoy.polygon.technology"
    POLYGON_PRIVATE_KEY: str = ""
    CONTRACT_ADDRESS: str = ""
    CHAIN_ID: int = 80002

    # Security
    SALT_SECRET: str = ""

    # Email (SMTP)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "WorkProof"
    EMAIL_VERIFICATION_EXPIRE_MINUTES: int = 3

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3001",
        "*"  # 개발 환경용 - 프로덕션에서는 제거 필요
    ]

    @property
    def db_full_path(self) -> str:
        """DB 전체 경로 반환"""
        return os.path.join(BASE_DIR, self.DB_PATH)

    @property
    def admin_ids(self) -> list[int]:
        """관리자 ID 목록"""
        if not self.ADMIN_TELEGRAM_IDS:
            return []
        return [int(x.strip()) for x in self.ADMIN_TELEGRAM_IDS.split(",") if x.strip()]

    class Config:
        env_file = os.path.join(BASE_DIR, "config/.env")
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """설정 싱글톤"""
    return Settings()
