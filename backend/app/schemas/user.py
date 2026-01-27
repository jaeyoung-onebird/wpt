from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID


class UserBase(BaseModel):
    """Base user schema"""
    phone: str
    email: str | None = None
    name: str


class UserUpdate(BaseModel):
    """User update schema"""
    email: str | None = Field(None, pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")
    name: str | None = Field(None, min_length=2, max_length=50)


class UserInDB(UserBase):
    """User in database"""
    id: UUID
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None

    class Config:
        from_attributes = True


class PasswordChangeRequest(BaseModel):
    """Password change request"""
    current_password: str
    new_password: str = Field(..., min_length=8)
