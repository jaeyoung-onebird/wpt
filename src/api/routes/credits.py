"""Credits (WPT) Routes"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging

from ..dependencies import get_db, require_auth, require_admin
from db import Database
from wpt_service import wpt_service
from utils import now_kst

router = APIRouter()
logger = logging.getLogger(__name__)

# 월간 개근 보너스
MONTHLY_PERFECT_ATTENDANCE_BONUS = 10


def _check_and_give_monthly_bonus(worker_id: int, wallet_address: str, db: Database) -> Optional[dict]:
    """
    전월 개근 보너스 확인 및 지급
    매월 첫 체크인 시 호출하여 전월 개근 여부 확인
    """
    now = now_kst()

    # 전월 계산
    if now.month == 1:
        prev_year = now.year - 1
        prev_month = 12
    else:
        prev_year = now.year
        prev_month = now.month - 1

    # 이미 보너스 받았는지 확인
    existing = db.get_monthly_bonus(worker_id, prev_year, prev_month, "PERFECT_ATTENDANCE")
    if existing:
        return None  # 이미 받음

    # 전월 개근 확인
    if not db.check_perfect_attendance(worker_id, prev_year, prev_month):
        return None  # 개근 아님

    # 보너스 지급
    tx_hash = None
    reason = f"{prev_year}년 {prev_month}월 개근 보너스"

    if wpt_service.enabled:
        result = wpt_service.mint_credits(
            wallet_address,
            MONTHLY_PERFECT_ATTENDANCE_BONUS,
            reason
        )
        if result["success"]:
            tx_hash = result.get("tx_hash")
            logger.info(f"Monthly bonus: {MONTHLY_PERFECT_ATTENDANCE_BONUS} WPT to worker {worker_id}")
        else:
            logger.error(f"Failed to mint monthly bonus: {result.get('error')}")
            return None

    # DB 토큰 추가
    db.add_tokens(worker_id, MONTHLY_PERFECT_ATTENDANCE_BONUS)

    # 보너스 기록 저장
    db.create_monthly_bonus(
        worker_id, prev_year, prev_month,
        "PERFECT_ATTENDANCE", MONTHLY_PERFECT_ATTENDANCE_BONUS, tx_hash
    )

    # 새 잔액 조회
    if wpt_service.enabled:
        new_balance = wpt_service.get_balance(wallet_address)
    else:
        new_balance = db.get_worker_tokens(worker_id)

    # 거래 내역 저장
    db.create_credit_history(
        worker_id=worker_id,
        amount=MONTHLY_PERFECT_ATTENDANCE_BONUS,
        balance_after=new_balance,
        tx_type="MONTHLY_BONUS",
        reason=reason,
        tx_hash=tx_hash
    )

    return {
        "type": "PERFECT_ATTENDANCE",
        "amount": MONTHLY_PERFECT_ATTENDANCE_BONUS,
        "year": prev_year,
        "month": prev_month,
        "tx_hash": tx_hash
    }


class CreditResponse(BaseModel):
    """크레딧 잔액 응답"""
    balance: int
    wallet_address: Optional[str] = None


class CreditHistoryItem(BaseModel):
    """크레딧 거래 내역"""
    id: int
    amount: int
    balance_after: Optional[int] = None
    tx_type: str
    reason: str
    tx_hash: Optional[str] = None
    created_at: Optional[str] = None


class CreditHistoryResponse(BaseModel):
    """크레딧 거래 내역 응답"""
    total: int
    history: List[CreditHistoryItem]


class MintRequest(BaseModel):
    """크레딧 발행 요청"""
    worker_id: int
    amount: int
    reason: str


class BurnRequest(BaseModel):
    """크레딧 소각 요청"""
    amount: int
    reason: str


class TokenInfoResponse(BaseModel):
    """토큰 정보 응답"""
    enabled: bool
    name: Optional[str] = None
    symbol: Optional[str] = None
    total_supply: Optional[int] = None
    transfers_enabled: Optional[bool] = None
    contract_address: Optional[str] = None
    network: Optional[str] = None


@router.get("/me", response_model=CreditResponse)
async def get_my_credits(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 크레딧 잔액 조회"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    wallet_address = worker.get("wallet_address")

    # 지갑 주소가 없으면 생성
    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker["id"])
        db.set_worker_wallet_address(worker["id"], wallet_address)

    # WPT 서비스가 활성화되어 있으면 블록체인에서 조회
    if wpt_service.enabled:
        balance = wpt_service.get_balance(wallet_address)
    else:
        # 서비스 비활성화 시 DB 토큰 사용
        balance = db.get_worker_tokens(worker["id"])

    return CreditResponse(balance=balance, wallet_address=wallet_address)


@router.get("/me/history", response_model=CreditHistoryResponse)
async def get_my_credit_history(
    limit: int = 50,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 크레딧 거래 내역 조회"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    history = db.get_credit_history(worker["id"], limit=limit)

    return CreditHistoryResponse(
        total=len(history),
        history=[CreditHistoryItem(
            id=h["id"],
            amount=h["amount"],
            balance_after=h.get("balance_after"),
            tx_type=h["tx_type"],
            reason=h["reason"],
            tx_hash=h.get("tx_hash"),
            created_at=str(h["created_at"]) if h.get("created_at") else None
        ) for h in history]
    )


@router.post("/mint")
async def mint_credits(
    data: MintRequest,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """크레딧 발행 (관리자 전용)"""
    # 근무자 확인
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM workers WHERE id = %s", (data.worker_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")
        worker = dict(row)

    wallet_address = worker.get("wallet_address")

    # 지갑 주소가 없으면 생성
    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker["id"])
        db.set_worker_wallet_address(worker["id"], wallet_address)

    if not wpt_service.enabled:
        # WPT 비활성화 시 DB 토큰만 추가
        db.add_tokens(worker["id"], data.amount)
        new_balance = db.get_worker_tokens(worker["id"])
        db.create_credit_history(
            worker_id=worker["id"],
            amount=data.amount,
            balance_after=new_balance,
            tx_type="MINT",
            reason=data.reason,
            tx_hash=None
        )
        return {
            "success": True,
            "message": f"{data.amount} 크레딧이 발행되었습니다 (DB 모드)",
            "balance": new_balance
        }

    # WPT 토큰 발행
    result = wpt_service.mint_credits(wallet_address, data.amount, data.reason)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "발행 실패"))

    # 새 잔액 조회
    new_balance = wpt_service.get_balance(wallet_address)

    # 거래 내역 저장
    db.create_credit_history(
        worker_id=worker["id"],
        amount=data.amount,
        balance_after=new_balance,
        tx_type="MINT",
        reason=data.reason,
        tx_hash=result.get("tx_hash")
    )

    # DB 토큰도 동기화
    db.add_tokens(worker["id"], data.amount)

    return {
        "success": True,
        "message": f"{data.amount} 크레딧이 발행되었습니다",
        "tx_hash": result.get("tx_hash"),
        "balance": new_balance,
        "explorer_url": wpt_service.get_explorer_url(result.get("tx_hash", ""))
    }


@router.post("/burn")
async def burn_my_credits(
    data: BurnRequest,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 크레딧 소각 (증명서 발급 등)"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    wallet_address = worker.get("wallet_address")

    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker["id"])
        db.set_worker_wallet_address(worker["id"], wallet_address)

    if not wpt_service.enabled:
        # WPT 비활성화 시 DB 토큰만 사용
        if not db.use_token(worker["id"], data.amount):
            raise HTTPException(status_code=400, detail="크레딧이 부족합니다")

        new_balance = db.get_worker_tokens(worker["id"])
        db.create_credit_history(
            worker_id=worker["id"],
            amount=-data.amount,
            balance_after=new_balance,
            tx_type="BURN",
            reason=data.reason,
            tx_hash=None
        )
        return {
            "success": True,
            "message": f"{data.amount} 크레딧이 사용되었습니다 (DB 모드)",
            "balance": new_balance
        }

    # 잔액 확인
    current_balance = wpt_service.get_balance(wallet_address)
    if current_balance < data.amount:
        raise HTTPException(status_code=400, detail="크레딧이 부족합니다")

    # WPT 토큰 소각
    result = wpt_service.burn_credits(wallet_address, data.amount, data.reason)

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "소각 실패"))

    # 새 잔액 조회
    new_balance = wpt_service.get_balance(wallet_address)

    # 거래 내역 저장
    db.create_credit_history(
        worker_id=worker["id"],
        amount=-data.amount,
        balance_after=new_balance,
        tx_type="BURN",
        reason=data.reason,
        tx_hash=result.get("tx_hash")
    )

    # DB 토큰도 동기화
    db.use_token(worker["id"], data.amount)

    return {
        "success": True,
        "message": f"{data.amount} 크레딧이 사용되었습니다",
        "tx_hash": result.get("tx_hash"),
        "balance": new_balance,
        "explorer_url": wpt_service.get_explorer_url(result.get("tx_hash", ""))
    }


@router.get("/token-info", response_model=TokenInfoResponse)
async def get_token_info():
    """WPT 토큰 정보 조회 (공개)"""
    info = wpt_service.get_token_info()
    return TokenInfoResponse(**info)


@router.get("/{worker_id}", response_model=CreditResponse)
async def get_worker_credits(
    worker_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 크레딧 잔액 조회 (관리자 전용)"""
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")
        worker = dict(row)

    wallet_address = worker.get("wallet_address")

    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker["id"])
        db.set_worker_wallet_address(worker["id"], wallet_address)

    if wpt_service.enabled:
        balance = wpt_service.get_balance(wallet_address)
    else:
        balance = db.get_worker_tokens(worker["id"])

    return CreditResponse(balance=balance, wallet_address=wallet_address)


