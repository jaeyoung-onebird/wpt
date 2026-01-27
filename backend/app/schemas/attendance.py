from pydantic import BaseModel, Field
from datetime import datetime, date, time
from uuid import UUID


# Attendance schemas
class CheckInRequest(BaseModel):
    """Check-in request"""
    application_id: UUID
    latitude: float | None = None
    longitude: float | None = None


class CheckOutRequest(BaseModel):
    """Check-out request"""
    attendance_id: UUID
    latitude: float | None = None
    longitude: float | None = None


class AttendanceResponse(BaseModel):
    """Attendance response"""
    id: UUID
    application_id: UUID
    event_title: str
    event_date: date
    position_title: str
    org_name: str
    scheduled_start: time
    scheduled_end: time
    check_in_at: datetime | None
    check_out_at: datetime | None
    actual_minutes: int | None
    is_late: bool
    late_minutes: int
    status: str
    org_note: str | None

    class Config:
        from_attributes = True


class AttendanceForOrgResponse(BaseModel):
    """Attendance response for organization"""
    id: UUID
    worker_id: UUID
    worker_nickname: str
    worker_profile_image: str | None
    position_title: str
    scheduled_start: time
    scheduled_end: time
    check_in_at: datetime | None
    check_out_at: datetime | None
    actual_minutes: int | None
    is_late: bool
    late_minutes: int
    status: str

    class Config:
        from_attributes = True


class AttendanceOrgNote(BaseModel):
    """Add org note to attendance"""
    note: str = Field(..., max_length=500)


# Payroll schemas
class PayrollResponse(BaseModel):
    """Payroll record response"""
    id: UUID
    attendance_id: UUID
    event_title: str
    event_date: date
    org_name: str
    work_date: date
    worked_minutes: int
    hourly_rate: int
    base_pay: int
    total_pay: int
    payment_status: str
    worker_confirmed: bool
    worker_confirmed_at: datetime | None
    paid_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class PayrollForOrgResponse(BaseModel):
    """Payroll for organization view"""
    id: UUID
    worker_id: UUID
    worker_nickname: str
    worker_real_name: str | None  # Only for accepted workers
    work_date: date
    worked_minutes: int
    hourly_rate: int
    base_pay: int
    total_pay: int
    payment_status: str
    worker_confirmed: bool

    class Config:
        from_attributes = True


class PayrollConfirmRequest(BaseModel):
    """Worker payroll confirmation"""
    payroll_id: UUID


class PayrollMarkPaidRequest(BaseModel):
    """Mark payroll as paid (org action)"""
    payroll_ids: list[UUID]


class PayrollSummary(BaseModel):
    """Payroll summary for a period"""
    total_records: int
    total_amount: int
    pending_amount: int
    paid_amount: int
    confirmed_count: int
    unconfirmed_count: int


# Schedule/Calendar
class ScheduleResponse(BaseModel):
    """Schedule item for calendar"""
    date: date
    event_id: UUID
    event_title: str
    org_name: str
    position_title: str
    start_time: time
    end_time: time
    status: str  # scheduled, checked_in, completed, etc.
    hourly_rate: int

    class Config:
        from_attributes = True
