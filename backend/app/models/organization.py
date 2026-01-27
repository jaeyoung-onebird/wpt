import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    business_number: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    business_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    plan: Mapped[str] = mapped_column(String(20), default="free")
    invite_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    invite_link_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    rating_avg: Mapped[float] = mapped_column(Numeric(3, 2), default=0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    members = relationship("OrgMember", back_populates="organization")
    events = relationship("Event", back_populates="organization")
    following_workers = relationship("OrgWorkerFollow", back_populates="organization")
    blocked_workers = relationship("OrgWorkerBlock", back_populates="organization")

    def __repr__(self) -> str:
        return f"<Organization {self.name}>"


class OrgMember(Base):
    __tablename__ = "org_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # owner, admin, manager, viewer
    invited_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="org_memberships", foreign_keys=[user_id])

    def __repr__(self) -> str:
        return f"<OrgMember org={self.org_id} user={self.user_id} role={self.role}>"


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invite_type: Mapped[str] = mapped_column(String(20), nullable=False)  # org_member, worker
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    token: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, accepted, expired
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")

    def __repr__(self) -> str:
        return f"<Invite {self.token} type={self.invite_type}>"
