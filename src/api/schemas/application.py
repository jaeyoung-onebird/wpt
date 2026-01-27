"""Application Schemas"""
from pydantic import BaseModel
from enum import Enum


class ApplicationStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    WAITLIST = "WAITLIST"


class ApplicationCreate(BaseModel):
    """지원 생성"""
    event_id: int


class ApplicationStatusUpdate(BaseModel):
    """지원 상태 변경"""
    status: ApplicationStatus
    rejection_reason: str | None = None


class ApplicationResponse(BaseModel):
    """지원 정보 응답"""
    id: int
    event_id: int
    worker_id: int
    status: str
    applied_at: str | None = None
    confirmed_at: str | None = None
    confirmed_by: int | None = None
    rejection_reason: str | None = None
    # 관계 데이터
    event_title: str | None = None
    event_date: str | None = None
    worker_name: str | None = None
    worker_phone: str | None = None

    class Config:
        from_attributes = True


class ApplicationListResponse(BaseModel):
    """지원 목록 응답"""
    total: int
    applications: list[ApplicationResponse]
