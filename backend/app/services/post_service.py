from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database.session import AsyncSessionLocal
from app.models.enums import Platform, PostPlatformStatus, PostStatus
from app.models.post import Post
from app.models.post_platform import PostPlatform
from app.models.social_account import SocialAccount
from app.schemas.post import MediaItem, PostCreate, PostUpdate
from app.services.account_service import ensure_valid_access_token
from app.services.base import PublishContent
from app.services.registry import get_platform_service
from app.utils.validators import (
    validate_future_publish_date,
    validate_platform_media_requirements,
    validate_post_has_content,
)


class PostNotFoundError(Exception):
    pass


class InvalidAccountSelectionError(Exception):
    pass


def _post_query():
    return select(Post).options(selectinload(Post.platforms))


async def get_post_or_raise(db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID) -> Post:
    result = await db.execute(
        _post_query().where(Post.id == post_id, Post.user_id == user_id)
    )
    post = result.scalar_one_or_none()
    if post is None:
        raise PostNotFoundError(f"Post {post_id} not found")
    return post


async def list_posts(db: AsyncSession, user_id: uuid.UUID) -> list[Post]:
    result = await db.execute(
        _post_query().where(Post.user_id == user_id).order_by(Post.created_at.desc())
    )
    return list(result.scalars().all())


async def _fetch_accounts(
    db: AsyncSession, user_id: uuid.UUID, account_ids: list[uuid.UUID]
) -> list[SocialAccount]:
    if not account_ids:
        return []
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id.in_(account_ids), SocialAccount.user_id == user_id
        )
    )
    accounts = list(result.scalars().all())
    if len(accounts) != len(set(account_ids)):
        raise InvalidAccountSelectionError("One or more selected accounts were not found.")
    return accounts


def _normalize_media(
    media_items: list[MediaItem] | None, media_url: str | None, media_type: str | None
) -> tuple[list[dict] | None, str | None, str | None]:
    """media_items (Facebook carousel) is the source of truth when present; media_url/
    media_type are then derived from its first entry for backward-compat with Instagram
    (single media only) and any code that only knows about the old single-media shape."""
    if media_items:
        items = [item.model_dump() for item in media_items]
        return items, media_url or items[0]["url"], media_type or items[0]["type"]
    return None, media_url, media_type


async def create_post(db: AsyncSession, user_id: uuid.UUID, payload: PostCreate) -> Post:
    accounts = await _fetch_accounts(db, user_id, payload.platform_account_ids)
    media_items, media_url, media_type = _normalize_media(
        payload.media_items, payload.media_url, payload.media_type
    )

    status = PostStatus.scheduled if payload.publish_date else PostStatus.draft
    if status == PostStatus.scheduled:
        validate_future_publish_date(payload.publish_date)
        validate_post_has_content(payload.content, media_url)
        validate_platform_media_requirements(
            [a.platform for a in accounts], media_url, len(media_items or [])
        )
    post = Post(
        user_id=user_id,
        content=payload.content,
        media_url=media_url,
        media_type=media_type,
        media_items=media_items,
        thumbnail_url=payload.thumbnail_url,
        share_to_feed=payload.share_to_feed,
        is_pinned=payload.is_pinned,
        publish_as_reel=payload.publish_as_reel,
        mentions=[m.model_dump() for m in payload.mentions] if payload.mentions else None,
        location=payload.location.model_dump() if payload.location else None,
        platform_options=payload.platform_options,
        timezone=payload.timezone,
        publish_date=payload.publish_date,
        status=status,
    )
    post.platforms = [
        PostPlatform(social_account_id=account.id, platform=account.platform)
        for account in accounts
    ]
    db.add(post)
    await db.commit()
    await db.refresh(post, attribute_names=["platforms"])
    return post


