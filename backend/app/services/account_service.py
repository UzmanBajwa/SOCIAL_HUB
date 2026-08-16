from __future__ import annotations

import logging
import secrets
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import AccountStatus, Platform
from app.models.social_account import SocialAccount
from app.services.base import PageCandidate
from app.services.encryption import get_encryptor
from app.services.registry import get_platform_service

logger = logging.getLogger("socialhub.accounts")

# How far ahead of expiry to proactively refresh a token. Instagram's long-lived tokens
# last ~60 days and are refreshable any time after the first 24h -- refreshing 10 days
# out gives ample retry room if a refresh attempt fails transiently.
TOKEN_REFRESH_WINDOW = timedelta(days=10)

# How close to expiry a token can be before a caller (publish/upload) refreshes it first.
# YouTube's Google tokens last ~1 hour, so this window is reached between hourly
# background-refresh runs -- the guarantee is "never attempt an API call with a token
# within 5 minutes of expiring."
PUBLISH_TOKEN_REFRESH_BUFFER = timedelta(minutes=5)

# In-memory OAuth state store (state -> (user_id, created_at)) to guard against CSRF on
# the OAuth callback, and in-memory pending page selections between "fetch candidate
# Pages" and "user picks one". Both are single-process, TTL'd, single-use stores -- a
# fine MVP tradeoff, but swap for Redis before running more than one backend worker,
# since neither store is shared across processes.
_STATE_TTL = timedelta(minutes=10)
_oauth_states: dict[str, tuple[uuid.UUID, datetime]] = {}

_SELECTION_TTL = timedelta(minutes=10)


@dataclass
class _PendingSelection:
    user_id: uuid.UUID
    platform: Platform
    candidates: list[PageCandidate]
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_pending_selections: dict[str, _PendingSelection] = {}


class AccountNotFoundError(Exception):
    pass


class PlatformNotSupportedError(Exception):
    pass


class InvalidSelectionError(Exception):
    pass


class AccountTokenError(Exception):
    """The account's token is missing/expired and could not be refreshed in time."""


async def ensure_valid_access_token(
    db: AsyncSession, account: SocialAccount, *, strict: bool = False
) -> str:
    """Return a plaintext access token for `account`, refreshing and persisting it first
    if it is expired or within PUBLISH_TOKEN_REFRESH_BUFFER of expiry. Refreshing uses
    the OAuth refresh_token for Google services (refresh_uses_refresh_token=True) and the
    access token for every other provider, mirroring refresh_expiring_tokens().

    strict=True (upload flow): a failed refresh raises AccountTokenError -- an upload
    must never start (or continue) on a credential that's about to die mid-transfer.
    strict=False (publish flow): a failed refresh is logged and the stored token is used
    anyway, matching the old best-effort behavior where the publish surfaces the provider
    error."""
    encryptor = get_encryptor()
    service = get_platform_service(account.platform)
    refresh_fn = getattr(service, "refresh_access_token", None)

    needs_refresh = (
        refresh_fn is not None
        and account.refresh_token is not None
        and account.expires_at is not None
        and account.expires_at <= datetime.now(timezone.utc) + PUBLISH_TOKEN_REFRESH_BUFFER
    )
    if needs_refresh:
        refresh_credential = (
            encryptor.decrypt(account.refresh_token)
            if getattr(service, "refresh_uses_refresh_token", False)
            else encryptor.decrypt(account.access_token)
        )
        try:
            new_token, new_expires_at = await refresh_fn(refresh_credential)
            account.access_token = encryptor.encrypt(new_token)
            account.expires_at = new_expires_at
            await db.commit()
            return new_token
        except Exception as exc:  # noqa: BLE001 - the provider call failed
            logger.exception(
                "Failed to refresh token for %s account %s", account.platform, account.id
            )
            if strict:
                raise AccountTokenError(
                    "Your connected account's token is expired and could not be refreshed. "
                    "Please reconnect the account and try again."
                ) from exc

    return encryptor.decrypt(account.access_token)


