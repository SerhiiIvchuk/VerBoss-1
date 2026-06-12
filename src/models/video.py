from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Text, Numeric, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from database.database import Base

class VideoClip(Base):
    __tablename__ = "video_clips"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    video_id: Mapped[str] = mapped_column(String(20))
    video_url: Mapped[str | None] = mapped_column(Text)
    title: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    end_time: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())