"""JWT Token 처리"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError

from ..config import get_settings


def create_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """
    JWT 토큰 생성

    Args:
        data: 토큰에 담을 데이터
        expires_delta: 만료 시간 (기본값: 설정의 JWT_EXPIRE_MINUTES)

    Returns:
        JWT 토큰 문자열
    """
    settings = get_settings()

    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)

    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    })

    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> dict:
    """
    JWT 토큰 검증 및 디코드

    Args:
        token: JWT 토큰 문자열

    Returns:
        토큰 페이로드

    Raises:
        JWTError: 토큰이 유효하지 않은 경우
    """
    settings = get_settings()

    payload = jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM]
    )
    return payload


def create_access_token(telegram_id: int, username: str = "", role: str = "worker") -> str:
    """
    사용자 액세스 토큰 생성

    Args:
        telegram_id: 텔레그램 사용자 ID
        username: 텔레그램 username
        role: 사용자 역할 (worker/admin)

    Returns:
        JWT 토큰
    """
    return create_token({
        "telegram_id": telegram_id,
        "username": username,
        "role": role,
        "type": "access"
    })
