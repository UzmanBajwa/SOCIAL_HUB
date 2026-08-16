import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.post import PostRead
from app.schemas.youtube import (
    YouTubePlaylistCreate,
    YouTubePlaylistItemResult,
    YouTubePlaylistRead,
    YouTubePlaylistVideoRequest,
    YouTubePublishRequest,
    YouTubePublishResponse,
    YouTubeThumbnailRequest,
    YouTubeUploadInitRequest,
    YouTubeUploadInitResponse,
    YouTubeUploadProgressResponse,
)
from app.services import youtube_playlist_service, youtube_upload_service
from app.services.account_service import AccountTokenError
from app.services.youtube_service import YouTubeUploadError

router = APIRouter(prefix="/youtube", tags=["youtube"])

# Service exceptions -> HTTP status. Kept in one place so every endpoint maps Google
# failures identically and none of the mapping is duplicated.
_ERROR_MAP: list[tuple[type[Exception], int]] = [
    (youtube_upload_service.YouTubeDisabledError, status.HTTP_400_BAD_REQUEST),
    (youtube_upload_service.InvalidYouTubeAccountError, status.HTTP_404_NOT_FOUND),
    (youtube_upload_service.AccountInactiveError, status.HTTP_400_BAD_REQUEST),
    (youtube_upload_service.MediaNotFoundError, status.HTTP_404_NOT_FOUND),
    (youtube_upload_service.InvalidMediaError, status.HTTP_400_BAD_REQUEST),
    (youtube_upload_service.MediaUnreadableError, status.HTTP_400_BAD_REQUEST),
    (youtube_upload_service.FileTooLargeError, status.HTTP_413_REQUEST_ENTITY_TOO_LARGE),
    (youtube_upload_service.UploadNotFoundError, status.HTTP_404_NOT_FOUND),
    (youtube_upload_service.InvalidUploadStateError, status.HTTP_409_CONFLICT),
    (youtube_playlist_service.InvalidYouTubeAccountError, status.HTTP_404_NOT_FOUND),
    (youtube_playlist_service.AccountInactiveError, status.HTTP_400_BAD_REQUEST),
    (youtube_playlist_service.MissingPlaylistScopeError, status.HTTP_400_BAD_REQUEST),
    (AccountTokenError, status.HTTP_401_UNAUTHORIZED),
]


def _http_error(exc: Exception) -> HTTPException:
    if isinstance(exc, YouTubeUploadError):
        # 401/403 are credential/permission problems; anything else is a Google failure.
        http_status = (
            exc.status_code
            if exc.status_code in (401, 403)
            else status.HTTP_502_BAD_GATEWAY
        )
        return HTTPException(http_status, str(exc))
    for exc_type, http_status in _ERROR_MAP:
        if isinstance(exc, exc_type):
            return HTTPException(http_status, str(exc))
    return HTTPException(status.HTTP_502_BAD_GATEWAY, "Unexpected upload failure.")


def _init_response(upload) -> YouTubeUploadInitResponse:
    meta = upload.metadata_json or {}
    return YouTubeUploadInitResponse(
        upload_id=upload.id,
        status=upload.status,
        progress=upload.progress,
        title=meta.get("title", ""),
        total_size=meta.get("total_size", 0),
        video_id=upload.video_id,
        error=upload.error,
        post_id=upload.post_id,
    )


