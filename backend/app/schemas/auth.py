from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


# Request schemas
class PhoneVerifyRequest(BaseModel):
    """Phone verification request"""
    phone: str = Field(..., pattern=r"^01[0-9]{8,9}$", description="Phone number")


class PhoneVerifyConfirm(BaseModel):
    """Phone verification confirm"""
    phone: str = Field(..., pattern=r"^01[0-9]{8,9}$")
    code: str = Field(..., min_length=6, max_length=6)


class SignupRequest(BaseModel):
    """User signup request"""
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=2, max_length=50)
    phone: str | None = Field(None, pattern=r"^01[0-9]{8,9}$")
    # Worker specific
    nickname: str | None = Field(None, min_length=2, max_length=50)
    region: str | None = None
    work_types: list[str] | None = None
    # Invite code for org invited signup
    invite_code: str | None = None


class LoginRequest(BaseModel):
    """Login request - email based"""
    email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    password: str


class TokenRefreshRequest(BaseModel):
    """Token refresh request"""
    refresh_token: str


class PasswordResetRequest(BaseModel):
    """Password reset request"""
    phone: str = Field(..., pattern=r"^01[0-9]{8,9}$")
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)


# Response schemas
class TokenResponse(BaseModel):
    """Token response"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class UserResponse(BaseModel):
    """User response"""
    id: UUID
    phone: str | None
    email: str
    name: str
    is_active: bool
    created_at: datetime
    has_worker_profile: bool = False
    has_org_membership: bool = False

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    """Login response"""
    user: UserResponse
    tokens: TokenResponse
    worker_profile_id: UUID | None = None
    org_memberships: list[dict] = []
