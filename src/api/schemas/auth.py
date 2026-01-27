"""Auth Schemas"""
from pydantic import BaseModel


class TelegramAuthRequest(BaseModel):
    """Telegram initData 인증 요청"""
    init_data: str


class TokenResponse(BaseModel):
    """JWT 토큰 응답"""
    access_token: str
    token_type: str = "bearer"
    telegram_id: int
    username: str = ""
    role: str = "worker"


class UserInfo(BaseModel):
    """현재 사용자 정보"""
    telegram_id: int
    username: str = ""
    role: str = "worker"
    is_registered: bool = False
    is_admin: bool = False
