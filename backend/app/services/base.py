from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class OAuthTokenSet:
    access_token: str
    refresh_token: str | None
    expires_at: datetime | None
    account_id: str
    account_name: str
    avatar_url: str | None = None
    account_username: str | None = None
    scopes: list[str] = field(default_factory=list)
    extra_data: dict = field(default_factory=dict)


@dataclass
class PageCandidate:
    """One connectable account presented to the user for selection before a
    SocialAccount is created: a Facebook Page, or (for direct Instagram Login) the
    single Instagram Business account itself. The access_token here is never sent to
    the frontend -- only `to_public_dict()` (id/name/avatar/category) leaves the server.

    expires_at matters here because it varies by platform: Facebook Page tokens derived
    from a long-lived user token effectively don't expire, but Instagram's direct-login
    tokens do (~60 days, refreshable) -- so each candidate carries its own expiry rather
    than account_service assuming one policy for both."""

    id: str
    name: str
    access_token: str
    avatar_url: str | None = None
    username: str | None = None
    category: str | None = None
    scopes: list[str] = field(default_factory=list)
    extra_data: dict = field(default_factory=dict)
    expires_at: datetime | None = None

    def to_public_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "avatar_url": self.avatar_url,
            "category": self.category,
        }

    def to_public_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "avatar_url": self.avatar_url,
            "category": self.category,
        }


@dataclass
class PublishContent:
    text: str
    media_url: str | None = None
    media_type: str | None = None  # "image" | "video"
    # Instagram Reels-only options; other platforms ignore these.
    thumbnail_url: str | None = None
    share_to_feed: bool = True
    # Ordered list of {"url", "type"} -- when len > 1, Facebook publishes a carousel.
    media_items: list[dict] = field(default_factory=list)
    # Facebook-only options; other platforms ignore these.
    is_pinned: bool = False
    publish_as_reel: bool = False
    mentions: list[dict] = field(default_factory=list)  # [{"id", "name"}]
    location: dict | None = None  # {"id", "name"}


@dataclass
class PublishResult:
    success: bool
    platform_post_id: str | None = None
    error_message: str | None = None
    raw_response: dict = field(default_factory=dict)


class PlatformService(ABC):
    """Common interface every social platform integration implements.

    Adding a new platform (TikTok, Pinterest, Threads, ...) means implementing this
    interface in one new file and registering it in `services/registry.py` -- no
    changes required to routes, the post service, or the scheduler.
    """

    platform_name: str

    # Most providers (Instagram, LinkedIn) refresh their OAuth access token by passing
    # the current access token back to the token endpoint. Google/YouTube instead require
    # the OAuth refresh_token. This flag lets the generic refresh helpers in
    # account_service / post_service pick the right credential without hardcoding
    # platform names. Defaults to False to preserve existing Instagram behavior.
    refresh_uses_refresh_token: bool = False

    @abstractmethod
    def get_authorize_url(self, state: str) -> str:
        """Return the provider's OAuth consent screen URL."""

    @abstractmethod
    async def connect(self, code: str) -> OAuthTokenSet:
        """Exchange an OAuth `code` for tokens + account identity."""

    @abstractmethod
    async def disconnect(self, access_token: str, account_id: str) -> None:
        """Revoke the token on the provider's side where supported."""

    @abstractmethod
    async def validate_token(self, access_token: str) -> bool:
        """Return True if the stored access token is still valid."""

    @abstractmethod
    async def upload_media(self, access_token: str, account_id: str, media_url: str, media_type: str) -> str:
        """Upload media to the provider and return a provider-side media handle/id."""

    @abstractmethod
    async def publish_post(
        self, access_token: str, account_id: str, content: PublishContent
    ) -> PublishResult:
        """Publish a post to the provider. Must never raise for expected API errors --
        return a PublishResult(success=False, error_message=...) instead so one
        platform's failure never interrupts the others."""
