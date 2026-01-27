"""Auth Routes"""
from fastapi import APIRouter, Depends, HTTPException, Query, Body, BackgroundTasks
from typing import Optional
import logging
import threading

from ..config import get_settings, Settings
from ..dependencies import get_db, get_current_user
from ..auth.telegram import verify_telegram_init_data
from ..auth.jwt import create_access_token
from ..auth.password import hash_password, verify_password
from ..schemas.auth import TelegramAuthRequest, TokenResponse, UserInfo
from ..schemas.email import EmailRegisterRequest, EmailLoginRequest
from db import Database
from wpt_service import wpt_service

router = APIRouter()
logger = logging.getLogger(__name__)

# 가입 보너스
REGISTRATION_BONUS = 3


def _give_registration_bonus_sync(worker_id: int):
    """이메일 가입 보너스 WPT 지급 (백그라운드 실행)"""
    from db import Database

    try:
        db = Database()

        # 지갑 주소 생성
        wallet_address = wpt_service.get_deterministic_address(worker_id)
        db.set_worker_wallet_address(worker_id, wallet_address)

        tx_hash = None
        reason = "신규 가입 환영 보너스"

        if wpt_service.enabled:
            # WPT 토큰 발행 (블록체인 호출 - 느림)
            result = wpt_service.mint_credits(
                wallet_address,
                REGISTRATION_BONUS,
                reason
            )
            if result["success"]:
                tx_hash = result.get("tx_hash")
                logger.info(f"Registration bonus: {REGISTRATION_BONUS} WPT to worker {worker_id}")
            else:
                logger.error(f"Failed to mint registration bonus: {result.get('error')}")

        # DB 토큰 추가
        db.add_tokens(worker_id, REGISTRATION_BONUS)

        # 새 잔액 조회
        if wpt_service.enabled:
            new_balance = wpt_service.get_balance(wallet_address)
        else:
            new_balance = db.get_worker_tokens(worker_id)

        # 거래 내역 저장
        db.create_credit_history(
            worker_id=worker_id,
            amount=REGISTRATION_BONUS,
            balance_after=new_balance,
            tx_type="SIGNUP_BONUS",
            reason=reason,
            tx_hash=tx_hash
        )
        logger.info(f"Registration bonus completed for worker {worker_id}")
    except Exception as e:
        logger.error(f"Failed to give registration bonus to worker {worker_id}: {e}")


def _give_registration_bonus_background(worker_id: int):
    """백그라운드 스레드에서 가입 보너스 지급"""
    thread = threading.Thread(target=_give_registration_bonus_sync, args=(worker_id,))
    thread.daemon = True
    thread.start()


@router.get("/check-email")
async def check_email(
    email: str = Query(...),
    db: Database = Depends(get_db)
):
    """
    이메일 중복 확인
    """
    existing = db.get_worker_by_email(email)
    return {"available": existing is None, "email": email}


