from pydantic import BaseModel, Field
from datetime import datetime, date
from uuid import UUID
from decimal import Decimal


# Worker Public schemas
class WorkerProfileCreate(BaseModel):
    """Worker profile creation (for existing users)"""
    nickname: str = Field(..., min_length=2, max_length=50)
    region: str | None = Field(None, max_length=50)
    work_types: list[str] = []
    bio: str | None = None
    # Private info
    real_name: str = Field(..., min_length=2, max_length=50)
    phone: str = Field(..., pattern=r"^01[0-9]{8,9}$")
    birthdate: date | None = None
    gender: str | None = Field(None, pattern=r"^(male|female|other)$")


class WorkerProfileUpdate(BaseModel):
    """Worker profile update"""
    nickname: str | None = Field(None, min_length=2, max_length=50)
    profile_image_url: str | None = None
    region: str | None = Field(None, max_length=50)
    work_types: list[str] | None = None
    bio: str | None = None


class WorkerPrivateUpdate(BaseModel):
    """Worker private info update"""
    real_name: str | None = Field(None, min_length=2, max_length=50)
    phone: str | None = Field(None, pattern=r"^01[0-9]{8,9}$")
    birthdate: date | None = None
    gender: str | None = Field(None, pattern=r"^(male|female|other)$")
    bank_name: str | None = Field(None, max_length=50)
    bank_account: str | None = Field(None, max_length=50)
    account_holder: str | None = Field(None, max_length=50)
    emergency_contact: str | None = Field(None, pattern=r"^01[0-9]{8,9}$")


class WorkerPublicResponse(BaseModel):
    """Worker public profile response"""
    id: UUID
    nickname: str
    profile_image_url: str | None
    region: str | None
    work_types: list[str]
    bio: str | None
    trust_score: Decimal
    total_jobs: int
    rating_avg: Decimal
    rating_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class WorkerFullResponse(WorkerPublicResponse):
    """Worker full profile (for self)"""
    no_show_count: int
    late_count: int
    signup_source: str
    private_info: "WorkerPrivateResponse | None" = None
    preferences: "WorkerPreferencesResponse | None" = None


class WorkerPrivateResponse(BaseModel):
    """Worker private info response"""
    real_name: str
    phone: str
    birthdate: date | None
    gender: str | None
    bank_name: str | None
    bank_account: str | None
    account_holder: str | None
    emergency_contact: str | None

    class Config:
        from_attributes = True


class WorkerListResponse(BaseModel):
    """Worker list item (for org view)"""
    id: UUID
    nickname: str
    profile_image_url: str | None
    region: str | None
    work_types: list[str]
    trust_score: Decimal
    total_jobs: int
    is_following: bool = False
    is_blocked: bool = False

    class Config:
        from_attributes = True


# Preferences schemas
class WorkerPreferencesUpdate(BaseModel):
    """Worker preferences update"""
    preferred_days_per_week: int | None = Field(None, ge=1, le=7)
    preferred_monthly_income: int | None = Field(None, ge=0)
    preferred_time_slot: str | None = Field(None, pattern=r"^(morning|afternoon|evening|flexible)$")
    preferred_regions: list[str] | None = None
    preferred_work_types: list[str] | None = None
    unavailable_weekdays: list[int] | None = None  # 0-6
    min_hourly_rate: int | None = Field(None, ge=0)
    ai_recommendation_enabled: bool | None = None


class WorkerPreferencesResponse(BaseModel):
    """Worker preferences response"""
    preferred_days_per_week: int | None
    preferred_monthly_income: int | None
    preferred_time_slot: str | None
    preferred_regions: list[str] | None
    preferred_work_types: list[str] | None
    unavailable_weekdays: list[int] | None
    min_hourly_rate: int | None
    ai_recommendation_enabled: bool

    class Config:
        from_attributes = True


# Unavailable dates
class UnavailableDateCreate(BaseModel):
    """Add unavailable date"""
    unavailable_date: date
    reason: str | None = Field(None, max_length=100)


class UnavailableDateResponse(BaseModel):
    """Unavailable date response"""
    id: UUID
    unavailable_date: date
    reason: str | None

    class Config:
        from_attributes = True


# Follow/Block for workers
class FollowOrgRequest(BaseModel):
    """Follow organization request"""
    org_id: UUID


class FollowingOrgResponse(BaseModel):
    """Following organization response"""
    id: UUID
    org_id: UUID
    org_name: str
    org_logo_url: str | None
    is_mutual: bool
    followed_at: datetime

    class Config:
        from_attributes = True


class BlockOrgRequest(BaseModel):
    """Block organization request"""
    org_id: UUID
    reason: str | None = Field(None, max_length=200)
