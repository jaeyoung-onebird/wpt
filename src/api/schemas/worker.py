"""Worker Schemas"""
from datetime import datetime
from pydantic import BaseModel


class WorkerCreate(BaseModel):
    """근무자 등록"""
    name: str
    phone: str
    birth_date: str | None = None
    gender: str | None = None
    residence: str | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    driver_license: bool = False
    security_cert: bool = False


class WorkerUpdate(BaseModel):
    """근무자 정보 수정"""
    name: str | None = None
    phone: str | None = None
    birth_date: str | None = None
    gender: str | None = None
    residence: str | None = None
    region_id: int | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    driver_license: bool | None = None
    security_cert: bool | None = None
    contract_signed: bool | None = None


class WorkerResponse(BaseModel):
    """근무자 정보 응답"""
    id: int
    telegram_id: int
    name: str
    phone: str
    email: str | None = None
    birth_date: str | None = None
    gender: str | None = None
    residence: str | None = None
    region_id: int | None = None
    bank_name: str | None = None
    bank_account: str | None = None
    driver_license: bool = False
    security_cert: bool = False
    face_photo_file_id: str | None = None
    contract_signed: bool = False
    created_at: datetime | str | None = None

    class Config:
        from_attributes = True


class WorkerListResponse(BaseModel):
    """근무자 목록 응답"""
    total: int
    workers: list[WorkerResponse]
