"""Badges (Achievement NFT) Routes"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import logging

from ..dependencies import get_db, require_auth, require_admin
from db import Database

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== 배지 정의 =====
# 프리미엄 원형 아이콘 스타일 (이모지 대신 심플한 기하학적 심볼)
BADGE_DEFINITIONS = {
    # 근무 횟수 배지
    "WORK_COUNT": {
        1: {"title": "첫 근무 완료", "description": "첫 번째 근무를 완료했습니다", "icon": "●", "threshold": 1},
        2: {"title": "10회 근무 달성", "description": "10번의 근무를 완료했습니다", "icon": "★", "threshold": 10},
        3: {"title": "50회 근무 달성", "description": "50번의 근무를 완료했습니다", "icon": "✦", "threshold": 50},
        4: {"title": "100회 근무 달성", "description": "100번의 근무를 완료했습니다", "icon": "✴", "threshold": 100},
    },
    # 신뢰도 배지
    "TRUST": {
        1: {"title": "신뢰할 수 있는 근무자", "description": "노쇼 없이 10회 근무 완료", "icon": "✓", "threshold": 10},
        2: {"title": "믿음직한 프로", "description": "노쇼 없이 30회 근무 완료", "icon": "⬡", "threshold": 30},
        3: {"title": "최고 신뢰 등급", "description": "노쇼 없이 50회 근무 완료", "icon": "♔", "threshold": 50},
    },
    # 블록체인 기록 배지
    "BLOCKCHAIN": {
        1: {"title": "블록체인 데뷔", "description": "첫 블록체인 근무 기록", "icon": "◇", "threshold": 1},
        2: {"title": "블록체인 프로", "description": "10회 블록체인 기록", "icon": "⬢", "threshold": 10},
        3: {"title": "블록체인 마스터", "description": "30회 블록체인 기록", "icon": "◈", "threshold": 30},
    },
    # 프로필 완성 배지
    "PROFILE": {
        1: {"title": "프로필 완성", "description": "모든 프로필 정보 입력 완료", "icon": "◆", "threshold": 1},
    },
    # 사진 등록 배지
    "PHOTO": {
        1: {"title": "얼굴 등록 완료", "description": "프로필 사진 등록 완료", "icon": "◉", "threshold": 1},
    },
}


class BadgeResponse(BaseModel):
    """배지 응답"""
    id: int
    badge_type: str
    badge_level: int
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    earned_at: Optional[str] = None
    is_nft: bool = False


class BadgeSummaryResponse(BaseModel):
    """배지 요약 응답"""
    total_badges: int
    badges: List[BadgeResponse]


def check_and_award_badges(worker_id: int, db: Database) -> List[dict]:
    """
    근무자의 통계를 확인하고 조건에 맞는 배지를 자동 발급
    Returns: 새로 발급된 배지 목록
    """
    awarded = []
    stats = db.get_worker_stats_for_badges(worker_id)
    worker = db.get_worker_by_id(worker_id)

    if not worker:
        return awarded

    # 1. 근무 횟수 배지
    for level, info in BADGE_DEFINITIONS["WORK_COUNT"].items():
        if stats["total_work_count"] >= info["threshold"]:
            badge_id = db.award_badge(
                worker_id=worker_id,
                badge_type="WORK_COUNT",
                badge_level=level,
                title=info["title"],
                description=info["description"],
                icon=info["icon"]
            )
            if badge_id:
                awarded.append({"type": "WORK_COUNT", "level": level, **info})

    # 2. 신뢰도 배지 (노쇼 없이 완료)
    for level, info in BADGE_DEFINITIONS["TRUST"].items():
        if stats["perfect_attendance"] >= info["threshold"]:
            badge_id = db.award_badge(
                worker_id=worker_id,
                badge_type="TRUST",
                badge_level=level,
                title=info["title"],
                description=info["description"],
                icon=info["icon"]
            )
            if badge_id:
                awarded.append({"type": "TRUST", "level": level, **info})

    # 3. 블록체인 기록 배지
    for level, info in BADGE_DEFINITIONS["BLOCKCHAIN"].items():
        if stats["blockchain_records"] >= info["threshold"]:
            badge_id = db.award_badge(
                worker_id=worker_id,
                badge_type="BLOCKCHAIN",
                badge_level=level,
                title=info["title"],
                description=info["description"],
                icon=info["icon"]
            )
            if badge_id:
                awarded.append({"type": "BLOCKCHAIN", "level": level, **info})

    # 4. 프로필 완성 배지
    profile_complete = all([
        worker.get("name"),
        worker.get("phone"),
        worker.get("birth_date"),
        worker.get("bank_name"),
        worker.get("bank_account"),
    ])
    if profile_complete:
        badge_id = db.award_badge(
            worker_id=worker_id,
            badge_type="PROFILE",
            badge_level=1,
            title=BADGE_DEFINITIONS["PROFILE"][1]["title"],
            description=BADGE_DEFINITIONS["PROFILE"][1]["description"],
            icon=BADGE_DEFINITIONS["PROFILE"][1]["icon"]
        )
        if badge_id:
            awarded.append({"type": "PROFILE", "level": 1, **BADGE_DEFINITIONS["PROFILE"][1]})

    # 5. 사진 등록 배지
    if worker.get("face_photo_file_id"):
        badge_id = db.award_badge(
            worker_id=worker_id,
            badge_type="PHOTO",
            badge_level=1,
            title=BADGE_DEFINITIONS["PHOTO"][1]["title"],
            description=BADGE_DEFINITIONS["PHOTO"][1]["description"],
            icon=BADGE_DEFINITIONS["PHOTO"][1]["icon"]
        )
        if badge_id:
            awarded.append({"type": "PHOTO", "level": 1, **BADGE_DEFINITIONS["PHOTO"][1]})

    return awarded


@router.get("/me", response_model=BadgeSummaryResponse)
async def get_my_badges(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """내 배지 목록 조회 (자동으로 새 배지 확인 및 발급)"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    # 배지 자동 확인 및 발급
    check_and_award_badges(worker["id"], db)

    # 전체 배지 조회
    badges = db.get_worker_badges(worker["id"])

    return BadgeSummaryResponse(
        total_badges=len(badges),
        badges=[BadgeResponse(
            id=b["id"],
            badge_type=b["badge_type"],
            badge_level=b["badge_level"],
            title=b["title"],
            description=b.get("description"),
            icon=b.get("icon"),
            earned_at=str(b["earned_at"]) if b.get("earned_at") else None,
            is_nft=b.get("is_nft", False)
        ) for b in badges]
    )


