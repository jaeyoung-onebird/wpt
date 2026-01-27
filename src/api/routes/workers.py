"""Workers Routes"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
import os
import uuid
import logging
from datetime import datetime

from ..dependencies import get_db, require_auth, require_admin
from ..schemas.worker import (
    WorkerCreate, WorkerUpdate, WorkerResponse, WorkerListResponse
)
from db import Database
from wpt_service import wpt_service

router = APIRouter()
logger = logging.getLogger(__name__)

# 첫 가입 보너스 (WPT)
REGISTRATION_BONUS = 5
# 프로필 완성 보너스 (WPT)
PROFILE_COMPLETION_BONUS = 3

# 프로필 완성에 필요한 필드
PROFILE_REQUIRED_FIELDS = ['name', 'phone', 'birth_date', 'gender', 'residence', 'bank_name', 'bank_account', 'face_photo_file_id']


def _is_profile_complete(worker: dict) -> bool:
    """프로필이 완성되었는지 확인"""
    for field in PROFILE_REQUIRED_FIELDS:
        if not worker.get(field):
            return False
    return True


def _give_profile_completion_bonus(worker_id: int, db: Database) -> bool:
    """프로필 완성 보너스 WPT 지급 (이미 받은 경우 False 반환)"""
    # 이미 받았는지 확인 (credit_history에서)
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id FROM credit_history
            WHERE worker_id = ? AND tx_type = 'PROFILE_BONUS'
        """, (worker_id,))
        if cursor.fetchone():
            return False  # 이미 받음

    # 근무자 정보 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
        row = cursor.fetchone()
        if not row:
            return False
        worker = dict(row)

    wallet_address = worker.get("wallet_address")
    if not wallet_address:
        wallet_address = wpt_service.get_deterministic_address(worker_id)
        db.set_worker_wallet_address(worker_id, wallet_address)

    tx_hash = None
    reason = "프로필 완성 보너스"

    if wpt_service.enabled:
        result = wpt_service.mint_credits(
            wallet_address,
            PROFILE_COMPLETION_BONUS,
            reason
        )
        if result["success"]:
            tx_hash = result.get("tx_hash")
            logger.info(f"Profile bonus: {PROFILE_COMPLETION_BONUS} WPT to worker {worker_id}")
        else:
            logger.error(f"Failed to mint profile bonus: {result.get('error')}")
            return False

    # DB 토큰 추가
    db.add_tokens(worker_id, PROFILE_COMPLETION_BONUS)

    # 새 잔액 조회
    if wpt_service.enabled:
        new_balance = wpt_service.get_balance(wallet_address)
    else:
        new_balance = db.get_worker_tokens(worker_id)

    # 거래 내역 저장
    db.create_credit_history(
        worker_id=worker_id,
        amount=PROFILE_COMPLETION_BONUS,
        balance_after=new_balance,
        tx_type="PROFILE_BONUS",
        reason=reason,
        tx_hash=tx_hash
    )
    return True


def _give_registration_bonus(worker_id: int, db: Database):
    """첫 가입 보너스 WPT 지급"""
    # 지갑 주소 생성
    wallet_address = wpt_service.get_deterministic_address(worker_id)
    db.set_worker_wallet_address(worker_id, wallet_address)

    tx_hash = None
    reason = "신규 가입 환영 보너스"

    if wpt_service.enabled:
        # WPT 토큰 발행
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
            return

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
        tx_type="REGISTRATION_BONUS",
        reason=reason,
        tx_hash=tx_hash
    )

# 사진 저장 경로
PHOTO_DIR = "/home/ubuntu/workproof-chain-v2/data/photos"
os.makedirs(PHOTO_DIR, exist_ok=True)


