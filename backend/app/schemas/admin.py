from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from decimal import Decimal


# Organization management
class OrgVerifyRequest(BaseModel):
    """Verify organization request"""
    is_verified: bool
    note: str | None = Field(None, max_length=500)


class OrgAdminResponse(BaseModel):
    """Organization response for admin"""
    id: UUID
    name: str
    business_number: str
    representative_name: str
    business_type: str
    address: str
    contact_phone: str
    contact_email: str | None
    is_verified: bool
    follower_count: int
    rating_avg: Decimal
    total_events: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrgListAdminResponse(BaseModel):
    """Organization list for admin"""
    id: UUID
    name: str
    business_number: str
    is_verified: bool
    follower_count: int
    created_at: datetime

    class Config:
        from_attributes = True


# User management
class UserAdminResponse(BaseModel):
    """User response for admin"""
    id: UUID
    phone: str
    email: str | None
    name: str
    platform_role: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None
    has_worker_profile: bool
    has_org_membership: bool

    class Config:
        from_attributes = True


class UserRoleUpdate(BaseModel):
    """Update user's platform role"""
    platform_role: str = Field(..., pattern=r"^(user|admin|super_admin)$")


class UserStatusUpdate(BaseModel):
    """Update user's active status"""
    is_active: bool


# Worker management
class WorkerAdminResponse(BaseModel):
    """Worker response for admin"""
    id: UUID
    user_id: UUID
    nickname: str
    real_name: str | None
    phone: str | None
    region: str | None
    trust_score: Decimal
    total_jobs: int
    no_show_count: int
    late_count: int
    signup_source: str
    created_at: datetime

    class Config:
        from_attributes = True


class TrustScoreUpdate(BaseModel):
    """Manually adjust trust score"""
    trust_score: Decimal = Field(..., ge=0, le=5)
    reason: str = Field(..., max_length=500)


# Platform statistics
class PlatformStats(BaseModel):
    """Platform-wide statistics"""
    total_users: int
    total_workers: int
    total_organizations: int
    verified_organizations: int
    total_events: int
    active_events: int
    total_applications: int
    total_payroll_amount: int


class DailyStats(BaseModel):
    """Daily statistics"""
    date: str
    new_users: int
    new_workers: int
    new_orgs: int
    new_events: int
    new_applications: int
    completed_jobs: int
    total_paid: int