@router.post("/telegram", response_model=TokenResponse)
async def telegram_auth(
    request: TelegramAuthRequest,
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """
    Telegram initData로 인증하여 JWT 토큰 발급

    - 미니앱에서 Telegram.WebApp.initData를 전송
    - 서버에서 검증 후 JWT 토큰 반환
    """
    # 개발 모드: DEBUG=True일 때 간소화된 검증
    if settings.DEBUG and request.init_data.startswith("test_"):
        # 테스트용 토큰: test_123456_username
        parts = request.init_data.split("_")
        if len(parts) >= 2:
            telegram_id = int(parts[1])
            username = parts[2] if len(parts) > 2 else ""
            role = "admin" if db.is_admin(telegram_id) or telegram_id in settings.admin_ids else "worker"
            token = create_access_token(telegram_id, username, role)
            return TokenResponse(
                access_token=token,
                telegram_id=telegram_id,
                username=username,
                role=role
            )

    # 프로덕션: Telegram initData 검증
    # WORKER_BOT_TOKEN으로 검증 (미니앱은 근무자 봇에 연결)
    user = verify_telegram_init_data(request.init_data, settings.WORKER_BOT_TOKEN)

    if not user:
        # ADMIN_BOT_TOKEN으로도 시도
        user = verify_telegram_init_data(request.init_data, settings.ADMIN_BOT_TOKEN)

    if not user:
        raise HTTPException(status_code=401, detail="유효하지 않은 인증 데이터입니다")

    telegram_id = user["telegram_id"]
    username = user.get("username", "")

    # 역할 확인
    role = "admin" if db.is_admin(telegram_id) or telegram_id in settings.admin_ids else "worker"

    # JWT 토큰 발급
    token = create_access_token(telegram_id, username, role)

    return TokenResponse(
        access_token=token,
        telegram_id=telegram_id,
        username=username,
        role=role
    )


@router.get("/me", response_model=UserInfo)
async def get_me(
    user: dict | None = Depends(get_current_user),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """현재 로그인한 사용자 정보"""
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    telegram_id = user.get("telegram_id")

    # 등록 여부 확인
    worker = db.get_worker_by_telegram_id(telegram_id)
    is_registered = worker is not None

    # 관리자 여부 확인 (admin_users 테이블 OR workers.is_admin 컬럼 OR settings.admin_ids)
    is_admin = (
        db.is_admin(telegram_id) or
        telegram_id in settings.admin_ids or
        (worker and worker.get('is_admin'))
    )

    return UserInfo(
        telegram_id=telegram_id,
        username=user.get("username", ""),
        role="admin" if is_admin else "worker",
        is_registered=is_registered,
        is_admin=is_admin
    )


@router.post("/register", response_model=TokenResponse)
async def email_register(
    request: EmailRegisterRequest,
    db: Database = Depends(get_db)
):
    """
    이메일 회원가입

    - 비밀번호는 6자 이상
    """
    # 이메일 중복 확인
    if db.get_worker_by_email(request.email):
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다")

    # 비밀번호 해싱 및 사용자 생성
    password_hash = hash_password(request.password)
    worker_id = db.create_worker_with_email(
        email=request.email,
        password_hash=password_hash,
        name=request.name,
        phone=request.phone,
        birth_date=request.birth_date,
        gender=request.gender,
        residence=request.residence,
        region_id=request.region_id,
        bank_name=request.bank_name,
        bank_account=request.bank_account
    )

    # 가입 보너스 지급 (백그라운드에서 비동기 처리)
    _give_registration_bonus_background(worker_id)

    # 생성된 worker의 실제 telegram_id 조회
    worker = db.get_worker_by_email(request.email)
    actual_telegram_id = worker.get('telegram_id', 0) if worker else 0

    # JWT 토큰 발급 (실제 telegram_id 사용)
    token = create_access_token(
        telegram_id=actual_telegram_id,
        username=request.email,
        role="worker"
    )

    return TokenResponse(
        access_token=token,
        telegram_id=actual_telegram_id,
        username=request.email,
        role="worker"
    )


@router.post("/login", response_model=TokenResponse)
async def email_login(
    request: EmailLoginRequest,
    db: Database = Depends(get_db)
):
    """
    이메일 로그인

    - 이메일과 비밀번호로 로그인
    """
    # 사용자 조회
    worker = db.get_worker_by_email(request.email)
    if not worker:
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    # 비밀번호 확인
    if not worker.get('password_hash') or not verify_password(request.password, worker['password_hash']):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    # 관리자 여부 확인
    role = "admin" if worker.get('is_admin') else "worker"

    # JWT 토큰 발급
    token = create_access_token(
        telegram_id=worker.get('telegram_id', 0),
        username=request.email,
        role=role
    )

    return TokenResponse(
        access_token=token,
        telegram_id=worker.get('telegram_id', 0),
        username=request.email,
        role=role
    )


@router.post("/change-password")
async def change_password(
    current_password: str = Body(...),
    new_password: str = Body(..., min_length=6),
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    비밀번호 변경 (로그인한 사용자만)
    """
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    email = user.get("username", "")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="이메일 사용자만 비밀번호를 변경할 수 있습니다")

    # 현재 사용자 조회
    worker = db.get_worker_by_email(email)
    if not worker:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

    # 현재 비밀번호 확인
    if not worker.get('password_hash') or not verify_password(current_password, worker['password_hash']):
        raise HTTPException(status_code=401, detail="현재 비밀번호가 올바르지 않습니다")

    # 새 비밀번호 해시 생성 및 업데이트
    new_hash = hash_password(new_password)
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE workers SET password_hash = %s WHERE email = %s",
            (new_hash, email)
        )

    return {"success": True, "message": "비밀번호가 변경되었습니다"}


@router.post("/set-admin/{worker_id}")
async def set_admin(
    worker_id: int,
    is_admin: bool = True,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """
    관리자 권한 설정 (관리자만 가능)

    - worker_id: 대상 회원 ID
    - is_admin: True=관리자 임명, False=관리자 해제
    """
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    # 요청자가 관리자인지 확인
    telegram_id = user.get("telegram_id", 0)
    requester_email = user.get("username", "")

    is_requester_admin = (
        db.is_admin(telegram_id) or
        telegram_id in settings.admin_ids or
        db.is_email_admin(requester_email)
    )

    if not is_requester_admin:
        raise HTTPException(status_code=403, detail="관리자만 권한을 변경할 수 있습니다")

    # 관리자 권한 설정
    db.set_worker_admin(worker_id, is_admin)

    return {
        "success": True,
        "message": f"회원 {worker_id}의 관리자 권한이 {'부여' if is_admin else '해제'}되었습니다"
    }


@router.get("/workers")
async def list_workers(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    settings: Settings = Depends(get_settings)
):
    """
    회원 목록 조회 (관리자만 가능)
    """
    if not user:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")

    # 요청자가 관리자인지 확인
    telegram_id = user.get("telegram_id", 0)
    requester_email = user.get("username", "")

    is_requester_admin = (
        db.is_admin(telegram_id) or
        telegram_id in settings.admin_ids or
        db.is_email_admin(requester_email)
    )

    if not is_requester_admin:
        raise HTTPException(status_code=403, detail="관리자만 조회할 수 있습니다")

    workers = db.get_all_workers()
    return {"workers": workers}