@router.get("/definitions")
async def get_badge_definitions():
    """배지 정의 목록 조회 (어떤 배지가 있는지)"""
    return {"definitions": BADGE_DEFINITIONS}


@router.get("/{worker_id}", response_model=BadgeSummaryResponse)
async def get_worker_badges(
    worker_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """특정 근무자의 배지 조회 (관리자 전용)"""
    worker = db.get_worker_by_id(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")

    badges = db.get_worker_badges(worker_id)

    return BadgeSummaryResponse(
        total_badges=len(badges),
        badges=[BadgeResponse(
            id=b["id"],
            badge_type=b["badge_type"],
            badge_level=b["badge_level"],
            title=b["title"],
            description=b.get("description"),
            icon=b.get("icon"),
            earned_at=str(b["earned_at"]) if b.get("earned_at") else None,
            is_nft=b.get("is_nft", False)
        ) for b in badges]
    )


@router.post("/{worker_id}/check")
async def check_worker_badges(
    worker_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """근무자 배지 조건 확인 및 발급 (관리자 전용)"""
    worker = db.get_worker_by_id(worker_id)
    if not worker:
        raise HTTPException(status_code=404, detail="근무자를 찾을 수 없습니다")

    awarded = check_and_award_badges(worker_id, db)

    return {
        "worker_id": worker_id,
        "awarded_badges": awarded,
        "message": f"{len(awarded)}개의 새 배지가 발급되었습니다" if awarded else "새로 발급된 배지가 없습니다"
    }