# ===== Daily Check-in (일일 출석체크) =====

class CheckinStatusResponse(BaseModel):
    """출석체크 상태 응답"""
    checked_in_today: bool
    streak_days: int
    today_reward: Optional[int] = None
    next_reward: int = 1


class MonthlyBonusInfo(BaseModel):
    """월간 보너스 정보"""
    type: str
    amount: int
    year: int
    month: int


class CheckinResponse(BaseModel):
    """출석체크 결과"""
    success: bool
    message: str
    reward_amount: int
    streak_days: int
    new_balance: int
    tx_hash: Optional[str] = None
    monthly_bonus: Optional[MonthlyBonusInfo] = None


class CheckinHistoryItem(BaseModel):
    """출석체크 내역 아이템"""
    id: int
    check_date: str
    reward_amount: int
    streak_days: int
    created_at: Optional[str] = None


@router.get("/checkin/status")
async def get_checkin_status(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """오늘 출석체크 상태 확인"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    today_checkin = db.check_today_checkin(worker["id"])
    streak = db.get_streak_days(worker["id"])

    # 연속 출석 보너스: 7일마다 +1 크레딧
    base_reward = 1
    bonus = streak // 7  # 7일마다 보너스
    next_reward = base_reward + bonus

    return CheckinStatusResponse(
        checked_in_today=today_checkin is not None,
        streak_days=streak,
        today_reward=today_checkin.get("reward_amount") if today_checkin else None,
        next_reward=next_reward
    )


@router.post("/checkin")
async def daily_checkin(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """일일 출석체크 - 하루에 한 번만 가능"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    # 오늘 이미 체크인했는지 확인
    today_checkin = db.check_today_checkin(worker["id"])
    if today_checkin:
        raise HTTPException(status_code=400, detail="오늘은 이미 출석체크를 했습니다")

    # 연속 출석일 계산 (체크인 전)
    current_streak = db.get_streak_days(worker["id"])

    # 연속 출석 보너스: 7일마다 +1 크레딧
    base_reward = 1
    bonus = current_streak // 7
    reward_amount = base_reward + bonus

    wallet_address = worker.get("wallet_address")
    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker["id"])
        db.set_worker_wallet_address(worker["id"], wallet_address)

    tx_hash = None

    if wpt_service.enabled:
        # WPT 토큰 발행
        result = wpt_service.mint_credits(
            wallet_address,
            reward_amount,
            f"일일 출석체크 (연속 {current_streak + 1}일)"
        )
        if result["success"]:
            tx_hash = result.get("tx_hash")
        else:
            raise HTTPException(status_code=500, detail="크레딧 발행에 실패했습니다")

    # DB 토큰 추가
    db.add_tokens(worker["id"], reward_amount)

    # 출석체크 기록 생성
    checkin = db.create_daily_checkin(worker["id"], reward_amount, tx_hash)

    # 새 잔액 조회
    if wpt_service.enabled:
        new_balance = wpt_service.get_balance(wallet_address)
    else:
        new_balance = db.get_worker_tokens(worker["id"])

    # 거래 내역 저장
    db.create_credit_history(
        worker_id=worker["id"],
        amount=reward_amount,
        balance_after=new_balance,
        tx_type="CHECKIN",
        reason=f"일일 출석체크 (연속 {checkin['streak_days']}일)",
        tx_hash=tx_hash
    )

    # 월간 개근 보너스 확인 (매월 첫 체크인 시)
    monthly_bonus = None
    try:
        bonus_result = _check_and_give_monthly_bonus(worker["id"], wallet_address, db)
        if bonus_result:
            monthly_bonus = MonthlyBonusInfo(**bonus_result)
            # 잔액 다시 조회 (보너스 지급 후)
            if wpt_service.enabled:
                new_balance = wpt_service.get_balance(wallet_address)
            else:
                new_balance = db.get_worker_tokens(worker["id"])
    except Exception as e:
        logger.error(f"Failed to check monthly bonus: {e}")

    message = f"출석체크 완료! {reward_amount} 크레딧을 받았습니다"
    if monthly_bonus:
        message += f" + 개근 보너스 {monthly_bonus.amount} 크레딧!"

    return CheckinResponse(
        success=True,
        message=message,
        reward_amount=reward_amount,
        streak_days=checkin["streak_days"],
        new_balance=new_balance,
        tx_hash=tx_hash,
        monthly_bonus=monthly_bonus
    )


@router.get("/checkin/history")
async def get_checkin_history(
    limit: int = 30,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """출석체크 내역 조회"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    history = db.get_checkin_history(worker["id"], limit)

    return {
        "total": len(history),
        "history": [CheckinHistoryItem(
            id=h["id"],
            check_date=str(h["check_date"]) if h.get("check_date") else "",
            reward_amount=h["reward_amount"],
            streak_days=h["streak_days"],
            created_at=str(h["created_at"]) if h.get("created_at") else None
        ) for h in history]
    }
