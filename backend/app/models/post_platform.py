from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import Platform, PostPlatformStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class PostPlatform(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "post_platforms"

    post_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    social_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False
    )
    platform: Mapped[Platform] = mapped_column(String(32), nullable=False)
    status: Mapped[PostPlatformStatus] = mapped_column(
        String(32), default=PostPlatformStatus.pending, nullable=False
    )
    platform_post_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Platform-specific metadata, e.g. for YouTube: {"video_id": "...", "upload_status": "processed"}.
    # Kept as a JSON bag so new platforms/fields don't need a migration.
    meta: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    post: Mapped["Post"] = relationship(back_populates="platforms")
    social_account: Mapped["SocialAccount"] = relationship()
