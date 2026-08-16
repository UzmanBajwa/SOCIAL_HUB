import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import YouTubeUploadStatus
from app.schemas.post import PostRead

PrivacyStatus = Literal["public", "private", "unlisted"]


class YouTubeUploadInitRequest(BaseModel):
    """Start a YouTube Studio upload. The video is identified one of two ways:
    - media_id: a video already stored in the media library (backend streams the file)
    - total_size: the raw byte count for a direct body stream to /data (no Media row)
    Exactly one must be provided."""

    account_id: uuid.UUID
    media_id: uuid.UUID | None = None
    total_size: int | None = Field(default=None, gt=0)
    title: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    privacy_status: PrivacyStatus = "public"
    tags: list[str] | None = Field(default=None, max_length=20)
    category: str | None = Field(default=None, max_length=3)
    made_for_kids: bool = False
    thumbnail_url: str | None = Field(default=None, max_length=2048)

    @field_validator("tags")
    @classmethod
    def _validate_tags(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return value
        cleaned = [tag.strip() for tag in value if tag and tag.strip()]
        if len(cleaned) > 20:
            raise ValueError("Provide at most 20 tags.")
        return cleaned

    @field_validator("privacy_status")
    @classmethod
    def _validate_privacy(cls, value: str) -> str:
        if value not in ("public", "private", "unlisted"):
            raise ValueError("privacy_status must be one of: public, private, unlisted")
        return value

    @model_validator(mode="after")
    def _check_source(self) -> "YouTubeUploadInitRequest":
        if (self.media_id is None) == (self.total_size is None):
            raise ValueError("Provide exactly one of media_id or total_size.")
        return self


class YouTubeThumbnailRequest(BaseModel):
    """Attach a thumbnail to an already-uploaded video. The image must already exist in
    the media library (uploaded via /media/upload); the backend streams those bytes to
    YouTube's thumbnails/set endpoint."""

    media_id: uuid.UUID


class YouTubePublishRequest(BaseModel):
    """Turn a finished YouTube upload (status=uploaded, video_id set) into a Post.

    - publish_date omitted  -> the post is created and published immediately.
    - publish_date provided -> the post is created as scheduled; the scheduler fires it
      at the given time. NOTE: YouTube has no arbitrary future-publish API, so the video
      bytes are already on YouTube (with the privacy chosen at upload time) -- SOCIAL_HUB
      controls when the post itself is recorded as published.

    playlist_ids is optional: after the video is live, the backend associates it with
    each listed playlist via playlistItems.insert (best-effort -- a playlist failure is
    reported in playlist_results and never fails the video publish).
    """

    publish_date: datetime | None = None
    timezone: str | None = Field(default=None, max_length=64)
    playlist_ids: list[str] | None = None


class YouTubeUploadInitResponse(BaseModel):
    """Returned to the frontend so it can start (or trigger) the byte transfer. Never
    includes tokens, the resumable session URI, or any credentials -- upload_id is the
    only handle the client needs for /data, /progress and /cancel."""

    upload_id: uuid.UUID
    status: YouTubeUploadStatus
    progress: int
    title: str
    total_size: int
    video_id: str | None = None
    error: str | None = None
    post_id: uuid.UUID | None = None


class YouTubeUploadInitResponse(BaseModel):
    """Returned to the frontend so it can start (or trigger) the byte transfer. Never
    includes tokens, the resumable session URI, or any credentials -- upload_id is the
    only handle the client needs for /data, /progress and /cancel."""

    upload_id: uuid.UUID
    status: YouTubeUploadStatus
    progress: int
    title: str
    total_size: int
    video_id: str | None = None
    error: str | None = None
    post_id: uuid.UUID | None = None


class YouTubeUploadProgressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    upload_id: uuid.UUID = Field(validation_alias="id")
    status: YouTubeUploadStatus
    progress: int
    video_id: str | None = None
    error: str | None = None
    post_id: uuid.UUID | None = None


class YouTubePlaylistRead(BaseModel):
    """A playlist on the connected channel. playlist_id is YouTube's playlist id -- the
    only handle playlistItems.insert needs."""

    playlist_id: str
    title: str
    description: str | None = None
    privacy_status: str | None = None
    item_count: int | None = 0
    thumbnail_url: str | None = None


class YouTubePlaylistCreate(BaseModel):
    account_id: uuid.UUID
    title: str = Field(min_length=1, max_length=150)
    description: str | None = Field(default=None, max_length=5000)
    privacy_status: PrivacyStatus = "public"


class YouTubePlaylistVideoRequest(BaseModel):
    """Attach an already-uploaded video to a playlist. video_id comes from a completed
    YouTube Studio upload; the bytes are never re-sent, only the playlist item is."""

    account_id: uuid.UUID
    video_id: str = Field(min_length=1, max_length=255)


class YouTubePlaylistItemResult(BaseModel):
    """Per-playlist outcome for publish-time playlist association. The publish flow
    returns one of these per selected playlist so the UI can show partial success."""

    playlist_id: str
    success: bool
    error: str | None = None


class YouTubePublishResponse(BaseModel):
    """POST /youtube/upload/{id}/publish. The post is the same shape as before; the added
    playlist_results make partial playlist failure visible without failing the publish."""

    post: PostRead
    playlist_results: list[YouTubePlaylistItemResult] = []
