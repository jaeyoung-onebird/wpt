"""NFT Badge Image Routes"""
from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import logging

from ..dependencies import get_db, require_auth, require_admin
from ..services.nft_service import (
    render_badge_svg,
    render_project_badge_svg,
    generate_nft_metadata,
    get_badge_grade,
    get_grade_colors,
    GRADE_COLORS,
    BADGE_GRADE_MAPPING,
    TEMPLATE_TYPES
)
from db import Database

router = APIRouter()
logger = logging.getLogger(__name__)


# ===== Request/Response Models =====

class RenderRequest(BaseModel):
    """POST /nft/render 요청"""
    title: str
    description: Optional[str] = None
    icon: str = "🏅"
    grade: str = "COMMON"  # COMMON, RARE, EPIC, LEGENDARY
    template: str = "minimal"  # minimal, medal, cert
    event_name: Optional[str] = None
    worker_id: Optional[int] = None
    issued_date: Optional[str] = None  # YYYY-MM-DD


class ProjectIssueRequest(BaseModel):
    """POST /admin/events/:id/nft-issue 요청"""
    title: str
    description: Optional[str] = None
    icon: str = "🎖️"
    grade: str = "RARE"
    template: str = "cert"
    worker_ids: List[int]  # 발급 대상 근무자 ID 목록


class BadgeDetailResponse(BaseModel):
    """배지 상세 응답"""
    id: int
    badge_type: str
    badge_level: int
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    earned_at: str
    status: str
    template_type: Optional[str] = None
    event_id: Optional[int] = None
    event_name: Optional[str] = None
    image_url: str
    next_badge: Optional[dict] = None


# ===== Worker Endpoints =====

