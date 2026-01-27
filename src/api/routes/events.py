"""Events Routes"""
from fastapi import APIRouter, Depends, HTTPException, Query

from ..dependencies import get_db, require_auth, require_admin, get_current_user
from ..schemas.event import (
    EventCreate, EventUpdate, EventResponse, EventListResponse, EventStatus
)
from db import Database

router = APIRouter()


def _enrich_event(event: dict, db: Database) -> dict:
    """행사에 지원자 수 등 추가 정보 부여"""
    apps = db.list_applications_by_event(event["id"])
    event["application_count"] = len(apps)
    event["confirmed_count"] = len([a for a in apps if a.get("status") == "CONFIRMED"])

    # 지역 정보 추가
    if event.get("region_id"):
        region = db.get_region(event["region_id"])
        if region:
            event["region_name"] = f"{region['sido']} {region['sigungu']}"

    # 업종 정보 추가
    if event.get("category_id"):
        category = db.get_job_category(event["category_id"])
        if category:
            event["category_name"] = category["name"]

    return event


@router.post("", response_model=EventResponse)
async def create_event(
    data: EventCreate,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사 생성 (관리자 전용)"""
    # short_code 생성
    short_code = db.generate_short_code()

    event_id = db.create_event(
        short_code=short_code,
        title=data.title,
        event_date=data.event_date,
        location=data.location,
        pay_amount=data.pay_amount,
        created_by=admin.get("telegram_id"),
        start_time=data.start_time,
        end_time=data.end_time,
        pay_description=data.pay_description,
        headcount=data.headcount,
        work_type=data.work_type,
        dress_code=data.dress_code,
        age_requirement=data.age_requirement,
        meal_provided=data.meal_provided,
        requires_driver_license=data.requires_driver_license,
        requires_security_cert=data.requires_security_cert,
        manager_name=data.manager_name,
        manager_phone=data.manager_phone,
        region_id=data.region_id,
        category_id=data.category_id
    )

    event = db.get_event(event_id)
    return EventResponse(**_enrich_event(event, db))


@router.get("", response_model=EventListResponse)
async def list_events(
    status: str | None = Query(None, description="OPEN, CLOSED, COMPLETED"),
    limit: int = 50,
    user: dict | None = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """행사 목록 (모든 사용자)"""
    events = db.list_events(status=status, limit=limit)

    # 모든 사용자가 행사 목록을 볼 수 있음 (프론트엔드에서 날짜 지난 행사는 "행사 종료"로 표시)

    return EventListResponse(
        total=len(events),
        events=[EventResponse(**_enrich_event(e, db)) for e in events]
    )


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: int,
    db: Database = Depends(get_db)
):
    """행사 상세 (모든 사용자)"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    return EventResponse(**_enrich_event(event, db))


@router.get("/code/{short_code}", response_model=EventResponse)
async def get_event_by_code(
    short_code: str,
    db: Database = Depends(get_db)
):
    """short_code로 행사 조회"""
    event = db.get_event_by_short_code(short_code)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    return EventResponse(**_enrich_event(event, db))


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    data: EventUpdate,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사 수정 (관리자 전용)"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    # None이 아닌 필드만 업데이트
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}

    if update_data:
        # status는 별도 처리
        if "status" in update_data:
            db.update_event_status(event_id, update_data.pop("status"))

        # 나머지 필드 업데이트
        if update_data:
            with db.get_connection() as conn:
                cursor = conn.cursor()
                set_clause = ", ".join(f"{k} = %s" for k in update_data.keys())
                cursor.execute(
                    f"UPDATE events SET {set_clause}, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (*update_data.values(), event_id)
                )

    updated = db.get_event(event_id)
    return EventResponse(**_enrich_event(updated, db))


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """행사 삭제 (관리자 전용)"""
    event = db.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM events WHERE id = %s", (event_id,))
        conn.commit()

    return {"message": "행사가 삭제되었습니다", "id": event_id}
