"""Email verification routes"""
from fastapi import APIRouter, Depends, HTTPException
import logging

from ..dependencies import get_db
from ..schemas.email import (
    SendCodeRequest, SendCodeResponse,
    VerifyCodeRequest, VerifyCodeResponse
)
from ..services.email_service import email_service
from db import Database

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/send-code", response_model=SendCodeResponse)
async def send_verification_code(
    request: SendCodeRequest,
    db: Database = Depends(get_db)
):
    """
    이메일 인증번호 발송

    - 6자리 인증번호를 이메일로 발송
    - 인증번호는 3분간 유효
    """
    try:
        # 인증번호 생성 및 발송
        code, expires_at = email_service.send_verification_code(request.email)

        # DB에 저장
        db.create_email_verification(request.email, code, expires_at)

        return SendCodeResponse(
            success=True,
            message="인증번호가 발송되었습니다"
        )

    except Exception as e:
        logger.error(f"Failed to send verification code: {e}")
        raise HTTPException(status_code=500, detail="인증번호 발송에 실패했습니다")


@router.post("/verify-code", response_model=VerifyCodeResponse)
async def verify_code(
    request: VerifyCodeRequest,
    db: Database = Depends(get_db)
):
    """
    이메일 인증번호 검증

    - 발송된 인증번호와 일치 여부 확인
    - 유효시간 내 검증 필요
    """
    verified = db.verify_email_code(request.email, request.code)

    if verified:
        return VerifyCodeResponse(
            success=True,
            verified=True,
            message="인증이 완료되었습니다"
        )
    else:
        return VerifyCodeResponse(
            success=True,
            verified=False,
            message="인증번호가 일치하지 않거나 만료되었습니다"
        )


@router.get("/check/{email}")
async def check_verification(
    email: str,
    db: Database = Depends(get_db)
):
    """
    이메일 인증 상태 확인

    - 최근 30분 내 인증 완료 여부 확인
    """
    is_verified = db.is_email_verified(email)

    return {
        "email": email,
        "verified": is_verified
    }
