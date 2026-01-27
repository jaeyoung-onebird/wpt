"""Attendance Schemas"""
from pydantic import BaseModel
from enum import Enum


class AttendanceStatus(str, Enum):
    PENDING = "PENDING"
    CHECKED_IN = "CHECKED_IN"
    COMPLETED = "COMPLETED"


class CheckInRequest(BaseModel):
    """출근 요청"""
    check_in_code: str


class CheckOutRequest(BaseModel):
    """퇴근 요청"""
    attendance_id: int | None = None


class AttendanceResponse(BaseModel):
    """출석 정보 응답"""
    id: int
    application_id: int
    event_id: int
    worker_id: int
    check_in_code: str
    check_in_time: str | None = None
    check_out_time: str | None = None
    worked_minutes: int | None = None
    status: str
    # 관계 데이터
    event_title: str | None = None
    event_date: str | None = None
    worker_name: str | None = None
    pay_amount: int | None = None
    # 블록체인 정보
    tx_hash: str | None = None
    block_number: int | None = None
    log_hash: str | None = None

    class Config:
        from_attributes = True


class AttendanceListResponse(BaseModel):
    """출석 목록 응답"""
    total: int
    attendance: list[AttendanceResponse]


class ChainLogResponse(BaseModel):
    """블록체인 기록 응답"""
    id: int
    attendance_id: int | None = None
    event_id: int | None = None
    worker_uid_hash: str | None = None
    log_hash: str | None = None
    tx_hash: str | None = None
    block_number: int | None = None
    network: str = "amoy"
    recorded_at: str | None = None
    created_at: str | None = None
    status: str | None = None
    # 관계 데이터
    event_title: str | None = None
    event_date: str | None = None

    class Config:
        from_attributes = True