async def update_post(
    db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID, payload: PostUpdate
) -> Post:
    post = await get_post_or_raise(db, user_id, post_id)
    if post.status not in (PostStatus.draft, PostStatus.scheduled):
        raise ValueError("Only draft or scheduled posts can be edited.")

    # media_items needs to distinguish three states that Pydantic can't tell apart from
    # the field value alone, so we rely on model_fields_set (which records whether the
    # key was present in the request body):
    #   - omitted            -> leave media untouched
    #   - explicit null      -> clear the media items and the single-media pair
    #   - a list (incl. [])  -> replace media from the supplied list
    if payload.content is not None:
        post.content = payload.content
    if "media_items" in payload.model_fields_set:
        if payload.media_items is None:
            post.media_items = None
            post.media_url = None
            post.media_type = None
        else:
            media_items, media_url, media_type = _normalize_media(
                payload.media_items, payload.media_url, payload.media_type
            )
            post.media_items = media_items
            post.media_url = media_url
            post.media_type = media_type
    else:
        # Same omitted-vs-null distinction for the single-media fields. An explicit
        # null clears the field; an omitted field is left as-is.
        if "media_url" in payload.model_fields_set:
            post.media_url = payload.media_url
        if "media_type" in payload.model_fields_set:
            post.media_type = payload.media_type
    if payload.thumbnail_url is not None:
        post.thumbnail_url = payload.thumbnail_url
    if payload.share_to_feed is not None:
        post.share_to_feed = payload.share_to_feed
    if payload.is_pinned is not None:
        post.is_pinned = payload.is_pinned
    if payload.publish_as_reel is not None:
        post.publish_as_reel = payload.publish_as_reel
    if payload.mentions is not None:
        post.mentions = [m.model_dump() for m in payload.mentions]
    if payload.location is not None:
        post.location = payload.location.model_dump()
    if payload.platform_options is not None:
        post.platform_options = payload.platform_options
    if payload.timezone is not None:
        post.timezone = payload.timezone
    if "publish_date" in payload.model_fields_set and payload.publish_date is not None:
        validate_future_publish_date(payload.publish_date)
        post.publish_date = payload.publish_date
        post.status = PostStatus.scheduled

    if payload.platform_account_ids is not None:
        accounts = await _fetch_accounts(db, user_id, payload.platform_account_ids)
        post.platforms = [
            PostPlatform(social_account_id=account.id, platform=account.platform)
            for account in accounts
        ]

    # A scheduled post must never become invalid through an update -- re-run the same
    # content/media rules that create/schedule/publish enforce. Drafts stay exempt so
    # work-in-progress content can be saved without media.
    if post.status == PostStatus.scheduled:
        validate_post_has_content(post.content, post.media_url)
        validate_platform_media_requirements(
            [pp.platform for pp in post.platforms], post.media_url, len(post.media_items or [])
        )

    await db.commit()
    await db.refresh(post, attribute_names=["platforms"])
    return post


async def delete_post(db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID) -> None:
    post = await get_post_or_raise(db, user_id, post_id)
    await db.delete(post)
    await db.commit()


async def schedule_post(
    db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID, publish_date: datetime
) -> Post:
    post = await get_post_or_raise(db, user_id, post_id)
    if not post.platforms:
        raise InvalidAccountSelectionError("Select at least one platform before scheduling.")
    validate_post_has_content(post.content, post.media_url)
    validate_platform_media_requirements(
        [pp.platform for pp in post.platforms], post.media_url, len(post.media_items or [])
    )
    validate_future_publish_date(publish_date)
    post.publish_date = publish_date
    post.status = PostStatus.scheduled
    await db.commit()
    await db.refresh(post, attribute_names=["platforms"])
    return post


