"""FastAPI Main Application"""
import os
from pathlib import Path
from dotenv import load_dotenv

# 환경변수 로드 (블록체인 모듈에서 os.getenv 사용)
env_path = Path(__file__).parent.parent.parent / "config" / ".env"
load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import auth, workers, events, applications, attendance, chain, admin, notifications, credits, email, bigdata

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="WorkProof Chain v2 REST API - 근무이력 증명 시스템",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 라우터 등록
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(workers.router, prefix="/api/workers", tags=["Workers"])
app.include_router(events.router, prefix="/api/events", tags=["Events"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(attendance.router, prefix="/api/attendance", tags=["Attendance"])
app.include_router(chain.router, prefix="/api/chain", tags=["Blockchain"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(credits.router, prefix="/api/credits", tags=["Credits"])
app.include_router(email.router, prefix="/api/email", tags=["Email Verification"])
app.include_router(bigdata.router, prefix="/api", tags=["BigData Analytics"])


@app.get("/", tags=["Root"])
async def root():
    """API 상태 확인"""
    return {
        "name": settings.APP_NAME,
        "version": "2.0.0",
        "status": "running"
    }


@app.get("/health", tags=["Root"])
async def health_check():
    """헬스 체크"""
    return {"status": "healthy"}
