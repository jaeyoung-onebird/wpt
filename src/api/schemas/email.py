"""Email verification and auth schemas"""
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class SendCodeRequest(BaseModel):
    """인증번호 발송 요청"""
    email: EmailStr


class SendCodeResponse(BaseModel):
    """인증번호 발송 응답"""
    success: bool
    message: str


class VerifyCodeRequest(BaseModel):
    """인증번호 검증 요청"""
    email: EmailStr
    code: str


class VerifyCodeResponse(BaseModel):
    """인증번호 검증 응답"""
    success: bool
    verified: bool
    message: str


class EmailRegisterRequest(BaseModel):
    """이메일 회원가입 요청"""
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1)
    phone: str = Field(..., min_length=10)
    # 선택 프로필 필드
    birth_date: Optional[str] = None
    gender: Optional[str] = None
    residence: Optional[str] = None
    region_id: Optional[int] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None


class EmailLoginRequest(BaseModel):
    """이메일 로그인 요청"""
    email: EmailStr
    password: str
