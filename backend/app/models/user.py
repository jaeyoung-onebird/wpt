import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    platform_role: Mapped[str] = mapped_column(String(20), default="user")  # user, admin, super_admin
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    org_memberships = relationship("OrgMember", back_populates="user", foreign_keys="OrgMember.user_id")
    worker_profile = relationship("WorkerPublic", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user")

    def __repr__(self) -> str:
        return f"<User {self.phone}>"
