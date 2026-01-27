"""Event Schemas"""
from pydantic import BaseModel
from enum import Enum


class EventStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    COMPLETED = "COMPLETED"


class EventCreate(BaseModel):
    """행사 생성"""
    title: str
    event_date: str  # YYYY-MM-DD
    start_time: str | None = None  # HH:MM
    end_time: str | None = None  # HH:MM
    location: str | None = None  # 상세 장소
    region_id: int | None = None  # 지역 마스터 ID
    category_id: int | None = None  # 업종 마스터 ID
    pay_amount: int
    pay_description: str | None = None
    headcount: int | None = None
    work_type: str | None = None  # 상세 업무
    dress_code: str | None = None
    age_requirement: str | None = None
    meal_provided: bool = False
    requires_driver_license: bool = False
    requires_security_cert: bool = False
    manager_name: str | None = None
    manager_phone: str | None = None


class EventUpdate(BaseModel):
    """행사 수정"""
    title: str | None = None
    event_date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    region_id: int | None = None
    category_id: int | None = None
    pay_amount: int | None = None
    pay_description: str | None = None
    headcount: int | None = None
    work_type: str | None = None
    dress_code: str | None = None
    age_requirement: str | None = None
    meal_provided: bool | None = None
    requires_driver_license: bool | None = None
    requires_security_cert: bool | None = None
    manager_name: str | None = None
    manager_phone: str | None = None
    status: EventStatus | None = None


class EventResponse(BaseModel):
    """행사 정보 응답"""
    id: int
    short_code: str
    title: str
    event_date: str
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    region_id: int | None = None
    region_name: str | None = None  # 시도 + 시군구
    category_id: int | None = None
    category_name: str | None = None  # 업종명
    pay_amount: int
    pay_description: str | None = None
    headcount: int | None = None
    work_type: str | None = None
    dress_code: str | None = None
    age_requirement: str | None = None
    meal_provided: bool = False
    requires_driver_license: bool = False
    requires_security_cert: bool = False
    manager_name: str | None = None
    manager_phone: str | None = None
    status: str = "OPEN"
    created_by: int | None = None
    created_at: str | None = None
    application_count: int = 0
    confirmed_count: int = 0

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    """행사 목록 응답"""
    total: int
    events: list[EventResponse]
