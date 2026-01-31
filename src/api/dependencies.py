"""API Dependencies - DB, Auth 등의 의존성 주입"""
import sys
import os
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# 프로젝트 src 경로 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import Database
from .config import get_settings, Settings
from .auth.jwt import decode_token

security = HTTPBearer(auto_error=False)


@lru_cache()
def get_database() -> Database:
    """DB 인스턴스 싱글톤"""
    settings = get_settings()
    return Database(settings.DATABASE_URL)


def get_db() -> Database:
    """DB 의존성"""
    return get_database()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Database = Depends(get_db)
) -> dict | None:
    """현재 사용자 정보 (옵션 - 인증 없어도 None 반환)"""
    if not credentials:
        return None

    try:
        payload = decode_token(credentials.credentials)
        return payload
    except Exception:
        return None


async def require_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
) -> dict:
    """인증 필수"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="인증이 필요합니다",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(credentials.credentials)
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 토큰: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_worker(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
) -> dict:
    """등록된 근무자 필수"""
    worker = None

    # 1. telegram_id로 찾기
    telegram_id = user.get("telegram_id")
    if telegram_id:
        worker = db.get_worker_by_telegram_id(telegram_id)

    # 2. phone으로 찾기
    if not worker:
        phone = user.get("phone")
        if phone:
            worker = db.get_worker_by_phone(phone)

    # 3. user_id로 연결된 worker 찾기
    if not worker:
        user_id = user.get("user_id") or user.get("sub")
        if user_id:
            worker = db.get_worker_by_user_id(user_id)

    if not worker:
        raise HTTPException(status_code=403, detail="등록된 근무자가 아닙니다")

    return {"user": user, "worker": worker}


async def require_admin(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings)
) -> dict:
    """관리자 권한 필수"""
    telegram_id = user.get("telegram_id", 0)
    username = user.get("username", "")

    # DB에서 관리자 확인 또는 환경변수의 관리자 ID 확인 또는 이메일 관리자 확인
    is_admin = (
        db.is_admin(telegram_id) or
        telegram_id in settings.admin_ids or
        db.is_email_admin(username)
    )
    if not is_admin:
        raise HTTPException(status_code=403, detail="관리자 권한이 필요합니다")

    return user
