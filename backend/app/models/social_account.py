from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import AccountStatus, Platform
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class SocialAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "social_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    platform: Mapped[Platform] = mapped_column(String(32), nullable=False)

    # Display name (Facebook Page name, Instagram business name) and handle (e.g. the
    # Instagram @username) are tracked separately since not every platform has both.
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    account_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    platform_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    # Encrypted at rest (see app.services.encryption) -- never returned by any API response.
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # OAuth scopes actually granted, and any platform-specific extras (e.g. Facebook Page
    # category, the linked Page id behind an Instagram Business account). Kept as a JSON
    # bag rather than dedicated columns so new platforms/fields don't need a migration.
    scopes: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    extra_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[AccountStatus] = mapped_column(
        String(32), default=AccountStatus.active, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="social_accounts")

    @property
    def connected_at(self) -> datetime:
        return self.created_at