def _purge_expired(store: dict, ttl: timedelta, get_created_at) -> None:
    now = datetime.now(timezone.utc)
    expired = [key for key, value in store.items() if now - get_created_at(value) > ttl]
    for key in expired:
        store.pop(key, None)


def build_authorize_url(platform: Platform, user_id: uuid.UUID) -> tuple[str, str]:
    _purge_expired(_oauth_states, _STATE_TTL, lambda v: v[1])
    service = get_platform_service(platform)
    state = secrets.token_urlsafe(24)
    _oauth_states[state] = (user_id, datetime.now(timezone.utc))
    return service.get_authorize_url(state), state


def consume_oauth_state(state: str, user_id: uuid.UUID) -> bool:
    _purge_expired(_oauth_states, _STATE_TTL, lambda v: v[1])
    stored = _oauth_states.pop(state, None)
    return stored is not None and stored[0] == user_id


async def start_page_selection(
    platform: Platform, user_id: uuid.UUID, code: str
) -> tuple[str, list[dict]]:
    """Facebook/Instagram connect step 1: exchange the OAuth code for the list of Pages
    (or Pages' linked Instagram Business accounts) the user can choose to connect."""
    _purge_expired(_pending_selections, _SELECTION_TTL, lambda v: v.created_at)

    service = get_platform_service(platform)
    fetch_candidates = getattr(service, "fetch_page_candidates", None)
    if fetch_candidates is None:
        raise PlatformNotSupportedError(f"{platform} does not support page selection.")

    candidates = await fetch_candidates(code)
    selection_token = secrets.token_urlsafe(24)
    _pending_selections[selection_token] = _PendingSelection(
        user_id=user_id, platform=platform, candidates=candidates
    )
    return selection_token, [c.to_public_dict() for c in candidates]


async def finalize_page_selection(
    db: AsyncSession, user_id: uuid.UUID, selection_token: str, page_id: str
) -> SocialAccount:
    """Facebook/Instagram connect step 2: the user picked one Page/IG account from the
    list returned by start_page_selection; persist it as a SocialAccount."""
    _purge_expired(_pending_selections, _SELECTION_TTL, lambda v: v.created_at)

    pending = _pending_selections.get(selection_token)
    if pending is None or pending.user_id != user_id:
        raise InvalidSelectionError("This connection attempt has expired. Please try connecting again.")

    candidate = next((c for c in pending.candidates if c.id == page_id), None)
    if candidate is None:
        raise InvalidSelectionError("That page was not part of the original selection.")

    account = await _upsert_social_account(
        db,
        user_id=user_id,
        platform=pending.platform,
        platform_account_id=candidate.id,
        account_name=candidate.name,
        account_username=candidate.username,
        avatar_url=candidate.avatar_url,
        access_token_plain=candidate.access_token,
        refresh_token_plain=None,
        expires_at=candidate.expires_at,  # None for Facebook Pages; ~60 days for Instagram
        scopes=candidate.scopes,
        extra_data=candidate.extra_data,
    )

    _pending_selections.pop(selection_token, None)  # single-use
    return account


async def connect_account(
    db: AsyncSession, user_id: uuid.UUID, platform: Platform, code: str
) -> SocialAccount:
    """Legacy single-shot connect for platforms without a page-selection step (LinkedIn,
    YouTube). Facebook/Instagram use start_page_selection + finalize_page_selection instead."""
    service = get_platform_service(platform)
    token_set = await service.connect(code)

    return await _upsert_social_account(
        db,
        user_id=user_id,
        platform=platform,
        platform_account_id=token_set.account_id,
        account_name=token_set.account_name,
        account_username=token_set.account_username,
        avatar_url=token_set.avatar_url,
        access_token_plain=token_set.access_token,
        refresh_token_plain=token_set.refresh_token,
        expires_at=token_set.expires_at,
        scopes=token_set.scopes,
        extra_data=token_set.extra_data,
    )


