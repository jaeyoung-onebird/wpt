import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, DateTime, Integer, Numeric, ForeignKey, Date, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class WorkerPublic(Base):
    __tablename__ = "workers_public"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    nickname: Mapped[str] = mapped_column(String(50), nullable=False)
    profile_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    work_types: Mapped[list] = mapped_column(ARRAY(String), default=[])
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    trust_score: Mapped[float] = mapped_column(Numeric(3, 2), default=3.00)
    total_jobs: Mapped[int] = mapped_column(Integer, default=0)
    rating_avg: Mapped[float] = mapped_column(Numeric(3, 2), default=0)
    rating_count: Mapped[int] = mapped_column(Integer, default=0)
    no_show_count: Mapped[int] = mapped_column(Integer, default=0)
    late_count: Mapped[int] = mapped_column(Integer, default=0)
    signup_source: Mapped[str] = mapped_column(String(20), nullable=False)  # direct, org_invited
    invited_by_org_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="worker_profile")
    private_info = relationship("WorkerPrivate", back_populates="worker", uselist=False)
    preferences = relationship("WorkerPreferences", back_populates="worker", uselist=False)
    applications = relationship("Application", back_populates="worker")
    following_orgs = relationship("WorkerOrgFollow", back_populates="worker")
    blocked_orgs = relationship("WorkerOrgBlock", back_populates="worker")

    def __repr__(self) -> str:
        return f"<WorkerPublic {self.nickname}>"


class WorkerPrivate(Base):
    __tablename__ = "workers_private"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), unique=True, nullable=False)
    real_name: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    birthdate: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(10), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_account: Mapped[str | None] = mapped_column(String(50), nullable=True)
    account_holder: Mapped[str | None] = mapped_column(String(50), nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    worker = relationship("WorkerPublic", back_populates="private_info")

    def __repr__(self) -> str:
        return f"<WorkerPrivate {self.real_name}>"


class WorkerPreferences(Base):
    __tablename__ = "worker_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), unique=True, nullable=False)
    preferred_days_per_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferred_monthly_income: Mapped[int | None] = mapped_column(Integer, nullable=True)
    preferred_time_slot: Mapped[str | None] = mapped_column(String(20), nullable=True)  # morning, afternoon, evening, flexible
    preferred_regions: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    preferred_work_types: Mapped[list | None] = mapped_column(ARRAY(String), nullable=True)
    unavailable_weekdays: Mapped[list | None] = mapped_column(ARRAY(Integer), nullable=True)  # 0=Sunday, 6=Saturday
    min_hourly_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_recommendation_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    worker = relationship("WorkerPublic", back_populates="preferences")

    def __repr__(self) -> str:
        return f"<WorkerPreferences worker={self.worker_id}>"


class WorkerUnavailableDate(Base):
    __tablename__ = "worker_unavailable_dates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    unavailable_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<WorkerUnavailableDate {self.unavailable_date}>"