@router.post("", response_model=WorkerResponse)
async def create_worker(
    data: WorkerCreate,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """근무자 등록"""
    telegram_id = user.get("telegram_id")

    # 이미 등록된 경우
    existing = db.get_worker_by_telegram_id(telegram_id)
    if existing:
        raise HTTPException(status_code=400, detail="이미 등록된 근무자입니다")

    # 근무자 생성
    worker_id = db.create_worker(
        telegram_id=telegram_id,
        name=data.name,
        phone=data.phone,
        birth_date=data.birth_date,
        gender=data.gender,
        residence=data.residence,
        bank_name=data.bank_name,
        bank_account=data.bank_account,
        driver_license=data.driver_license,
        security_cert=data.security_cert
    )

    # 첫 가입 보너스 지급
    try:
        _give_registration_bonus(worker_id, db)
    except Exception as e:
        logger.error(f"Failed to give registration bonus: {e}")

    worker = db.get_worker_by_telegram_id(telegram_id)
    return WorkerResponse(**worker)


@router.get("/me", response_model=WorkerResponse)
async def get_my_info(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 정보 조회"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    return WorkerResponse(**worker)


@router.patch("/me", response_model=WorkerResponse)
async def update_my_info(
    data: WorkerUpdate,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 정보 수정"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    # 프로필 완성 전 상태 확인
    was_complete_before = _is_profile_complete(worker)

    # None이 아닌 필드만 업데이트
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if update_data:
        db.update_worker(worker["id"], **update_data)

    updated = db.get_worker_by_telegram_id(telegram_id)

    # 프로필이 방금 완성되었다면 보너스 지급
    if not was_complete_before and _is_profile_complete(updated):
        try:
            if _give_profile_completion_bonus(worker["id"], db):
                logger.info(f"Profile completion bonus given to worker {worker['id']}")
        except Exception as e:
            logger.error(f"Failed to give profile bonus: {e}")

    return WorkerResponse(**updated)


@router.post("/me/photo")
async def upload_my_photo(
    file: UploadFile = File(...),
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 얼굴사진 업로드"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    # 파일 확장자 확인
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다")

    # 이전 사진 삭제
    old_photo = worker.get("face_photo_file_id")
    if old_photo and os.path.exists(old_photo):
        try:
            os.remove(old_photo)
        except Exception:
            pass  # 삭제 실패해도 진행

    # 새 파일 저장
    ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
    filename = f"{telegram_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.{ext}"
    filepath = os.path.join(PHOTO_DIR, filename)

    # 사진 업로드 전 프로필 완성 상태 확인
    was_complete_before = _is_profile_complete(worker)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # DB 업데이트
    db.update_worker(worker["id"], face_photo_file_id=filepath)

    # 프로필 완성 확인 및 보너스 지급
    bonus_given = False
    updated = db.get_worker_by_telegram_id(telegram_id)
    if not was_complete_before and _is_profile_complete(updated):
        try:
            if _give_profile_completion_bonus(worker["id"], db):
                logger.info(f"Profile completion bonus given to worker {worker['id']}")
                bonus_given = True
        except Exception as e:
            logger.error(f"Failed to give profile bonus: {e}")

    message = "사진이 등록되었습니다"
    if bonus_given:
        message += f" (+{PROFILE_COMPLETION_BONUS} 크레딧 보너스!)"

    return {"success": True, "message": message, "photo_path": filepath, "bonus_given": bonus_given}


@router.get("/me/photo")
async def get_my_photo(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 얼굴사진 조회"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    photo_path = worker.get("face_photo_file_id")
    if not photo_path or not os.path.exists(photo_path):
        raise HTTPException(status_code=404, detail="사진이 등록되지 않았습니다")

    return FileResponse(photo_path, media_type="image/jpeg")


@router.delete("/me")
async def delete_my_account(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """회원 탈퇴 (본인 계정 삭제)"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    worker_id = worker["id"]
    worker_name = worker.get('name', 'Unknown')

    # 크레딧 소각 (블록체인)
    wallet_address = worker.get("wallet_address")
    burned_amount = 0
    if wallet_address and wpt_service.enabled:
        try:
            balance = wpt_service.get_balance(wallet_address)
            if balance > 0:
                result = wpt_service.burn_credits(
                    wallet_address,
                    balance,
                    f"회원 탈퇴로 인한 크레딧 소각 (worker_id: {worker_id})"
                )
                if result["success"]:
                    burned_amount = balance
                    logger.info(f"Burned {balance} WPT for withdrawn worker {worker_id}")
                else:
                    logger.error(f"Failed to burn credits for worker {worker_id}: {result.get('error')}")
        except Exception as e:
            logger.error(f"Error burning credits for worker {worker_id}: {e}")

    # 사진 파일 삭제
    photo_path = worker.get("face_photo_file_id")
    if photo_path and os.path.exists(photo_path):
        try:
            os.remove(photo_path)
        except Exception:
            pass

    # 관련 데이터 삭제 (지원, 출퇴근 기록 등은 유지하고 근무자만 삭제)
    with db.get_connection() as conn:
        # 크레딧 내역 삭제
        cursor = conn.cursor()
        cursor.execute("DELETE FROM credit_history WHERE worker_id = %s", (worker_id,))
        # 일일 체크인 삭제
        cursor.execute("DELETE FROM daily_checkins WHERE worker_id = %s", (worker_id,))
        # 알림 삭제
        cursor.execute("DELETE FROM notifications WHERE worker_id = %s", (worker_id,))
        # 근무자 삭제
        cursor.execute("DELETE FROM workers WHERE id = %s", (worker_id,))
        conn.commit()

    logger.info(f"Worker {worker_id} ({worker_name}) withdrew from service. Burned {burned_amount} WPT.")

    return {"success": True, "message": "회원 탈퇴가 완료되었습니다", "burned_credits": burned_amount}


@router.get("", response_model=WorkerListResponse)
async def list_workers(
    limit: int = 100,
    offset: int = 0,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 목록 (관리자 전용)"""
    workers = db.list_workers(limit=limit)
    # offset 적용
    workers = workers[offset:offset + limit]

    return WorkerListResponse(
        total=len(workers),
        workers=[WorkerResponse(**w) for w in workers]
    )


@router.get("/{worker_id}", response_model=WorkerResponse)
async def get_worker(
    worker_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 상세 정보 (관리자 전용)"""
    # worker_id로 직접 조회
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")
        worker = dict(row)

    return WorkerResponse(**worker)


@router.get("/{worker_id}/photo")
async def get_worker_photo(
    worker_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 얼굴사진 조회 (관리자 전용)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT face_photo_file_id FROM workers WHERE id = %s",
            (worker_id,)
        )
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")

    photo_path = row["face_photo_file_id"]
    if not photo_path or not os.path.exists(photo_path):
        raise HTTPException(status_code=404, detail="사진이 등록되지 않았습니다")

    # 이미지 파일 반환
    return FileResponse(
        photo_path,
        media_type="image/jpeg"
    )


@router.patch("/{worker_id}", response_model=WorkerResponse)
async def admin_update_worker(
    worker_id: int,
    data: WorkerUpdate,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 정보 수정 (관리자 전용)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")
        worker = dict(row)

    # None이 아닌 필드만 업데이트
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if update_data:
        db.update_worker(worker_id, **update_data)

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
        updated = dict(cursor.fetchone())

    return WorkerResponse(**updated)


@router.delete("/{worker_id}")
async def admin_delete_worker(
    worker_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 삭제 (관리자 전용)"""
    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM workers WHERE id = %s", (worker_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")
        worker = dict(row)

    worker_name = worker.get('name', 'Unknown')

    # 크레딧 소각 (블록체인)
    wallet_address = worker.get("wallet_address")
    burned_amount = 0
    if wallet_address and wpt_service.enabled:
        try:
            balance = wpt_service.get_balance(wallet_address)
            if balance > 0:
                result = wpt_service.burn_credits(
                    wallet_address,
                    balance,
                    f"관리자에 의한 회원 삭제로 크레딧 소각 (worker_id: {worker_id})"
                )
                if result["success"]:
                    burned_amount = balance
                    logger.info(f"Burned {balance} WPT for deleted worker {worker_id}")
                else:
                    logger.error(f"Failed to burn credits for worker {worker_id}: {result.get('error')}")
        except Exception as e:
            logger.error(f"Error burning credits for worker {worker_id}: {e}")

    # 사진 파일 삭제
    photo_path = worker.get("face_photo_file_id")
    if photo_path and os.path.exists(photo_path):
        try:
            os.remove(photo_path)
        except Exception:
            pass

    # 관련 데이터 삭제
    with db.get_connection() as conn:
        # 크레딧 내역 삭제
        cursor = conn.cursor()
        cursor.execute("DELETE FROM credit_history WHERE worker_id = %s", (worker_id,))
        # 일일 체크인 삭제
        cursor.execute("DELETE FROM daily_checkins WHERE worker_id = %s", (worker_id,))
        # 알림 삭제
        cursor.execute("DELETE FROM notifications WHERE worker_id = %s", (worker_id,))
        # 근무자 삭제
        cursor.execute("DELETE FROM workers WHERE id = %s", (worker_id,))
        conn.commit()

    logger.info(f"Worker {worker_id} ({worker_name}) deleted by admin. Burned {burned_amount} WPT.")

    return {"success": True, "message": "근무자가 삭제되었습니다", "burned_credits": burned_amount}
