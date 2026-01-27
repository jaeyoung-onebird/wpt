import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class OrgWorkerFollow(Base):
    """Organization follows Worker"""
    __tablename__ = "org_worker_follows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="following_workers")
    worker = relationship("WorkerPublic")

    def __repr__(self) -> str:
        return f"<OrgWorkerFollow org={self.org_id} -> worker={self.worker_id}>"


class WorkerOrgFollow(Base):
    """Worker follows Organization"""
    __tablename__ = "worker_org_follows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    worker = relationship("WorkerPublic", back_populates="following_orgs")
    organization = relationship("Organization")

    def __repr__(self) -> str:
        return f"<WorkerOrgFollow worker={self.worker_id} -> org={self.org_id}>"


class OrgWorkerBlock(Base):
    """Organization blocks Worker"""
    __tablename__ = "org_worker_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="blocked_workers")
    worker = relationship("WorkerPublic")

    def __repr__(self) -> str:
        return f"<OrgWorkerBlock org={self.org_id} blocks worker={self.worker_id}>"


class WorkerOrgBlock(Base):
    """Worker blocks Organization"""
    __tablename__ = "worker_org_blocks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    worker = relationship("WorkerPublic", back_populates="blocked_orgs")
    organization = relationship("Organization")

    def __repr__(self) -> str:
        return f"<WorkerOrgBlock worker={self.worker_id} blocks org={self.org_id}>"
