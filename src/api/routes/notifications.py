"""Notifications Routes"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from ..dependencies import get_db, require_worker
from db import Database

router = APIRouter()


class NotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    data: Optional[str] = None
    is_read: bool = False
    created_at: str

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    notifications: List[NotificationResponse]


@router.get("", response_model=NotificationListResponse)
async def get_my_notifications(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """내 알림 목록"""
    worker = auth["worker"]
    notifications = db.get_notifications(worker["id"])
    unread_count = db.get_unread_notification_count(worker["id"])

    return NotificationListResponse(
        total=len(notifications),
        unread_count=unread_count,
        notifications=[NotificationResponse(**n) for n in notifications]
    )


@router.get("/unread-count")
async def get_unread_count(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """읽지 않은 알림 수"""
    worker = auth["worker"]
    count = db.get_unread_notification_count(worker["id"])
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """알림 읽음 처리"""
    db.mark_notification_read(notification_id)
    return {"message": "읽음 처리 완료"}


@router.post("/read-all")
async def mark_all_as_read(
    auth: dict = Depends(require_worker),
    db: Database = Depends(get_db)
):
    """모든 알림 읽음 처리"""
    worker = auth["worker"]
    db.mark_all_notifications_read(worker["id"])
    return {"message": "모든 알림 읽음 처리 완료"}
