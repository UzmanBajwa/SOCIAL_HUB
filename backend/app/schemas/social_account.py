import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import AccountStatus, Platform


class SocialAccountRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    platform: Platform
    account_name: str
    account_username: str | None = None
    avatar_url: str | None
    status: AccountStatus
    scopes: list[str] | None = None
    extra_data: dict[str, Any] | None = None
    expires_at: datetime | None
    created_at: datetime


class ConnectUrlResponse(BaseModel):
    authorize_url: str
    state: str


class ConnectCallbackRequest(BaseModel):
    platform: Platform
    code: str
    state: str | None = None


class PageCandidateRead(BaseModel):
    id: str
    name: str
    username: str | None = None
    avatar_url: str | None = None
    category: str | None = None


class PageSelectionResponse(BaseModel):
    platform: Platform
    pages: list[PageCandidateRead]


class SelectPageRequest(BaseModel):
    platform: Platform
    selection_token: str
    page_id: str


class ConnectResult(BaseModel):
    """POST /accounts/connect returns one of two shapes depending on the platform:
    Facebook/Instagram require a page-selection step, so `selection`/`selection_token`
    are populated and `account` is null; other platforms connect in one shot and
    `account` is populated instead."""

    requires_selection: bool
    selection: PageSelectionResponse | None = None
    selection_token: str | None = None
    account: SocialAccountRead | None = None
