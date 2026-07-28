import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import Platform, PostPlatformStatus, PostStatus


class PostPlatformRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    platform: Platform
    social_account_id: uuid.UUID
    status: PostPlatformStatus
    platform_post_id: str | None
    published_at: datetime | None
    error_message: str | None
    retry_count: int


class PostCreate(BaseModel):
    content: str = Field(default="", max_length=10000)
    media_url: str | None = None
    media_type: str | None = None
    # Instagram Reels options; ignored for platforms without the concept (e.g. Facebook).
    thumbnail_url: str | None = None
    share_to_feed: bool = True
    platform_account_ids: list[uuid.UUID] = Field(default_factory=list)
    publish_date: datetime | None = None

    @field_validator("platform_account_ids")
    @classmethod
    def dedupe(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        return list(dict.fromkeys(value))


class PostUpdate(BaseModel):
    content: str | None = Field(default=None, max_length=10000)
    media_url: str | None = None
    media_type: str | None = None
    thumbnail_url: str | None = None
    share_to_feed: bool | None = None
    platform_account_ids: list[uuid.UUID] | None = None
    publish_date: datetime | None = None


class PostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    content: str
    media_url: str | None
    media_type: str | None
    thumbnail_url: str | None
    share_to_feed: bool
    status: PostStatus
    publish_date: datetime | None
    created_at: datetime
    platforms: list[PostPlatformRead] = Field(default_factory=list)


class ScheduleRequest(BaseModel):
    publish_date: datetime