async def _publish_single_platform(post_platform_id: uuid.UUID, content: PublishContent) -> None:
    """Publishes to exactly one platform using its own DB session. Never raises -- all
    failures are captured on the PostPlatform row so one platform's failure, including a
    session-level error, cannot affect the others running concurrently."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(PostPlatform).where(PostPlatform.id == post_platform_id)
        )
        post_platform = result.scalar_one_or_none()
        if post_platform is None:
            return

        post_platform.status = PostPlatformStatus.publishing
        await session.commit()

        try:
            account_result = await session.execute(
                select(SocialAccount).where(SocialAccount.id == post_platform.social_account_id)
            )
            account = account_result.scalar_one_or_none()
            if account is None:
                post_platform.status = PostPlatformStatus.failed
                post_platform.error_message = "Connected account no longer exists."
                await session.commit()
                return

            # YouTube Studio uploads: the video is already on YouTube (uploaded through
            # the resumable uploader and recorded in PostPlatform.meta.video_id), so the
            # scheduler only needs to mark the post published -- never re-upload the file.
            if post_platform.platform == Platform.youtube and (
                post_platform.meta or {}
            ).get("video_id"):
                post_platform.status = PostPlatformStatus.published
                post_platform.platform_post_id = post_platform.meta["video_id"]
                post_platform.published_at = datetime.now(timezone.utc)
                post_platform.error_message = None
                await session.commit()
                return

            service = get_platform_service(post_platform.platform)

            # Tokens expire between the hourly background refresh job's runs (YouTube's
            # Google tokens last ~1 hour). ensure_valid_access_token refreshes + persists
            # any token expired or within PUBLISH_TOKEN_REFRESH_BUFFER of expiry before
            # we use it. Best-effort (strict=False): a refresh failure falls through to
            # the stored token and the publish surfaces the provider error.
            access_token = await ensure_valid_access_token(session, account)

            publish_result = await service.publish_post(
                access_token, account.platform_account_id, content
            )

            if publish_result.success:
                post_platform.status = PostPlatformStatus.published
                post_platform.platform_post_id = publish_result.platform_post_id
                post_platform.published_at = datetime.now(timezone.utc)
                post_platform.error_message = None
            else:
                post_platform.status = PostPlatformStatus.failed
                post_platform.error_message = publish_result.error_message or "Unknown error"
                post_platform.retry_count += 1
        except Exception as exc:  # noqa: BLE001 - platform failures must never propagate
            post_platform.status = PostPlatformStatus.failed
            post_platform.error_message = str(exc)
            post_platform.retry_count += 1

        await session.commit()


async def publish_post_now(db: AsyncSession, user_id: uuid.UUID, post_id: uuid.UUID) -> Post:
    post = await get_post_or_raise(db, user_id, post_id)
    if not post.platforms:
        raise InvalidAccountSelectionError("Select at least one platform before publishing.")
    validate_post_has_content(post.content, post.media_url)
    validate_platform_media_requirements(
        [pp.platform for pp in post.platforms], post.media_url, len(post.media_items or [])
    )

    post.status = PostStatus.publishing
    await db.commit()

    await publish_post_platforms(post.id)

    # The fan-out above updated the post/platform rows through separate sessions, so this
    # session's identity map is now stale (expire_on_commit=False keeps old attribute
    # values in memory). Force a fresh load instead of returning cached state.
    db.expire_all()
    return await get_post_or_raise(db, user_id, post_id)


async def publish_post_platforms(post_id: uuid.UUID) -> None:
    """Fans out publishing to every selected platform independently and in parallel, each
    on its own DB session. Called both by the `/publish` route and the scheduler job."""
    async with AsyncSessionLocal() as session:
        post = (
            await session.execute(_post_query().where(Post.id == post_id))
        ).scalar_one()
        content = PublishContent(
            text=post.content,
            media_url=post.media_url,
            media_type=post.media_type,
            thumbnail_url=post.thumbnail_url,
            share_to_feed=post.share_to_feed,
            media_items=post.media_items or [],
            is_pinned=post.is_pinned,
            publish_as_reel=post.publish_as_reel,
            mentions=post.mentions or [],
            location=post.location,
        )
        platform_ids = [pp.id for pp in post.platforms]

    await asyncio.gather(*(_publish_single_platform(pid, content) for pid in platform_ids))

    async with AsyncSessionLocal() as session:
        post = (
            await session.execute(_post_query().where(Post.id == post_id))
        ).scalar_one()
        statuses = {pp.status for pp in post.platforms}
        if statuses == {PostPlatformStatus.published}:
            post.status = PostStatus.published
        elif PostPlatformStatus.published in statuses:
            post.status = PostStatus.partially_published
        else:
            post.status = PostStatus.failed
        await session.commit()


async def get_due_scheduled_posts(db: AsyncSession) -> list[Post]:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        _post_query().where(Post.status == PostStatus.scheduled, Post.publish_date <= now)
    )
    return list(result.scalars().all())
