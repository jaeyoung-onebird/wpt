"""Worker Schemas"""
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, field_serializer

# 한국 시간대 (UTC+9)
KST = timezone(timedelta(hours=9))


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

    @field_serializer('created_at')
    def serialize_created_at(self, dt: datetime | str | None) -> str | None:
        if dt is None:
            return None
        if isinstance(dt, str):
            return dt[:16]  # YYYY-MM-DD HH:MM 까지만
        # naive datetime이면 UTC로 간주
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        # KST로 변환하고 분까지만 표시
        kst_dt = dt.astimezone(KST)
        return kst_dt.strftime("%Y-%m-%d %H:%M")

    class Config:
        from_attributes = True


class WorkerListResponse(BaseModel):
    """근무자 목록 응답"""
    total: int
    workers: list[WorkerResponse]
