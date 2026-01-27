from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from decimal import Decimal


# Organization schemas
class OrgCreate(BaseModel):
    """Organization creation request"""
    name: str = Field(..., min_length=2, max_length=100)
    business_number: str = Field(..., pattern=r"^\d{10}$", description="사업자등록번호 10자리")
    representative_name: str = Field(..., min_length=2, max_length=50)
    business_type: str = Field(..., max_length=50)
    address: str = Field(..., max_length=200)
    contact_phone: str = Field(..., pattern=r"^0[0-9]{8,10}$")
    contact_email: str | None = Field(None, pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")


class OrgUpdate(BaseModel):
    """Organization update request"""
    name: str | None = Field(None, min_length=2, max_length=100)
    address: str | None = Field(None, max_length=200)
    contact_phone: str | None = Field(None, pattern=r"^0[0-9]{8,10}$")
    contact_email: str | None = Field(None, pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    logo_url: str | None = None
    description: str | None = None


class OrgResponse(BaseModel):
    """Organization response"""
    id: UUID
    name: str
    business_number: str
    representative_name: str
    business_type: str
    address: str
    contact_phone: str
    contact_email: str | None
    logo_url: str | None
    description: str | None
    is_verified: bool
    follower_count: int
    rating_avg: Decimal
    rating_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class OrgListResponse(BaseModel):
    """Organization list item"""
    id: UUID
    name: str
    logo_url: str | None
    business_type: str
    is_verified: bool
    follower_count: int
    rating_avg: Decimal

    class Config:
        from_attributes = True


# Member schemas
class MemberInvite(BaseModel):
    """Member invite request"""
    phone: str = Field(..., pattern=r"^01[0-9]{8,9}$")
    role: str = Field(..., pattern=r"^(admin|manager)$")


class MemberUpdate(BaseModel):
    """Member role update"""
    role: str = Field(..., pattern=r"^(admin|manager)$")


class MemberResponse(BaseModel):
    """Member response"""
    id: UUID
    user_id: UUID
    org_id: UUID
    role: str
    user_name: str
    user_phone: str
    joined_at: datetime

    class Config:
        from_attributes = True


# Invite schemas
class InviteResponse(BaseModel):
    """Invite link response"""
    invite_code: str
    invite_url: str
    expires_at: datetime


# Follow schemas
class FollowWorkerRequest(BaseModel):
    """Follow worker request"""
    worker_id: UUID
    note: str | None = Field(None, max_length=200)


class FollowerResponse(BaseModel):
    """Follower/Following response"""
    id: UUID
    worker_id: UUID
    nickname: str
    profile_image_url: str | None
    trust_score: Decimal
    total_jobs: int
    is_mutual: bool
    note: str | None
    followed_at: datetime

    class Config:
        from_attributes = True


class BlockWorkerRequest(BaseModel):
    """Block worker request"""
    worker_id: UUID
    reason: str | None = Field(None, max_length=200)


class BlockedWorkerResponse(BaseModel):
    """Blocked worker response"""
    id: UUID
    worker_id: UUID
    nickname: str
    reason: str | None
    blocked_at: datetime

    class Config:
        from_attributes = True
