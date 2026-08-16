from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.enums import AccountStatus, Platform
from app.models.social_account import SocialAccount
from app.schemas.youtube import (
    YouTubePlaylistItemResult,
    YouTubePlaylistRead,
)
from app.services.account_service import AccountTokenError, ensure_valid_access_token
from app.services.registry import get_platform_service
from app.services.youtube_service import YouTubeUploadError


class InvalidYouTubeAccountError(Exception):
    pass


class AccountInactiveError(Exception):
    pass


class MissingPlaylistScopeError(Exception):
    """The connected account predates the playlist scope (youtube.force-ssl) and must be
    reconnected before playlists can be managed or videos added to them."""

    RECONNECT_MESSAGE = (
        "Reconnect your YouTube account to enable playlist support: managing playlists "
        "requires the youtube.force-ssl permission, which was added after your account "
        "was connected."
    )


YOUTUBE_PLAYLIST_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl"


def _missing_playlist_scope(account: SocialAccount) -> bool:
    """True when the account's stored scopes do not include the playlist write scope.
    Empty scope lists mean the account predates scope recording -- and therefore the
    playlist scope -- so they're treated as missing too. This check is only applied to
    WRITE operations; listing playlists just needs youtube.readonly, which legacy
    accounts already have."""
    scopes = account.scopes or []
    return YOUTUBE_PLAYLIST_SCOPE not in scopes


def _assert_playlist_scope(account: SocialAccount) -> None:
    if _missing_playlist_scope(account):
        raise MissingPlaylistScopeError(MissingPlaylistScopeError.RECONNECT_MESSAGE)


async def _load_owned_account(
    db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID
) -> SocialAccount:
    """Load a YouTube account that is verified to belong to `user_id`. Any account that
    isn't found, isn't a YouTube account, or belongs to someone else is reported the same
    way (404) so a caller can't learn about other users' accounts via the account id."""
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id,
            SocialAccount.user_id == user_id,
            SocialAccount.platform == Platform.youtube,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise InvalidYouTubeAccountError("YouTube account not found.")
    if account.status != AccountStatus.active:
        raise AccountInactiveError("This YouTube account isn't active. Please reconnect it.")
    return account


async def list_playlists(
    db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID
) -> list[YouTubePlaylistRead]:
    """Return the connected channel's own playlists. Ownership is enforced first; the
    Google call only happens for the owning user's active account."""
    account = await _load_owned_account(db, user_id, account_id)

    if get_settings().platform_sandbox_mode:
        # Sandbox has no real channel, so there are no playlists to list -- mirroring the
        # live API, just without the network call.
        return []

    access_token = await ensure_valid_access_token(db, account, strict=True)
    service = get_platform_service(Platform.youtube)
    playlists = await service.list_playlists(access_token)
    return [YouTubePlaylistRead(**item) for item in playlists]


async def create_playlist(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    title: str,
    description: str | None,
    privacy_status: str,
) -> YouTubePlaylistRead:
    """Create a playlist on the connected channel. Returns the created playlist (with the
    new YouTube playlist id) so the frontend can select it without reloading."""
    account = await _load_owned_account(db, user_id, account_id)
    _assert_playlist_scope(account)

    if get_settings().platform_sandbox_mode:
        return YouTubePlaylistRead(
            playlist_id=f"sandbox_playlist_{uuid.uuid4().hex[:8]}",
            title=title,
            description=description or "",
            privacy_status=privacy_status,
            item_count=0,
        )

    access_token = await ensure_valid_access_token(db, account, strict=True)
    service = get_platform_service(Platform.youtube)
    created = await service.create_playlist(access_token, title, description, privacy_status)
    return YouTubePlaylistRead(**created)


async def add_video_to_playlists(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    playlist_ids: list[str],
    video_id: str,
) -> list[YouTubePlaylistItemResult]:
    """Associate an uploaded video with one or more playlists via playlistItems.insert.

    Best-effort by design: a failure on one playlist (quota, scope, deleted playlist, ...)
    must never abort the others or fail the video publish. Each playlist gets its own
    result entry; the caller decides how to present partial success."""
    results: list[YouTubePlaylistItemResult] = []
    if not playlist_ids:
        return results

    account = await _load_owned_account(db, user_id, account_id)

    if _missing_playlist_scope(account):
        return [
            YouTubePlaylistItemResult(
                playlist_id=playlist_id,
                success=False,
                error=MissingPlaylistScopeError.RECONNECT_MESSAGE,
            )
            for playlist_id in playlist_ids
        ]

    try:
        access_token = await ensure_valid_access_token(db, account, strict=True)
    except AccountTokenError as exc:
        return [
            YouTubePlaylistItemResult(playlist_id=playlist_id, success=False, error=str(exc))
            for playlist_id in playlist_ids
        ]

    service = get_platform_service(Platform.youtube)
    sandbox = get_settings().platform_sandbox_mode

    for playlist_id in playlist_ids:
        try:
            if sandbox:
                results.append(
                    YouTubePlaylistItemResult(playlist_id=playlist_id, success=True)
                )
            else:
                await service.add_video_to_playlist(access_token, playlist_id, video_id)
                results.append(
                    YouTubePlaylistItemResult(playlist_id=playlist_id, success=True)
                )
        except YouTubeUploadError as exc:
            results.append(
                YouTubePlaylistItemResult(
                    playlist_id=playlist_id, success=False, error=str(exc)
                )
            )
        except Exception as exc:  # noqa: BLE001 - per-playlist isolation
            results.append(
                YouTubePlaylistItemResult(
                    playlist_id=playlist_id, success=False, error=str(exc) or "Unexpected error."
                )
            )
    return results


async def add_video_to_playlist(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    playlist_id: str,
    video_id: str,
) -> YouTubePlaylistItemResult:
    """Single-playlist variant used by the standalone API endpoint. Raises on failure so
    the API layer can map it to an HTTP error (the publish flow uses add_video_to_playlists
    instead, which swallows per-playlist errors into results)."""
    results = await add_video_to_playlists(
        db, user_id=user_id, account_id=account_id, playlist_ids=[playlist_id], video_id=video_id
    )
    result = results[0] if results else YouTubePlaylistItemResult(
        playlist_id=playlist_id, success=False, error="No playlist specified."
    )
    if not result.success:
        raise YouTubeUploadError(result.error or "Could not add the video to the playlist.")
    return result
