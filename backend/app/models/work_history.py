import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class WorkHistory(Base):
    """Work history between organization and worker"""
    __tablename__ = "work_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    total_jobs: Mapped[int] = mapped_column(Integer, default=0)
    first_worked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_worked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    org_memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    worker = relationship("WorkerPublic")

    def __repr__(self) -> str:
        return f"<WorkHistory org={self.org_id} worker={self.worker_id} jobs={self.total_jobs}>"
