"""
데이터 모델 및 Enum 정의
"""
from enum import Enum
from dataclasses import dataclass
from typing import Optional
from datetime import datetime


class ApplicationStatus(Enum):
    """지원 상태"""
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    REJECTED = "REJECTED"
    WAITLIST = "WAITLIST"


class AttendanceStatus(Enum):
    """출석 상태"""
    PENDING = "PENDING"
    CHECKED_IN = "CHECKED_IN"
    COMPLETED = "COMPLETED"


class EventStatus(Enum):
    """행사 상태"""
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    COMPLETED = "COMPLETED"


@dataclass
class Worker:
    """근무자 모델"""
    id: Optional[int] = None
    telegram_id: Optional[int] = None
    name: Optional[str] = None
    age: Optional[int] = None
    residence: Optional[str] = None
    phone: Optional[str] = None
    driving_experience: Optional[str] = None
    face_photo_file_id: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account: Optional[str] = None
    contract_signed: bool = False
    contract_sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class Event:
    """행사 모델"""
    id: Optional[int] = None
    short_code: Optional[str] = None
    title: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    location: Optional[str] = None
    pay_amount: Optional[int] = None
    pay_description: Optional[str] = None
    meal_provided: bool = False
    dress_code: Optional[str] = None
    age_requirement: Optional[str] = None
    application_method: Optional[str] = None
    manager_name: Optional[str] = None
    manager_phone: Optional[str] = None
    status: str = EventStatus.OPEN.value
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@dataclass
class Application:
    """지원 내역 모델"""
    id: Optional[int] = None
    event_id: Optional[int] = None
    worker_id: Optional[int] = None
    status: str = ApplicationStatus.PENDING.value
    applied_at: Optional[datetime] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[int] = None
    rejection_reason: Optional[str] = None
    notified: bool = False


@dataclass
class Attendance:
    """출석 기록 모델"""
    id: Optional[int] = None
    application_id: Optional[int] = None
    event_id: Optional[int] = None
    worker_id: Optional[int] = None
    check_in_code: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    worked_minutes: Optional[int] = None
    status: str = AttendanceStatus.PENDING.value
    completed_by: Optional[int] = None
    created_at: Optional[datetime] = None


@dataclass
class ChainLog:
    """블록체인 기록 모델"""
    id: Optional[int] = None
    attendance_id: Optional[int] = None
    event_id: Optional[int] = None
    worker_uid_hash: Optional[str] = None
    log_hash: Optional[str] = None
    tx_hash: Optional[str] = None
    block_number: Optional[int] = None
    network: str = "amoy"
    recorded_at: Optional[datetime] = None
    metadata_hash: Optional[str] = None
    created_at: Optional[datetime] = None


@dataclass
class ParsedEvent:
    """파싱된 행사 정보"""
    title: str
    date: str
    time: str
    location: str
    pay: str
    pay_amount: int  # 숫자만 추출
    pay_description: str
    meal: str
    dress_code: str
    age: str
    application_method: str
    manager: str
    missing_fields: list  # 누락된 필드
