from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models.enums import YouTubeUploadStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class YouTubeUpload(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Tracks a single YouTube resumable upload session.

    Created when the user starts an upload in the YouTube Studio uploader, updated as
    bytes stream to Google's resumable session URI (session_uri), and finalized once the
    bytes are fully received (status -> "uploaded", video_id set). Later tasks turn a
    completed upload into a Post and watch YouTube's server-side processing.

    metadata_json holds the upload-time metadata bag: title/description/privacy_status
    (sent to Google when the resumable session is created) plus total_size (used for
    progress + client-side transfers when no Media record exists). media_id links to the
    Media-library video when the upload streams from a stored file; raw-body uploads leave
    it null.
    """

    __tablename__ = "youtube_uploads"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("social_accounts.id", ondelete="CASCADE"), nullable=False
    )
    post_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("posts.id", ondelete="CASCADE"), nullable=True
    )
    media_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("media.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[YouTubeUploadStatus] = mapped_column(
        String(32), default=YouTubeUploadStatus.initialized, nullable=False
    )
    progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    video_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    session_uri: Mapped[str | None] = mapped_column(Text, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship()
    account: Mapped["SocialAccount"] = relationship()
    post: Mapped["Post | None"] = relationship()