@router.post(
    "/upload/init", response_model=YouTubeUploadInitResponse, status_code=status.HTTP_201_CREATED
)
async def init_upload(
    payload: YouTubeUploadInitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubeUploadInitResponse:
    try:
        upload = await youtube_upload_service.init_upload(
            db,
            user_id=current_user.id,
            account_id=payload.account_id,
            media_id=payload.media_id,
            total_size=payload.total_size,
            title=payload.title,
            description=payload.description,
            privacy_status=payload.privacy_status,
            tags=payload.tags,
            category=payload.category,
            made_for_kids=payload.made_for_kids,
            thumbnail_url=payload.thumbnail_url,
        )
    except Exception as exc:  # noqa: BLE001 - centralized mapping below
        raise _http_error(exc)
    return _init_response(upload)


@router.post("/upload/{upload_id}/data", response_model=YouTubeUploadProgressResponse)
async def upload_data(
    upload_id: uuid.UUID,
    request: Request,
    media_id: uuid.UUID | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubeUploadProgressResponse:
    try:
        upload = await youtube_upload_service.get_upload_for_user(
            db, current_user.id, upload_id
        )
        if upload.status in (
            youtube_upload_service.YouTubeUploadStatus.uploaded,
            youtube_upload_service.YouTubeUploadStatus.processing,
            youtube_upload_service.YouTubeUploadStatus.completed,
        ):
            raise youtube_upload_service.InvalidUploadStateError(
                "This upload has already finished."
            )
        if upload.status == youtube_upload_service.YouTubeUploadStatus.uploading:
            raise youtube_upload_service.InvalidUploadStateError(
                "This upload is already in progress."
            )

        content_length = int(request.headers.get("content-length") or 0)
        if content_length > 0:
            # Raw-body path: the frontend streams the video bytes directly to us and we
            # pipe them to Google in chunks. Used for videos beyond the /media/upload cap.
            upload = await youtube_upload_service.stream_raw_body(db, upload, request)
        else:
            if media_id is not None:
                upload.media_id = media_id
                await db.commit()
            upload = await youtube_upload_service.stream_media_file(db, upload)
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)
    return YouTubeUploadProgressResponse.model_validate(upload)


@router.get("/upload/{upload_id}/progress", response_model=YouTubeUploadProgressResponse)
async def get_progress(
    upload_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubeUploadProgressResponse:
    try:
        upload = await youtube_upload_service.get_upload_for_user(
            db, current_user.id, upload_id
        )
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)
    return YouTubeUploadProgressResponse.model_validate(upload)


@router.post("/upload/{upload_id}/cancel", response_model=YouTubeUploadProgressResponse)
async def cancel_upload(
    upload_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubeUploadProgressResponse:
    try:
        upload = await youtube_upload_service.cancel_upload(db, current_user.id, upload_id)
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)
    return YouTubeUploadProgressResponse.model_validate(upload)


@router.post("/upload/{upload_id}/thumbnail", response_model=YouTubeUploadProgressResponse)
async def set_thumbnail(
    upload_id: uuid.UUID,
    payload: YouTubeThumbnailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubeUploadProgressResponse:
    try:
        upload = await youtube_upload_service.set_thumbnail(
            db, current_user.id, upload_id, payload.media_id
        )
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)
    return YouTubeUploadProgressResponse.model_validate(upload)


@router.post("/upload/{upload_id}/publish", response_model=YouTubePublishResponse)
async def publish_upload(
    upload_id: uuid.UUID,
    payload: YouTubePublishRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubePublishResponse:
    try:
        post, _upload, playlist_results = await youtube_upload_service.publish_upload(
            db,
            user_id=current_user.id,
            upload_id=upload_id,
            publish_date=payload.publish_date,
            tz_name=payload.timezone,
            playlist_ids=payload.playlist_ids,
        )
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)
    return YouTubePublishResponse(
        post=PostRead.model_validate(post),
        playlist_results=playlist_results,
    )


# --- Playlists ----------------------------------------------------------------

PLAYLIST_ACCOUNT_ID = Query(..., description="The connected YouTube account id.")


@router.get("/playlists", response_model=list[YouTubePlaylistRead])
async def list_playlists(
    account_id: uuid.UUID = PLAYLIST_ACCOUNT_ID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[YouTubePlaylistRead]:
    """List the playlists on the authenticated user's connected YouTube channel."""
    try:
        return await youtube_playlist_service.list_playlists(
            db, current_user.id, account_id
        )
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)


@router.post(
    "/playlists", response_model=YouTubePlaylistRead, status_code=status.HTTP_201_CREATED
)
async def create_playlist(
    payload: YouTubePlaylistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubePlaylistRead:
    """Create a playlist on the connected channel and return it (with its YouTube id) so
    the client can select it without reloading."""
    try:
        return await youtube_playlist_service.create_playlist(
            db,
            user_id=current_user.id,
            account_id=payload.account_id,
            title=payload.title,
            description=payload.description,
            privacy_status=payload.privacy_status,
        )
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)


@router.post("/playlists/{playlist_id}/videos", response_model=YouTubePlaylistItemResult)
async def add_video_to_playlist(
    playlist_id: str,
    payload: YouTubePlaylistVideoRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> YouTubePlaylistItemResult:
    """Associate an already-uploaded video with a playlist via playlistItems.insert. The
    video bytes are never re-sent -- video_id must reference a completed upload."""
    try:
        return await youtube_playlist_service.add_video_to_playlist(
            db,
            user_id=current_user.id,
            account_id=payload.account_id,
            playlist_id=playlist_id,
            video_id=payload.video_id,
        )
    except Exception as exc:  # noqa: BLE001
        raise _http_error(exc)
