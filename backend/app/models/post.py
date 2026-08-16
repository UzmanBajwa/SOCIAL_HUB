from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
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

    # Single-media convenience fields, kept for backward compatibility with Instagram
    # (which only ever publishes one image/video). For Facebook carousels, media_items
    # is the source of truth and media_url/media_type mirror its first entry.
    media_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    media_type: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Ordered list of {"url": str, "type": "image"|"video"} -- powers Facebook multi-photo
    # carousel posts. A single-item list is equivalent to the media_url/media_type pair.
    media_items: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)

    # Instagram Reels options (also reused for Facebook Reels' cover image).
    thumbnail_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    share_to_feed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Facebook-specific options -- see docs/meta-oauth-setup.md for which are real API
    # capabilities vs. deliberately not built (Enable Comments, Share to Story).
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    publish_as_reel: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Tagged Pages: list of {"id": str, "name": str}
    mentions: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    # Attached place: {"id": str, "name": str}
    location: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Platform-specific options keyed by feature, e.g. for YouTube:
    #   {"privacy": "public"|"private"|"unlisted", "tags": [...], "category": "...", "made_for_kids": bool}
    # Kept as a JSON bag so new platforms/options don't need a migration. Only options that
    # have no dedicated column live here (never duplicates content/media/publish_date).
    platform_options: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # IANA zone name the user picked in the scheduler UI (e.g. "Asia/Karachi"). publish_date
    # itself is always stored/queried in UTC; this is purely for redisplaying the original
    # selection when editing a scheduled post.
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)

    status: Mapped[PostStatus] = mapped_column(String(32), default=PostStatus.draft, nullable=False)
    publish_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="posts")
    platforms: Mapped[list["PostPlatform"]] = relationship(
        back_populates="post", cascade="all, delete-orphan"
    )
