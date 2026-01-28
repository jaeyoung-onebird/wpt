"""Applications Routes"""
from fastapi import APIRouter, Depends, HTTPException

from ..dependencies import get_db, require_auth, require_admin, require_worker
from ..schemas.application import (
    ApplicationCreate, ApplicationStatusUpdate, ApplicationResponse, ApplicationListResponse
)
from db import Database

router = APIRouter()


def _enrich_application(app: dict, db: Database) -> dict:
    """지원에 행사, 근무자 정보 추가"""
    # 행사 정보
    event = db.get_event(app.get("event_id"))
    if event:
        app["event_title"] = event.get("title")
        app["event_date"] = event.get("event_date")

    # 근무자 정보
    with db.get_connection() as conn:
        from psycopg2.extras import RealDictCursor
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT name, phone FROM workers WHERE id = %s", (app.get("worker_id"),))
        worker = cursor.fetchone()
        if worker:
            app["worker_name"] = worker["name"]
            app["worker_phone"] = worker["phone"]

    return app


@router.post("", response_model=ApplicationResponse)
async def create_application(
    data: ApplicationCreate,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """행사에 지원"""
    worker = auth["worker"]
    worker_id = worker["id"]

    # 행사 확인
    event = db.get_event(data.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    if event.get("status") != "OPEN":
        raise HTTPException(status_code=400, detail="모집이 마감된 행사입니다")

    # 중복 지원 확인
    existing = db.get_application_by_worker_event(worker_id, data.event_id)
    if existing:
        raise HTTPException(status_code=400, detail="이미 지원한 행사입니다")

    # 지원 생성
    app_id = db.create_application(data.event_id, worker_id)
    if not app_id:
        raise HTTPException(status_code=500, detail="지원 생성 실패")

    app = db.get_application(app_id)
    return ApplicationResponse(**_enrich_application(app, db))


@router.get("/me", response_model=ApplicationListResponse)
async def get_my_applications(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """내 지원 내역"""
    worker = auth["worker"]
    apps = db.list_applications_by_worker(worker["id"])

    return ApplicationListResponse(
        total=len(apps),
        applications=[ApplicationResponse(**_enrich_application(a, db)) for a in apps]
    )


@router.get("/{app_id}", response_model=ApplicationResponse)
async def get_application(
    app_id: int,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """지원 상세 (관리자 전용)"""
    app = db.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="지원을 찾을 수 없습니다")

    return ApplicationResponse(**_enrich_application(app, db))


@router.patch("/{app_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    app_id: int,
    data: ApplicationStatusUpdate,
    admin: dict = Depends(require_admin),
    db: Database = Depends(get_db)
):
    """지원 상태 변경 (관리자 전용)"""
    app = db.get_application(app_id)
    if not app:
        raise HTTPException(status_code=404, detail="지원을 찾을 수 없습니다")

    admin_id = admin.get("telegram_id")

    # 상태 업데이트
    db.update_application_status(
        app_id,
        data.status.value,
        confirmed_by=admin_id if data.status.value == "CONFIRMED" else None,
        rejection_reason=data.rejection_reason
    )

    # 행사 정보 가져오기
    event = db.get_event(app["event_id"])
    event_title = event.get("title", "행사") if event else "행사"

    # CONFIRMED 시 출석 레코드 생성 및 알림
    if data.status.value == "CONFIRMED":
        existing_attendance = db.get_attendance_by_application(app_id)
        if not existing_attendance:
            from utils import generate_check_in_code
            check_in_code = generate_check_in_code()
            db.create_attendance(
                application_id=app_id,
                event_id=app["event_id"],
                worker_id=app["worker_id"],
                check_in_code=check_in_code
            )

        # 확정 알림 생성
        db.create_notification(
            worker_id=app["worker_id"],
            notification_type="APPLICATION_CONFIRMED",
            title="지원 확정",
            message=f"'{event_title}' 지원이 확정되었습니다. 행사 당일 출근 코드로 출석해주세요.",
            data=str(app["event_id"])
        )

    # REJECTED 시 알림
    elif data.status.value == "REJECTED":
        reason = data.rejection_reason or "사유 없음"
        db.create_notification(
            worker_id=app["worker_id"],
            notification_type="APPLICATION_REJECTED",
            title="지원 결과",
            message=f"'{event_title}' 지원이 반려되었습니다. 사유: {reason}",
            data=str(app["event_id"])
        )

    updated = db.get_application(app_id)
    return ApplicationResponse(**_enrich_application(updated, db))


@router.delete("/{app_id}")
async def cancel_application(
    app_id: int,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """지원 취소"""
    worker = auth["worker"]
    app = db.get_application(app_id)

    if not app:
        raise HTTPException(status_code=404, detail="지원을 찾을 수 없습니다")

    if app["worker_id"] != worker["id"]:
        raise HTTPException(status_code=403, detail="본인의 지원만 취소할 수 있습니다")

    if app["status"] != "PENDING":
        raise HTTPException(status_code=400, detail="대기 상태의 지원만 취소할 수 있습니다")

    with db.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM applications WHERE id = %s", (app_id,))
        conn.commit()

    return {"message": "지원이 취소되었습니다", "id": app_id}
