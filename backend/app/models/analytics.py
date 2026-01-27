import uuid
from datetime import datetime, date
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Numeric, Date
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class BehaviorLog(Base):
    """User behavior log for analytics"""
    __tablename__ = "behavior_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(50), nullable=False)  # view, click, apply, etc.
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # event, worker, org, etc.
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    extra_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    device_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # mobile, desktop, tablet
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<BehaviorLog {self.action} user={self.user_id}>"


class MatchingOutcome(Base):
    """Matching outcome for ML training"""
    __tablename__ = "matching_outcomes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id"), nullable=False)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    was_recommended: Mapped[bool] = mapped_column(default=False)
    recommendation_score: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    application_result: Mapped[str] = mapped_column(String(20), nullable=False)  # accepted, rejected, cancelled
    attendance_result: Mapped[str | None] = mapped_column(String(20), nullable=True)  # completed, no_show, early_leave
    was_late: Mapped[bool | None] = mapped_column(nullable=True)
    late_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    worker_features: Mapped[str] = mapped_column(Text, nullable=False)  # JSON snapshot of worker features at time of application
    event_features: Mapped[str] = mapped_column(Text, nullable=False)  # JSON snapshot of event features
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    application = relationship("Application")
    worker = relationship("WorkerPublic")
    event = relationship("Event")
    organization = relationship("Organization")

    def __repr__(self) -> str:
        return f"<MatchingOutcome app={self.application_id} result={self.application_result}>"


class MarketTrendDaily(Base):
    """Daily market trend statistics"""
    __tablename__ = "market_trends_daily"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    trend_date: Mapped[date] = mapped_column(Date, nullable=False)
    region: Mapped[str] = mapped_column(String(50), nullable=False)
    work_type: Mapped[str] = mapped_column(String(50), nullable=False)
    avg_hourly_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    min_hourly_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    max_hourly_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    total_positions: Mapped[int] = mapped_column(Integer, nullable=False)
    total_applications: Mapped[int] = mapped_column(Integer, nullable=False)
    fill_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)  # filled positions / total positions
    competition_rate: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)  # applications / positions
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    def __repr__(self) -> str:
        return f"<MarketTrendDaily {self.trend_date} {self.region} {self.work_type}>"


class WorkerMetricsMonthly(Base):
    """Monthly worker performance metrics"""
    __tablename__ = "worker_metrics_monthly"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    year_month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM format
    total_applications: Mapped[int] = mapped_column(Integer, default=0)
    accepted_count: Mapped[int] = mapped_column(Integer, default=0)
    completed_count: Mapped[int] = mapped_column(Integer, default=0)
    no_show_count: Mapped[int] = mapped_column(Integer, default=0)
    late_count: Mapped[int] = mapped_column(Integer, default=0)
    total_worked_minutes: Mapped[int] = mapped_column(Integer, default=0)
    total_earned: Mapped[int] = mapped_column(Integer, default=0)
    avg_hourly_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    acceptance_rate: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    completion_rate: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    worker = relationship("WorkerPublic")

    def __repr__(self) -> str:
        return f"<WorkerMetricsMonthly worker={self.worker_id} {self.year_month}>"


class OrgMetricsMonthly(Base):
    """Monthly organization performance metrics"""
    __tablename__ = "org_metrics_monthly"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    year_month: Mapped[str] = mapped_column(String(7), nullable=False)  # YYYY-MM format
    total_events: Mapped[int] = mapped_column(Integer, default=0)
    total_positions: Mapped[int] = mapped_column(Integer, default=0)
    filled_positions: Mapped[int] = mapped_column(Integer, default=0)
    total_applications: Mapped[int] = mapped_column(Integer, default=0)
    unique_workers: Mapped[int] = mapped_column(Integer, default=0)
    no_show_count: Mapped[int] = mapped_column(Integer, default=0)
    total_paid: Mapped[int] = mapped_column(Integer, default=0)
    avg_hourly_rate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fill_rate: Mapped[float | None] = mapped_column(Numeric(5, 4), nullable=True)
    competition_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")

    def __repr__(self) -> str:
        return f"<OrgMetricsMonthly org={self.org_id} {self.year_month}>"
