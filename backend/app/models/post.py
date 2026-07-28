from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import PostStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Post(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "posts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    media_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Instagram Reels options. Ignored by platforms that don't have the concept (e.g.
    # Facebook) -- kept on Post rather than per-platform since there's one video per post.
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    share_to_feed: Mapped[bool] = mapped_column(default=True, nullable=False)

    status: Mapped[PostStatus] = mapped_column(String(32), default=PostStatus.draft, nullable=False)
    publish_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="posts")
    platforms: Mapped[list["PostPlatform"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )
