from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.enums import (
    AccountStatus,
    MediaType,
    Platform,
    PostPlatformStatus,
    PostStatus,
    YouTubeUploadStatus,
)
from app.models.media import Media
from app.models.post import Post
from app.models.post_platform import PostPlatform
from app.models.social_account import SocialAccount
from app.models.youtube_upload import YouTubeUpload
from app.schemas.youtube import YouTubePlaylistItemResult
from app.services.account_service import AccountTokenError, ensure_valid_access_token
from app.services.registry import get_platform_service
from app.services.storage import get_storage
from app.services.youtube_playlist_service import add_video_to_playlists
from app.services.youtube_service import YouTubeUploadError
from app.utils.validators import validate_future_publish_date


class YouTubeDisabledError(Exception):
    pass


class InvalidYouTubeAccountError(Exception):
    pass


class AccountInactiveError(Exception):
    pass


class MediaNotFoundError(Exception):
    pass


class InvalidMediaError(Exception):
    pass


class MediaUnreadableError(Exception):
    pass


class FileTooLargeError(Exception):
    pass


class UploadNotFoundError(Exception):
    pass


class InvalidUploadStateError(Exception):
    pass


# Pure validators (unit-tested without a DB) -----------------------------------------


def _assert_account_owned(account: SocialAccount, user_id: uuid.UUID) -> None:
    if account.user_id != user_id:
        raise InvalidYouTubeAccountError("YouTube account not found.")


def _require_video_media(media: Media) -> None:
    if media.type != MediaType.video:
        raise InvalidMediaError("Only video files can be uploaded to YouTube.")


def _require_image_media(media: Media) -> None:
    if media.type != MediaType.image:
        raise InvalidMediaError("Thumbnails must be image files.")


def _assert_size_within_limit(size: int, max_bytes: int) -> None:
    if size > max_bytes:
        raise FileTooLargeError(
            f"Video exceeds the maximum size of {max_bytes // (1024 * 1024)}MB."
        )


def _require_uploaded(upload: YouTubeUpload) -> None:
    if upload.status != YouTubeUploadStatus.uploaded or not upload.video_id:
        raise InvalidUploadStateError(
            "The video must be fully uploaded before it can be published."
        )


def _build_youtube_metadata(
    *,
    title: str,
    description: str | None,
    privacy_status: str,
    tags: list[str] | None,
    category: str | None,
    made_for_kids: bool,
) -> dict:
    """Build the snippet/status payload sent to Google when the resumable session is
    created. Pure so it can be unit-tested without a DB or network."""
    snippet = {"title": title, "description": description or ""}
    if tags:
        snippet["tags"] = tags
    if category:
        snippet["categoryId"] = category
    status_payload = {
        "privacyStatus": privacy_status,
        "selfDeclaredMadeForKids": made_for_kids,
    }
    return {"snippet": snippet, "status": status_payload}


def _thumbnail_content_type(media: Media) -> str:
    name = (media.file_name or "").lower()
    if name.endswith(".png"):
        return "image/png"
    if name.endswith(".webp"):
        return "image/webp"
    return "image/jpeg"


def _validate_cancel(upload: YouTubeUpload) -> None:
    if upload.status in (
        YouTubeUploadStatus.uploaded,
        YouTubeUploadStatus.processing,
        YouTubeUploadStatus.completed,
    ):
        raise InvalidUploadStateError("This upload has already finished.")


def _do_cancel(upload: YouTubeUpload) -> None:
    # Google has no supported server-side cancel for resumable sessions -- abandoning the
    # session URI (and dropping our reference to it) is the documented approach.
    upload.status = YouTubeUploadStatus.cancelled
    upload.session_uri = None


def _complete(upload: YouTubeUpload, video_id: str | None) -> None:
    upload.status = YouTubeUploadStatus.uploaded
    upload.video_id = video_id or upload.video_id
    upload.progress = 100
    upload.error = None


# DB-facing helpers ------------------------------------------------------------------


async def get_upload_for_user(
    db: AsyncSession, user_id: uuid.UUID, upload_id: uuid.UUID
) -> YouTubeUpload:
    result = await db.execute(
        select(YouTubeUpload).where(
            YouTubeUpload.id == upload_id, YouTubeUpload.user_id == user_id
        )
    )
    upload = result.scalar_one_or_none()
    if upload is None:
        raise UploadNotFoundError("YouTube upload not found.")
    return upload


async def _load_account(db: AsyncSession, account_id: uuid.UUID) -> SocialAccount:
    result = await db.execute(select(SocialAccount).where(SocialAccount.id == account_id))
    account = result.scalar_one_or_none()
    if account is None:
        raise InvalidYouTubeAccountError("Connected YouTube account no longer exists.")
    return account


async def _update_progress(
    db: AsyncSession, upload: YouTubeUpload, sent: int, total_size: int
) -> None:
    """Persist progress (0-100) whenever it moves. Commits at most ~100 times per
    upload -- granularity is a percent, so a 4GB video updates every ~40MB."""
    if total_size <= 0:
        return
    pct = int(sent * 100 // total_size)
    if pct != upload.progress:
        upload.progress = pct
        await db.commit()


# Upload lifecycle --------------------------------------------------------------------


async def init_upload(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    media_id: uuid.UUID | None,
    total_size: int | None,
    title: str,
    description: str | None,
    privacy_status: str,
    tags: list[str] | None = None,
    category: str | None = None,
    made_for_kids: bool = False,
    thumbnail_url: str | None = None,
) -> YouTubeUpload:
    settings = get_settings()
    if not settings.is_platform_enabled("youtube"):
        raise YouTubeDisabledError("YouTube isn't supported in this deployment yet.")

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
    _assert_account_owned(account, user_id)
    if account.status != AccountStatus.active:
        raise AccountInactiveError("This YouTube account isn't active. Please reconnect it.")

    max_bytes = settings.youtube_max_video_mb * 1024 * 1024

    media: Media | None = None
    if media_id is not None:
        media_result = await db.execute(
            select(Media).where(Media.id == media_id, Media.user_id == user_id)
        )
        media = media_result.scalar_one_or_none()
        if media is None:
            raise MediaNotFoundError("Media item not found.")
        _require_video_media(media)
        _assert_size_within_limit(media.size or 0, max_bytes)
        try:
            stored_size = await get_storage().get_size(media.file_url)
        except FileNotFoundError:
            raise MediaUnreadableError(
                "The video file is missing from storage. Please re-upload it."
            )
        except Exception:  # noqa: BLE001 - unreadable storage backend
            raise MediaUnreadableError("Could not read the video file from storage.")
        total_size = stored_size
        _assert_size_within_limit(total_size, max_bytes)
    else:
        _assert_size_within_limit(total_size or 0, max_bytes)

    # strict=True: an upload must never start on a token that's expired or unrefreshable.
    access_token = await ensure_valid_access_token(db, account, strict=True)

    service = get_platform_service(Platform.youtube)
    metadata = _build_youtube_metadata(
        title=title,
        description=description,
        privacy_status=privacy_status,
        tags=tags,
        category=category,
        made_for_kids=made_for_kids,
    )
    if settings.platform_sandbox_mode:
        session_uri = f"sandbox://resumable/{uuid.uuid4().hex}"
    else:
        session_uri = await service.create_resumable_session(access_token, metadata, total_size)

    upload = YouTubeUpload(
        user_id=user_id,
        account_id=account.id,
        media_id=media.id if media else None,
        status=YouTubeUploadStatus.initialized,
        progress=0,
        session_uri=session_uri,
        metadata_json={
            "title": title,
            "description": description or "",
            "privacy_status": privacy_status,
            "tags": tags or [],
            "category": category,
            "made_for_kids": made_for_kids,
            "thumbnail_url": thumbnail_url,
            "total_size": total_size,
        },
    )
    db.add(upload)
    await db.commit()
    await db.refresh(upload)
    return upload


async def stream_media_file(db: AsyncSession, upload: YouTubeUpload) -> YouTubeUpload:
    """Stream a media-library video to YouTube's resumable session in chunks. Supports
    resuming an interrupted upload by querying Google for the received byte offset first."""
    if upload.media_id is None:
        raise InvalidUploadStateError("This upload has no stored media file to stream.")

    media_result = await db.execute(select(Media).where(Media.id == upload.media_id))
    media = media_result.scalar_one_or_none()
    if media is None:
        raise InvalidUploadStateError("The upload's media file no longer exists.")
    _require_video_media(media)

    try:
        total_size = await get_storage().get_size(media.file_url)
    except FileNotFoundError:
        raise MediaUnreadableError(
            "The video file is missing from storage. Please re-upload it."
        )
    except Exception:  # noqa: BLE001
        raise MediaUnreadableError("Could not read the video file from storage.")

    stored_metadata = upload.metadata_json or {}
    if stored_metadata.get("total_size") != total_size:
        upload.metadata_json = {**stored_metadata, "total_size": total_size}
        await db.commit()

    account = await _load_account(db, upload.account_id)

    start = 0
    if not get_settings().platform_sandbox_mode:
        service = get_platform_service(Platform.youtube)
        start, existing_video_id = await service.query_upload_status(
            upload.session_uri, total_size
        )
        if existing_video_id:
            _complete(upload, existing_video_id)
            await db.commit()
            return upload
        if start >= total_size:
            start = 0

    source = get_storage().open(media.file_url, start=start)
    return await _stream_to_youtube(db, upload, account, source, total_size, start=start)


async def stream_raw_body(
    db: AsyncSession, upload: YouTubeUpload, request: Request
) -> YouTubeUpload:
    """Stream the raw HTTP request body to YouTube's resumable session, chunk by chunk,
    without ever buffering the whole body (Starlette's request.stream())."""
    metadata = upload.metadata_json or {}
    total_size = metadata.get("total_size")
    if not total_size or total_size <= 0:
        raise InvalidUploadStateError(
            "Upload has no recorded video size; re-initialize with total_size."
        )
    account = await _load_account(db, upload.account_id)

    async def _source() -> AsyncIterator[bytes]:
        async for chunk in request.stream():
            if chunk:
                yield chunk

    return await _stream_to_youtube(db, upload, account, _source(), total_size, start=0)


async def _stream_to_youtube(
    db: AsyncSession,
    upload: YouTubeUpload,
    account: SocialAccount,
    source: AsyncIterator[bytes],
    total_size: int,
    *,
    start: int,
) -> YouTubeUpload:
    settings = get_settings()
    service = get_platform_service(Platform.youtube)

    try:
        access_token = await ensure_valid_access_token(db, account, strict=True)
    except AccountTokenError:
        upload.status = YouTubeUploadStatus.failed
        upload.error = (
            "Your YouTube account's access token is expired and could not be refreshed. "
            "Please reconnect the account."
        )
        await db.commit()
        raise

    upload.status = YouTubeUploadStatus.uploading
    upload.error = None
    if start:
        upload.progress = int(start * 100 // total_size) if total_size else 0
    await db.commit()

    sandbox = settings.platform_sandbox_mode or (upload.session_uri or "").startswith("sandbox://")
    chunk_size = settings.youtube_upload_chunk_size
    sent = start

    try:
        buffer = bytearray()
        async for part in source:
            if sent >= total_size:
                break
            buffer.extend(part)
            while len(buffer) >= chunk_size:
                chunk = bytes(buffer[:chunk_size])
                del buffer[:chunk_size]
                sent = await _send_chunk(db, upload, service, sandbox, chunk, sent, total_size)
                if upload.status == YouTubeUploadStatus.uploaded:
                    return upload

        if buffer and sent < total_size:
            chunk = bytes(buffer[: total_size - sent])
            sent = await _send_chunk(db, upload, service, sandbox, chunk, sent, total_size)
            if upload.status == YouTubeUploadStatus.uploaded:
                return upload

        if sent < total_size:
            raise YouTubeUploadError(
                f"Upload stream ended early ({sent}/{total_size} bytes sent)."
            )

        # All bytes sent but no completion response yet (Google may accept the final
        # chunk with a 308). Confirm via a status query; in sandbox just finalize locally.
        if sandbox:
            video_id = f"sandbox_video_{uuid.uuid4().hex}"
        else:
            _, video_id = await service.query_upload_status(upload.session_uri, total_size)
        _complete(upload, video_id)
        await db.commit()
        return upload

    except YouTubeUploadError as exc:
        upload.status = YouTubeUploadStatus.failed
        upload.error = str(exc)
        await db.commit()
        raise
    except Exception as exc:  # noqa: BLE001 - transport errors etc. -> failed upload
        # A client that aborts mid-upload usually follows up with POST /cancel from a
        # separate session, so re-read the row: don't clobber a cancelled state that was
        # recorded while this streaming session was unwinding.
        fresh = (
            await db.execute(select(YouTubeUpload).where(YouTubeUpload.id == upload.id))
        ).scalar_one_or_none()
        if fresh is not None and fresh.status == YouTubeUploadStatus.cancelled:
            return fresh
        upload.status = YouTubeUploadStatus.failed
        upload.error = str(exc) or "Unexpected upload error."
        await db.commit()
        raise


async def _send_chunk(
    db: AsyncSession,
    upload: YouTubeUpload,
    service,
    sandbox: bool,
    chunk: bytes,
    sent: int,
    total_size: int,
) -> int:
    """Send one chunk and reconcile with the response. Returns the new byte offset."""
    if sandbox:
        new_sent = sent + len(chunk)
        await _update_progress(db, upload, new_sent, total_size)
        return new_sent

    resp = await service.put_upload_chunk(upload.session_uri, chunk, sent, total_size)
    if resp.status_code in (200, 201):
        video_id = service.parse_video_id(resp.json())
        _complete(upload, video_id)
        await db.commit()
        return sent + len(chunk)
    if resp.status_code == 308:
        new_sent = sent + len(chunk)
        await _update_progress(db, upload, new_sent, total_size)
        return new_sent
    raise YouTubeUploadError(service.extract_google_error(resp), status_code=resp.status_code)


async def cancel_upload(
    db: AsyncSession, user_id: uuid.UUID, upload_id: uuid.UUID
) -> YouTubeUpload:
    upload = await get_upload_for_user(db, user_id, upload_id)
    _validate_cancel(upload)
    _do_cancel(upload)
    await db.commit()
    await db.refresh(upload)
    return upload


async def set_thumbnail(
    db: AsyncSession, user_id: uuid.UUID, upload_id: uuid.UUID, media_id: uuid.UUID
) -> YouTubeUpload:
    """Attach an image from the media library to an uploaded YouTube video via
    Google's thumbnails/set endpoint (a no-op in sandbox mode). The thumbnail URL is
    recorded on the upload's metadata for later reuse when the upload becomes a Post."""
    upload = await get_upload_for_user(db, user_id, upload_id)
    _require_uploaded(upload)

    media_result = await db.execute(
        select(Media).where(Media.id == media_id, Media.user_id == user_id)
    )
    media = media_result.scalar_one_or_none()
    if media is None:
        raise MediaNotFoundError("Thumbnail image not found.")
    _require_image_media(media)

    try:
        image_bytes = await get_storage().read(media.file_url)
    except Exception:  # noqa: BLE001 - unreadable storage backend
        raise MediaUnreadableError("Could not read the thumbnail image from storage.")

    if not get_settings().platform_sandbox_mode:
        account = await _load_account(db, upload.account_id)
        access_token = await ensure_valid_access_token(db, account, strict=True)
        service = get_platform_service(Platform.youtube)
        await service.set_thumbnail(
            access_token, upload.video_id, image_bytes, _thumbnail_content_type(media)
        )

    metadata = upload.metadata_json or {}
    upload.metadata_json = {**metadata, "thumbnail_url": media.file_url}
    await db.commit()
    await db.refresh(upload)
    return upload


async def publish_upload(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    upload_id: uuid.UUID,
    publish_date: datetime | None,
    tz_name: str | None,
    playlist_ids: list[str] | None = None,
) -> tuple[Post, YouTubeUpload, list[YouTubePlaylistItemResult]]:
    """Turn a finished upload (status=uploaded) into a Post on the connected YouTube
    account. The video is already live on YouTube, so "publishing" here means recording
    the Post + PostPlatform row (and, when scheduling, letting the scheduler fire it at
    the due time -- see post_service._publish_single_platform, which skips re-uploading
    when PostPlatform.meta.video_id is present).

    When playlist_ids are supplied, the video is associated with each playlist via
    playlistItems.insert AFTER the post is recorded. These calls are strictly best-effort:
    a playlist failure (quota, missing scope, deleted playlist, ...) produces an entry in
    the returned playlist_results and is persisted in metadata_json, but never fails the
    publish -- the video is already uploaded, and the post already exists."""
    upload = await get_upload_for_user(db, user_id, upload_id)
    _require_uploaded(upload)
    if upload.post_id is not None:
        raise InvalidUploadStateError("This video has already been published.")

    metadata = upload.metadata_json or {}
    title = metadata.get("title") or "Untitled video"
    privacy = metadata.get("privacy_status", "public")

    platform_options = {
        "video_id": upload.video_id,
        "upload_id": str(upload.id),
        "privacy": privacy,
        "tags": metadata.get("tags", []),
        "category": metadata.get("category"),
        "made_for_kids": metadata.get("made_for_kids", False),
        "description": metadata.get("description", ""),
        "thumbnail_url": metadata.get("thumbnail_url"),
    }
    platform_meta = {
        "video_id": upload.video_id,
        "upload_status": "uploaded",
        "privacy": privacy,
    }
    tz = tz_name or "UTC"

    if publish_date is None:
        post = Post(
            user_id=user_id,
            content=title,
            media_type="video",
            thumbnail_url=metadata.get("thumbnail_url"),
            platform_options=platform_options,
            timezone=tz,
            status=PostStatus.published,
            platforms=[
                PostPlatform(
                    social_account_id=upload.account_id,
                    platform=Platform.youtube,
                    status=PostPlatformStatus.published,
                    platform_post_id=upload.video_id,
                    published_at=datetime.now(timezone.utc),
                    meta=platform_meta,
                )
            ],
        )
    else:
        validate_future_publish_date(publish_date)
        post = Post(
            user_id=user_id,
            content=title,
            media_type="video",
            thumbnail_url=metadata.get("thumbnail_url"),
            platform_options=platform_options,
            timezone=tz,
            publish_date=publish_date,
            status=PostStatus.scheduled,
            platforms=[
                PostPlatform(
                    social_account_id=upload.account_id,
                    platform=Platform.youtube,
                    status=PostPlatformStatus.pending,
                    meta=platform_meta,
                )
            ],
        )

    db.add(post)
    await db.commit()
    await db.refresh(post, attribute_names=["platforms"])

    upload.post_id = post.id
    await db.commit()
    await db.refresh(upload)

    # Best-effort playlist association -- runs after the Post is safely recorded so a
    # playlist failure can never roll back the publish. The video bytes are NOT re-sent.
    try:
        playlist_results = await add_video_to_playlists(
            db,
            user_id=user_id,
            account_id=upload.account_id,
            playlist_ids=playlist_ids or [],
            video_id=upload.video_id or "",
        )
    except Exception as exc:  # noqa: BLE001 - playlist errors must never fail the publish
        playlist_results = [
            YouTubePlaylistItemResult(
                playlist_id=playlist_id, success=False, error=str(exc) or "Unexpected error."
            )
            for playlist_id in (playlist_ids or [])
        ]

    stored_metadata = upload.metadata_json or {}
    upload.metadata_json = {
        **stored_metadata,
        "playlist_ids": playlist_ids or [],
        "playlist_results": [
            {
                "playlist_id": result.playlist_id,
                "success": result.success,
                "error": result.error,
            }
            for result in playlist_results
        ],
    }
    await db.commit()
    await db.refresh(upload)
    return post, upload, playlist_results
