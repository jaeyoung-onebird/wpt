import uuid
from datetime import datetime, date, time
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Date, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Event(Base):
    """Event (job posting)"""
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    venue_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    venue_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    venue_region: Mapped[str | None] = mapped_column(String(50), nullable=True)
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft, published, closed, completed, cancelled
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    organization = relationship("Organization", back_populates="events")
    creator = relationship("User")
    positions = relationship("EventPosition", back_populates="event", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="event", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Event {self.title} ({self.work_date})>"


class EventPosition(Base):
    """Position within an event"""
    __tablename__ = "event_positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    required_count: Mapped[int] = mapped_column(Integer, nullable=False)
    confirmed_count: Mapped[int] = mapped_column(Integer, default=0)
    hourly_rate: Mapped[int] = mapped_column(Integer, nullable=False)

    # Relationships
    event = relationship("Event", back_populates="positions")
    applications = relationship("Application", back_populates="position")

    def __repr__(self) -> str:
        return f"<EventPosition {self.name} ({self.confirmed_count}/{self.required_count})>"


class Application(Base):
    """Application for an event"""
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    position_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("event_positions.id"), nullable=False)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, accepted, rejected, cancelled, completed, no_show
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    event = relationship("Event", back_populates="applications")
    position = relationship("EventPosition", back_populates="applications")
    worker = relationship("WorkerPublic", back_populates="applications")
    attendance = relationship("Attendance", back_populates="application", uselist=False)

    def __repr__(self) -> str:
        return f"<Application event={self.event_id} worker={self.worker_id} status={self.status}>"