async def _upsert_social_account(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    platform: Platform,
    platform_account_id: str,
    account_name: str,
    account_username: str | None,
    avatar_url: str | None,
    access_token_plain: str,
    refresh_token_plain: str | None,
    expires_at: datetime | None,
    scopes: list[str] | None,
    extra_data: dict | None,
) -> SocialAccount:
    encryptor = get_encryptor()

    existing = await db.execute(
        select(SocialAccount).where(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == platform,
            SocialAccount.platform_account_id == platform_account_id,
        )
    )
    account = existing.scalar_one_or_none()

    if account is None:
        account = SocialAccount(
            user_id=user_id,
            platform=platform,
            platform_account_id=platform_account_id,
        )
        db.add(account)

    account.account_name = account_name
    account.account_username = account_username
    account.avatar_url = avatar_url
    account.access_token = encryptor.encrypt(access_token_plain)
    account.refresh_token = encryptor.encrypt(refresh_token_plain) if refresh_token_plain else None
    account.expires_at = expires_at
    account.scopes = scopes or []
    account.extra_data = extra_data or {}
    account.status = AccountStatus.active

    await db.commit()
    await db.refresh(account)
    return account


async def list_accounts(db: AsyncSession, user_id: uuid.UUID) -> list[SocialAccount]:
    result = await db.execute(
        select(SocialAccount).where(SocialAccount.user_id == user_id).order_by(SocialAccount.created_at.desc())
    )
    return list(result.scalars().all())


async def disconnect_account(db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID) -> None:
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id, SocialAccount.user_id == user_id
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise AccountNotFoundError(f"Account {account_id} not found")

    encryptor = get_encryptor()
    service = get_platform_service(account.platform)
    try:
        await service.disconnect(encryptor.decrypt(account.access_token), account.platform_account_id)
    except Exception:  # noqa: BLE001 - disconnect is best-effort; always remove locally
        pass

    await db.delete(account)
    await db.commit()


async def validate_account_token(db: AsyncSession, account: SocialAccount) -> bool:
    encryptor = get_encryptor()
    service = get_platform_service(account.platform)
    is_valid = await service.validate_token(encryptor.decrypt(account.access_token))
    if not is_valid and account.status == AccountStatus.active:
        account.status = AccountStatus.expired
        await db.commit()
    return is_valid


async def refresh_expiring_tokens(db: AsyncSession) -> None:
    """Proactively refreshes tokens for accounts on platforms that support refresh
    (currently Instagram) before they expire. Facebook Page tokens have no expiry, and
    their service classes don't implement refresh_access_token, so they're skipped here
    automatically -- this loop is platform-agnostic by construction, not hardcoded to
    Instagram. Called by the scheduler (app/scheduler/jobs.py), not at publish time."""
    threshold = datetime.now(timezone.utc) + TOKEN_REFRESH_WINDOW
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.status == AccountStatus.active,
            SocialAccount.expires_at.is_not(None),
            SocialAccount.expires_at <= threshold,
        )
    )
    accounts = list(result.scalars().all())
    if not accounts:
        return

    encryptor = get_encryptor()
    for account in accounts:
        service = get_platform_service(account.platform)
        refresh_fn = getattr(service, "refresh_access_token", None)
        if refresh_fn is None:
            continue
        try:
            # Most providers refresh with the access token itself; Google/YouTube refresh
            # with the OAuth refresh_token (see PlatformService.refresh_uses_refresh_token).
            if getattr(service, "refresh_uses_refresh_token", False):
                if not account.refresh_token:
                    continue
                refresh_credential = encryptor.decrypt(account.refresh_token)
            else:
                refresh_credential = encryptor.decrypt(account.access_token)
            new_token, new_expires_at = await refresh_fn(refresh_credential)
            account.access_token = encryptor.encrypt(new_token)
            account.expires_at = new_expires_at
        except Exception:  # noqa: BLE001 - one account's refresh failure must not stop others
            logger.exception("Failed to refresh token for %s account %s", account.platform, account.id)
            account.status = AccountStatus.expired

    await db.commit()