@router.get("/worker/me/badges")
async def get_my_badges(
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """
    GET /worker/me/badges
    내 배지 전체 목록 + 진행률 정보

    Response:
    {
        "badges": [...],
        "total": 5,
        "top_badges": [...],  # 대표 배지 3개
        "next_badge": {...}   # 다음 목표
    }
    """
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    # 전체 배지 조회 (ACTIVE만)
    badges = db.get_worker_badges(worker["id"])
    active_badges = [b for b in badges if b.get("status", "ACTIVE") == "ACTIVE"]

    # 다음 목표 진행률
    next_badge = db.get_next_badge_progress(worker["id"])

    # 대표 배지 3개
    top_badges = active_badges[:3]

    return {
        "badges": [{
            "id": b["id"],
            "badge_type": b["badge_type"],
            "badge_level": b["badge_level"],
            "title": b["title"],
            "description": b.get("description"),
            "icon": b.get("icon"),
            "earned_at": str(b["earned_at"]) if b.get("earned_at") else None,
            "template_type": b.get("template_type", "minimal"),
            "image_url": f"/api/nft/render/{b['id']}"
        } for b in active_badges],
        "total": len(active_badges),
        "top_badges": [{
            "id": b["id"],
            "icon": b.get("icon"),
            "title": b["title"]
        } for b in top_badges],
        "next_badge": next_badge
    }


@router.get("/worker/me/badges/{award_id}")
async def get_my_badge_detail(
    award_id: int,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """
    GET /worker/me/badges/:award_id
    배지 상세 정보

    Response:
    {
        "id": 1,
        "badge_type": "WORK_COUNT",
        "title": "첫 근무 완료",
        "description": "...",
        "icon": "🎯",
        "earned_at": "2024-01-15",
        "image_url": "/api/nft/render/1",
        "event_name": null,
        "metadata": {...}
    }
    """
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="등록된 정보가 없습니다")

    badge = db.get_badge_by_id(award_id)
    if not badge:
        raise HTTPException(status_code=404, detail="배지를 찾을 수 없습니다")

    if badge["worker_id"] != worker["id"]:
        raise HTTPException(status_code=403, detail="본인의 배지만 조회할 수 있습니다")

    # 이벤트 정보 (프로젝트 배지인 경우)
    event_name = None
    if badge.get("event_id"):
        event = db.get_event(badge["event_id"])
        event_name = event.get("title") if event else None

    return {
        "id": badge["id"],
        "badge_type": badge["badge_type"],
        "badge_level": badge["badge_level"],
        "title": badge["title"],
        "description": badge.get("description"),
        "icon": badge.get("icon"),
        "earned_at": str(badge["earned_at"]) if badge.get("earned_at") else None,
        "status": badge.get("status", "ACTIVE"),
        "template_type": badge.get("template_type", "minimal"),
        "event_id": badge.get("event_id"),
        "event_name": event_name,
        "image_url": f"/api/nft/render/{badge['id']}",
        "metadata": badge.get("metadata")
    }


# ===== Render Endpoints =====

@router.get("/render/{badge_id}")
async def render_badge_image(
    badge_id: int,
    template: Optional[str] = None,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """배지 SVG 이미지 렌더링 (본인 배지만)"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="근무자 정보가 없습니다")

    badge = db.get_badge_by_id(badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="배지를 찾을 수 없습니다")

    if badge["worker_id"] != worker["id"]:
        raise HTTPException(status_code=403, detail="본인의 배지만 조회할 수 있습니다")

    # 이벤트명 조회 (프로젝트 배지인 경우)
    event_name = None
    if badge.get("event_id"):
        event = db.get_event(badge["event_id"])
        event_name = event.get("title") if event else None

    template_type = template or badge.get("template_type", "minimal")

    svg = render_badge_svg(
        badge_type=badge["badge_type"],
        badge_level=badge["badge_level"],
        title=badge["title"],
        description=badge.get("description", ""),
        icon=badge.get("icon", "🏅"),
        earned_at=badge["earned_at"],
        worker_id=worker["id"],
        worker_name=worker.get("name"),
        template_type=template_type,
        event_name=event_name
    )

    return Response(content=svg, media_type="image/svg+xml")


@router.get("/render/admin/{badge_id}")
async def render_badge_image_admin(
    badge_id: int,
    template: Optional[str] = None,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """배지 SVG 이미지 렌더링 (관리자용, 모든 배지)"""
    badge = db.get_badge_by_id(badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="배지를 찾을 수 없습니다")

    worker = db.get_worker_by_id(badge["worker_id"])
    worker_name = worker.get("name") if worker else None

    event_name = None
    if badge.get("event_id"):
        event = db.get_event(badge["event_id"])
        event_name = event.get("title") if event else None

    template_type = template or badge.get("template_type", "minimal")

    svg = render_badge_svg(
        badge_type=badge["badge_type"],
        badge_level=badge["badge_level"],
        title=badge["title"],
        description=badge.get("description", ""),
        icon=badge.get("icon", "🏅"),
        earned_at=badge["earned_at"],
        worker_id=badge["worker_id"],
        worker_name=worker_name,
        template_type=template_type,
        event_name=event_name
    )

    return Response(content=svg, media_type="image/svg+xml")


@router.post("/render")
async def render_custom_badge(request: RenderRequest):
    """
    POST /nft/render
    커스텀 SVG 렌더링 (미리보기용)

    Request:
    {
        "title": "프로젝트 참여",
        "description": "2024 신년 행사 참여",
        "icon": "🎖️",
        "grade": "RARE",
        "template": "cert",
        "event_name": "2024 신년 행사",
        "worker_id": 1,
        "issued_date": "2024-01-15"
    }

    Response: SVG 이미지
    """
    if request.template not in TEMPLATE_TYPES:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 템플릿입니다. 사용 가능: {TEMPLATE_TYPES}")

    if request.grade not in GRADE_COLORS:
        raise HTTPException(status_code=400, detail=f"지원하지 않는 등급입니다. 사용 가능: {list(GRADE_COLORS.keys())}")

    # 날짜 파싱
    if request.issued_date:
        try:
            earned_at = datetime.strptime(request.issued_date, "%Y-%m-%d")
        except ValueError:
            earned_at = datetime.now()
    else:
        earned_at = datetime.now()

    svg = render_badge_svg(
        badge_type="PROJECT",
        badge_level=1,
        title=request.title,
        description=request.description or "",
        icon=request.icon,
        earned_at=earned_at,
        worker_id=request.worker_id or 0,
        template_type=request.template,
        event_name=request.event_name,
        grade_override=request.grade
    )

    return Response(content=svg, media_type="image/svg+xml")


# ===== Preview & Info =====

@router.get("/preview/{badge_type}/{badge_level}")
async def preview_badge(
    badge_type: str,
    badge_level: int,
    template: str = "minimal"
):
    """배지 미리보기 (인증 불필요)"""
    from .badges import BADGE_DEFINITIONS

    if badge_type not in BADGE_DEFINITIONS:
        raise HTTPException(status_code=404, detail="존재하지 않는 배지 유형입니다")

    if badge_level not in BADGE_DEFINITIONS[badge_type]:
        raise HTTPException(status_code=404, detail="존재하지 않는 배지 레벨입니다")

    badge_def = BADGE_DEFINITIONS[badge_type][badge_level]

    svg = render_badge_svg(
        badge_type=badge_type,
        badge_level=badge_level,
        title=badge_def["title"],
        description=badge_def["description"],
        icon=badge_def["icon"],
        earned_at=datetime.now(),
        worker_id=0,
        worker_name="미리보기",
        template_type=template
    )

    return Response(content=svg, media_type="image/svg+xml")


@router.get("/metadata/{badge_id}")
async def get_badge_metadata(
    badge_id: int,
    user: dict = Depends(require_auth),
    db: Database = Depends(get_db)
):
    """배지 NFT 메타데이터 조회 (OpenSea 호환)"""
    telegram_id = user.get("telegram_id")
    worker = db.get_worker_by_telegram_id(telegram_id)

    if not worker:
        raise HTTPException(status_code=404, detail="근무자 정보가 없습니다")

    badge = db.get_badge_by_id(badge_id)
    if not badge:
        raise HTTPException(status_code=404, detail="배지를 찾을 수 없습니다")

    if badge["worker_id"] != worker["id"]:
        raise HTTPException(status_code=403, detail="본인의 배지만 조회할 수 있습니다")

    event_name = None
    if badge.get("event_id"):
        event = db.get_event(badge["event_id"])
        event_name = event.get("title") if event else None

    image_url = f"/api/nft/render/{badge_id}"

    metadata = generate_nft_metadata(
        badge_id=badge_id,
        badge_type=badge["badge_type"],
        badge_level=badge["badge_level"],
        title=badge["title"],
        description=badge.get("description", ""),
        icon=badge.get("icon", "🏅"),
        earned_at=badge["earned_at"],
        worker_id=worker["id"],
        image_url=image_url,
        event_name=event_name
    )

    return JSONResponse(content=metadata)


@router.get("/grades")
async def get_grade_info():
    """등급 정보 조회"""
    return {
        "grades": GRADE_COLORS,
        "badge_grade_mapping": BADGE_GRADE_MAPPING,
        "templates": TEMPLATE_TYPES
    }


# ===== Admin Endpoints =====

@router.get("/admin/events/completed")
async def get_completed_events(
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """
    GET /admin/events/completed
    종료된 이벤트 목록 (NFT 발행 가능)

    Response:
    {
        "events": [
            {
                "id": 1,
                "title": "2024 신년 행사",
                "status": "COMPLETED",
                "completed_workers": 15,
                "batch_count": 1
            }
        ]
    }
    """
    events = db.get_completed_events()

    return {
        "events": [{
            "id": e["id"],
            "title": e.get("title"),
            "location": e.get("location"),
            "event_date": str(e.get("event_date")) if e.get("event_date") else None,
            "status": e["status"],
            "completed_workers": e.get("completed_workers", 0),
            "batch_count": e.get("batch_count", 0),
            "updated_at": str(e.get("updated_at")) if e.get("updated_at") else None
        } for e in events]
    }


@router.get("/admin/events/{event_id}/eligible-workers")
async def get_eligible_workers(
    event_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """이벤트의 배지 발급 대상 근무자 목록"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")

    if event["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="종료된 이벤트만 NFT 발행이 가능합니다")

    workers = db.get_event_eligible_workers(event_id)

    return {
        "event_id": event_id,
        "event_title": event.get("title"),
        "workers": [{
            "id": w["id"],
            "name": w.get("name"),
            "phone": w.get("phone"),
            "check_in_time": str(w.get("check_in_time")) if w.get("check_in_time") else None,
            "check_out_time": str(w.get("check_out_time")) if w.get("check_out_time") else None,
            "has_project_badge": w.get("has_project_badge", 0) > 0
        } for w in workers]
    }


@router.post("/admin/events/{event_id}/nft-issue")
async def issue_project_badges(
    event_id: int,
    request: ProjectIssueRequest,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """
    POST /admin/events/:event_id/nft-issue
    프로젝트 배지 일괄 발급

    Request:
    {
        "title": "2024 신년 행사 참여",
        "description": "행사에 참여해주셔서 감사합니다",
        "icon": "🎖️",
        "grade": "RARE",
        "template": "cert",
        "worker_ids": [1, 2, 3]
    }

    Response:
    {
        "batch_id": 1,
        "issued_count": 3,
        "skipped_count": 0,
        "issued_badges": [...]
    }
    """
    # 이벤트 확인
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="이벤트를 찾을 수 없습니다")

    if event["status"] != "COMPLETED":
        raise HTTPException(status_code=400, detail="종료된 이벤트만 NFT 발행이 가능합니다")

    if not request.worker_ids:
        raise HTTPException(status_code=400, detail="발급 대상 근무자를 선택해주세요")

    # 관리자 정보
    admin_telegram_id = admin.get("telegram_id")
    admin_worker = db.get_worker_by_telegram_id(admin_telegram_id)
    admin_id = admin_worker["id"] if admin_worker else None

    # 배치 생성
    batch_id = db.create_nft_batch(
        event_id=event_id,
        title=request.title,
        description=request.description,
        template_type=request.template,
        issued_by=admin_id,
        metadata={"grade": request.grade, "icon": request.icon}
    )

    # 배지 발급
    issued_badges = []
    skipped = 0

    for worker_id in request.worker_ids:
        # 해당 이벤트에 출근한 근무자인지 확인
        eligible_workers = db.get_event_eligible_workers(event_id)
        eligible_ids = [w["id"] for w in eligible_workers]

        if worker_id not in eligible_ids:
            skipped += 1
            continue

        badge_id = db.award_project_badge(
            worker_id=worker_id,
            event_id=event_id,
            batch_id=batch_id,
            title=request.title,
            description=request.description,
            icon=request.icon,
            template_type=request.template
        )

        if badge_id:
            issued_badges.append({
                "badge_id": badge_id,
                "worker_id": worker_id
            })

            # 감사 로그
            db.create_audit_log(
                action="BADGE_ISSUED",
                entity_type="worker_badges",
                entity_id=badge_id,
                actor_id=admin_id,
                actor_type="ADMIN",
                details={
                    "event_id": event_id,
                    "batch_id": batch_id,
                    "title": request.title
                }
            )
        else:
            skipped += 1  # 이미 발급됨

    # 배치 수량 업데이트
    db.update_batch_count(batch_id, len(issued_badges))

    return {
        "batch_id": batch_id,
        "event_id": event_id,
        "issued_count": len(issued_badges),
        "skipped_count": skipped,
        "issued_badges": issued_badges
    }
