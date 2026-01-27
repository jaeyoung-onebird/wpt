import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, ForeignKey, Text, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AIRecommendation(Base):
    """AI job recommendation for workers"""
    __tablename__ = "ai_recommendations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workers_public.id"), nullable=False)
    event_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    position_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("event_positions.id"), nullable=False)
    score: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)  # 0.0000 ~ 1.0000
    reason: Mapped[str] = mapped_column(Text, nullable=False)  # JSON array of reason codes
    model_version: Mapped[str] = mapped_column(String(20), nullable=False)
    is_shown: Mapped[bool] = mapped_column(Boolean, default=False)
    shown_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_clicked: Mapped[bool] = mapped_column(Boolean, default=False)
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_applied: Mapped[bool] = mapped_column(Boolean, default=False)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Relationships
    worker = relationship("WorkerPublic")
    event = relationship("Event")
    position = relationship("EventPosition")

    def __repr__(self) -> str:
        return f"<AIRecommendation worker={self.worker_id} event={self.event_id} score={self.score}>"
