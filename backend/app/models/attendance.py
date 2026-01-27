import uuid
from datetime import datetime, date, time
from sqlalchemy import String, DateTime, ForeignKey, Text, Integer, Boolean, Date, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Attendance(Base):
    """Attendance record"""
    __tablename__ = "attendance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id"), unique=True, nullable=False)
    scheduled_start: Mapped[time] = mapped_column(Time, nullable=False)
    scheduled_end: Mapped[time] = mapped_column(Time, nullable=False)
    check_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    check_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_late: Mapped[bool] = mapped_column(Boolean, default=False)
    late_minutes: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled, checked_in, completed, early_leave, no_show
    org_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    application = relationship("Application", back_populates="attendance")
    payroll = relationship("PayrollRecord", back_populates="attendance", uselist=False)

    def __repr__(self) -> str:
        return f"<Attendance app={self.application_id} status={self.status}>"


class PayrollRecord(Base):
    """Payroll record"""
    __tablename__ = "payroll_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    attendance_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("attendance.id"), nullable=False)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    worked_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    hourly_rate: Mapped[int] = mapped_column(Integer, nullable=False)
    base_pay: Mapped[int] = mapped_column(Integer, nullable=False)
    total_pay: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, paid, disputed
    worker_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    worker_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    attendance = relationship("Attendance", back_populates="payroll")
    worker = relationship("WorkerPublic")
    organization = relationship("Organization")
    event = relationship("Event")

    def __repr__(self) -> str:
        return f"<PayrollRecord worker={self.worker_id} amount={self.total_pay}>"
