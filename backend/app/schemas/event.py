from pydantic import BaseModel, Field
from datetime import datetime, date, time
from uuid import UUID
from decimal import Decimal


# Event schemas
class EventPositionCreate(BaseModel):
    """Event position creation"""
    title: str = Field(..., min_length=2, max_length=100)
    work_type: str = Field(..., max_length=50)
    headcount: int = Field(..., ge=1)
    hourly_rate: int = Field(..., ge=0)
    description: str | None = None
    requirements: str | None = None


class EventCreate(BaseModel):
    """Event creation request"""
    title: str = Field(..., min_length=2, max_length=200)
    description: str | None = None
    event_date: date
    start_time: time
    end_time: time
    location_name: str = Field(..., max_length=100)
    location_address: str = Field(..., max_length=200)
    location_lat: Decimal | None = None
    location_lng: Decimal | None = None
    dress_code: str | None = Field(None, max_length=200)
    notes: str | None = None
    positions: list[EventPositionCreate] = Field(..., min_length=1)


class EventUpdate(BaseModel):
    """Event update request"""
    title: str | None = Field(None, min_length=2, max_length=200)
    description: str | None = None
    event_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    location_name: str | None = Field(None, max_length=100)
    location_address: str | None = Field(None, max_length=200)
    location_lat: Decimal | None = None
    location_lng: Decimal | None = None
    dress_code: str | None = None
    notes: str | None = None


class EventPositionResponse(BaseModel):
    """Event position response"""
    id: UUID
    title: str
    work_type: str
    headcount: int
    filled_count: int
    hourly_rate: int
    description: str | None
    requirements: str | None

    class Config:
        from_attributes = True


class EventResponse(BaseModel):
    """Event response"""
    id: UUID
    org_id: UUID
    org_name: str
    title: str
    description: str | None
    event_date: date
    start_time: time
    end_time: time
    location_name: str
    location_address: str
    location_lat: Decimal | None
    location_lng: Decimal | None
    dress_code: str | None
    notes: str | None
    status: str
    total_positions: int
    filled_positions: int
    positions: list[EventPositionResponse]
    created_at: datetime

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    """Event list item"""
    id: UUID
    org_id: UUID
    org_name: str
    org_logo_url: str | None
    title: str
    event_date: date
    start_time: time
    end_time: time
    location_name: str
    status: str
    total_positions: int
    filled_positions: int
    min_hourly_rate: int
    max_hourly_rate: int
    is_following_org: bool = False

    class Config:
        from_attributes = True


# Application schemas
class ApplicationCreate(BaseModel):
    """Application creation request"""
    position_id: UUID
    note: str | None = Field(None, max_length=500)


class ApplicationResponse(BaseModel):
    """Application response"""
    id: UUID
    event_id: UUID
    event_title: str
    event_date: date
    position_id: UUID
    position_title: str
    org_name: str
    status: str
    note: str | None
    applied_at: datetime
    reviewed_at: datetime | None
    rejection_reason: str | None

    class Config:
        from_attributes = True


class ApplicationForOrgResponse(BaseModel):
    """Application response for organization view"""
    id: UUID
    worker_id: UUID
    worker_nickname: str
    worker_profile_image: str | None
    worker_trust_score: Decimal
    worker_total_jobs: int
    position_id: UUID
    position_title: str
    status: str
    note: str | None
    applied_at: datetime
    is_following: bool = False

    class Config:
        from_attributes = True


class ApplicationReview(BaseModel):
    """Application review (accept/reject)"""
    status: str = Field(..., pattern=r"^(accepted|rejected)$")
    rejection_reason: str | None = Field(None, max_length=500)


# Search/Filter
class EventSearchParams(BaseModel):
    """Event search parameters"""
    region: str | None = None
    work_type: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    min_hourly_rate: int | None = None
    following_only: bool = False
    page: int = Field(1, ge=1)
    size: int = Field(20, ge=1, le=100)
