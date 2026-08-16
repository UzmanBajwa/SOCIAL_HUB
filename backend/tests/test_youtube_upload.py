"""Focused unit tests for the YouTube Studio uploader backend (Task 2).

These tests mock Google HTTP calls and avoid the PostgreSQL test database entirely, so
they run even while the shared `socialhub_test` CREATEDB privilege is blocked (see
tests/conftest.py). DB-dependent coverage is provided by the skipped tests at the bottom,
which can be enabled once a DBA grants CREATE DATABASE (or sets TEST_DB_NAME to a
database the app role can create).
"""
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest
from pydantic import ValidationError

from app.models.enums import MediaType, Platform, YouTubeUploadStatus
from app.models.media import Media
from app.models.social_account import SocialAccount
from app.models.youtube_upload import YouTubeUpload
from app.schemas.youtube import (
    YouTubeUploadInitRequest,
    YouTubeUploadProgressResponse,
)
from app.services.account_service import AccountTokenError, ensure_valid_access_token
from app.services.encryption import get_encryptor
from app.services.registry import get_platform_service
from app.services.youtube_service import YouTubeService, YouTubeUploadError
from app.services.youtube_upload_service import (
    FileTooLargeError,
    InvalidMediaError,
    InvalidUploadStateError,
    InvalidYouTubeAccountError,
    _assert_account_owned,
    _assert_size_within_limit,
    _build_youtube_metadata,
    _do_cancel,
    _require_image_media,
    _require_uploaded,
    _require_video_media,
    _stream_to_youtube,
    _validate_cancel,
)

NOW = datetime.now(timezone.utc)
CHUNK = 4  # patched onto settings so tests exercise multi-chunk coalescing cheaply


def get_settings_for_test(monkeypatch):
    from app.config import get_settings

    settings = get_settings()
    monkeypatch.setattr(settings, "youtube_upload_chunk_size", CHUNK)
    monkeypatch.setattr(settings, "platform_sandbox_mode", False)
    return settings


class FakeDB:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1


async def _source(*chunks: bytes):
    for chunk in chunks:
        yield chunk


def _mock_http_client(monkeypatch, handler):
    """Point every httpx.AsyncClient created inside youtube_service at a MockTransport."""
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: client)


def _youtube_service(monkeypatch, put_handler=None, query_handler=None):
    service = get_platform_service(Platform.youtube)
    if put_handler is not None:
        async def fake_put(session_uri, chunk, start, total_size):
            return put_handler(session_uri, chunk, start, total_size)

        monkeypatch.setattr(service, "put_upload_chunk", fake_put)
    if query_handler is not None:
        async def fake_query(session_uri, total_size):
            return query_handler(session_uri, total_size)

        monkeypatch.setattr(service, "query_upload_status", fake_query)
    return service


# --- 1/2. init request validation (pure schema) ----------------------------------


def test_init_request_rejects_missing_source():
    with pytest.raises(ValidationError):
        YouTubeUploadInitRequest(account_id=uuid.uuid4(), title="My video")


def test_init_request_rejects_two_sources():
    with pytest.raises(ValidationError):
        YouTubeUploadInitRequest(
            account_id=uuid.uuid4(),
            title="My video",
            media_id=uuid.uuid4(),
            total_size=1024,
        )


def test_init_request_rejects_bad_privacy():
    with pytest.raises(ValidationError):
        YouTubeUploadInitRequest(
            account_id=uuid.uuid4(), title="My video", total_size=1024, privacy_status="secret"
        )


def test_init_request_accepts_studio_metadata():
    request = YouTubeUploadInitRequest(
        account_id=uuid.uuid4(),
        title="My video",
        total_size=1024,
        tags=["tag a", "  tag b  ", ""],
        category="22",
        made_for_kids=True,
        thumbnail_url="https://cdn.example.com/thumb.jpg",
    )
    assert request.tags == ["tag a", "tag b"]  # stripped + empties dropped
    assert request.category == "22"
    assert request.made_for_kids is True
    assert request.thumbnail_url == "https://cdn.example.com/thumb.jpg"


def test_init_request_rejects_too_many_tags():
    with pytest.raises(ValidationError):
        YouTubeUploadInitRequest(
            account_id=uuid.uuid4(), title="My video", total_size=1024, tags=[f"t{i}" for i in range(21)]
        )


def test_build_youtube_metadata_includes_studio_fields():
    metadata = _build_youtube_metadata(
        title="Title",
        description="Desc",
        privacy_status="unlisted",
        tags=["a", "b"],
        category="22",
        made_for_kids=True,
    )
    assert metadata["snippet"]["title"] == "Title"
    assert metadata["snippet"]["tags"] == ["a", "b"]
    assert metadata["snippet"]["categoryId"] == "22"
    assert metadata["status"]["privacyStatus"] == "unlisted"
    assert metadata["status"]["selfDeclaredMadeForKids"] is True


def test_build_youtube_metadata_omits_empty_studio_fields():
    metadata = _build_youtube_metadata(
        title="Title",
        description=None,
        privacy_status="public",
        tags=None,
        category=None,
        made_for_kids=False,
    )
    assert "tags" not in metadata["snippet"]
    assert "categoryId" not in metadata["snippet"]
    assert metadata["snippet"]["description"] == ""
    assert metadata["status"]["selfDeclaredMadeForKids"] is False


# --- 3. non-video media rejected (pure validator) --------------------------------


def test_non_video_media_rejected():
    media = Media(type=MediaType.image)
    with pytest.raises(InvalidMediaError):
        _require_video_media(media)


def test_video_media_accepted():
    media = Media(type=MediaType.video)
    _require_video_media(media)  # must not raise


def test_thumbnail_requires_image_media():
    _require_image_media(Media(type=MediaType.image))
    with pytest.raises(InvalidMediaError):
        _require_image_media(Media(type=MediaType.video))


def test_publish_requires_finished_upload():
    not_done = YouTubeUpload(status=YouTubeUploadStatus.uploaded, video_id=None)
    with pytest.raises(InvalidUploadStateError):
        _require_uploaded(not_done)
    in_progress = YouTubeUpload(status=YouTubeUploadStatus.uploading, video_id=None)
    with pytest.raises(InvalidUploadStateError):
        _require_uploaded(in_progress)
    done = YouTubeUpload(status=YouTubeUploadStatus.uploaded, video_id="VID123")
    _require_uploaded(done)  # must not raise


# --- 2. ownership enforcement (pure validator) -----------------------------------


def test_account_ownership_enforced():
    owner = uuid.uuid4()
    account = SocialAccount(user_id=owner)
    _assert_account_owned(account, owner)
    with pytest.raises(InvalidYouTubeAccountError):
        _assert_account_owned(account, uuid.uuid4())


def test_size_limit_enforced():
    _assert_size_within_limit(100, 100)
    with pytest.raises(FileTooLargeError):
        _assert_size_within_limit(101, 100)


# --- 5/4. upload record + progress response serialization ------------------------


def test_upload_record_shape_and_progress_serialization():
    upload = YouTubeUpload(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        status=YouTubeUploadStatus.uploading,
        progress=42,
        video_id=None,
        error=None,
        post_id=None,
    )
    resp = YouTubeUploadProgressResponse.model_validate(upload)
    assert resp.upload_id == upload.id
    assert resp.status == YouTubeUploadStatus.uploading
    assert resp.progress == 42
    assert resp.video_id is None
    assert resp.error is None
    assert resp.post_id is None


# --- 6. token refresh uses the YouTube refresh token -----------------------------


async def test_token_refresh_uses_refresh_token(monkeypatch):
    enc = get_encryptor()
    account = SocialAccount(
        platform=Platform.youtube,
        access_token=enc.encrypt("stale"),
        refresh_token=enc.encrypt("real_refresh"),
        expires_at=NOW + timedelta(minutes=1),  # within the 5-minute refresh buffer
    )
    service = get_platform_service(Platform.youtube)
    captured = {}

    async def fake_refresh(token):
        captured["token"] = token
        return "fresh_token", NOW + timedelta(hours=1)

    monkeypatch.setattr(service, "refresh_access_token", fake_refresh)
    db = FakeDB()

    token = await ensure_valid_access_token(db, account, strict=True)

    assert captured["token"] == "real_refresh"  # OAuth refresh_token, NOT the access token
    assert token == "fresh_token"
    assert db.commits == 1
    assert enc.decrypt(account.access_token) == "fresh_token"


async def test_token_refresh_failure_strict_raises(monkeypatch):
    enc = get_encryptor()
    account = SocialAccount(
        platform=Platform.youtube,
        access_token=enc.encrypt("stale"),
        refresh_token=enc.encrypt("real_refresh"),
        expires_at=NOW - timedelta(minutes=1),  # already expired
    )
    service = get_platform_service(Platform.youtube)

    async def fake_refresh(token):
        raise RuntimeError("network down")

    monkeypatch.setattr(service, "refresh_access_token", fake_refresh)
    db = FakeDB()

    with pytest.raises(AccountTokenError):
        await ensure_valid_access_token(db, account, strict=True)

    # Best-effort (publish) mode falls through to the stored token instead of raising.
    token = await ensure_valid_access_token(db, account, strict=False)
    assert token == "stale"


# --- 7. Google resumable upload response handling --------------------------------

async def test_stream_to_youtube_chunks_and_completes(monkeypatch):
    settings = get_settings_for_test(monkeypatch)
    enc = get_encryptor()
    account = SocialAccount(
        platform=Platform.youtube,
        access_token=enc.encrypt("tok"),
        expires_at=NOW + timedelta(hours=1),  # no refresh needed
    )
    upload = YouTubeUpload(
        session_uri="https://upload.example.com/resumable",
        status=YouTubeUploadStatus.initialized,
        progress=0,
    )
    total = 10
    calls = []

    def put_handler(session_uri, chunk, start, total_size):
        calls.append((start, len(chunk), total_size))
        if start + len(chunk) < total_size:
            return httpx.Response(
                308, headers={"Range": f"bytes=0-{start + len(chunk) - 1}"}, request=httpx.Request("PUT", session_uri)
            )
        return httpx.Response(201, json={"id": "VID123"}, request=httpx.Request("PUT", session_uri))

    _youtube_service(monkeypatch, put_handler=put_handler)
    db = FakeDB()

    result = await _stream_to_youtube(
        db, upload, account, _source(b"01234", b"56789"), total, start=0
    )

    # Chunking into 4-byte pieces: bytes 0-3, 4-7, then the final 8-9 chunk (201).
    assert calls == [(0, 4, 10), (4, 4, 10), (8, 2, 10)]
    assert result.status == YouTubeUploadStatus.uploaded
    assert result.video_id == "VID123"
    assert result.progress == 100
    assert result.error is None


async def test_stream_resumes_from_byte_offset(monkeypatch):
    get_settings_for_test(monkeypatch)
    enc = get_encryptor()
    account = SocialAccount(
        platform=Platform.youtube,
        access_token=enc.encrypt("tok"),
        expires_at=NOW + timedelta(hours=1),
    )
    upload = YouTubeUpload(
        session_uri="https://upload.example.com/resumable",
        status=YouTubeUploadStatus.uploading,
        progress=40,
    )
    total = 10
    calls = []

    def put_handler(session_uri, chunk, start, total_size):
        calls.append(start)
        return httpx.Response(201, json={"id": "VID_RSM"}, request=httpx.Request("PUT", session_uri))

    _youtube_service(monkeypatch, put_handler=put_handler)
    db = FakeDB()

    result = await _stream_to_youtube(
        db, upload, account, _source(b"56789"), total, start=4
    )

    assert calls == [4]  # resumes at byte 4, never re-sends bytes 0-3
    assert result.status == YouTubeUploadStatus.uploaded
    assert result.video_id == "VID_RSM"


async def test_stream_marks_failed_on_google_error(monkeypatch):
    get_settings_for_test(monkeypatch)
    enc = get_encryptor()
    account = SocialAccount(
        platform=Platform.youtube,
        access_token=enc.encrypt("tok"),
        expires_at=NOW + timedelta(hours=1),
    )
    upload = YouTubeUpload(
        session_uri="https://upload.example.com/resumable",
        status=YouTubeUploadStatus.initialized,
        progress=0,
    )

    def put_handler(session_uri, chunk, start, total_size):
        return httpx.Response(
            403,
            json={"error": {"code": 403, "message": "quota exceeded"}},
            request=httpx.Request("PUT", session_uri),
        )

    _youtube_service(monkeypatch, put_handler=put_handler)
    db = FakeDB()

    with pytest.raises(YouTubeUploadError) as exc_info:
        await _stream_to_youtube(db, upload, account, _source(b"0123456789"), 10, start=0)

    assert exc_info.value.status_code == 403
    assert "quota exceeded" in str(exc_info.value)
    assert upload.status == YouTubeUploadStatus.failed
    assert upload.progress == 0


async def test_query_upload_status_resume_offset(monkeypatch):
    service = get_platform_service(Platform.youtube)

    def handler(request):
        return httpx.Response(
            308,
            headers={"Range": "bytes=0-6"},
            request=httpx.Request("PUT", request.url),
        )

    _mock_http_client(monkeypatch, handler)
    last, video_id = await service.query_upload_status("https://upload.example.com/x", 10)

    assert last == 7  # bytes 0..6 received -> next byte is 7
    assert video_id is None


async def test_query_upload_status_completed(monkeypatch):
    service = get_platform_service(Platform.youtube)

    def handler(request):
        return httpx.Response(
            200, json={"id": "DONE"}, request=httpx.Request("PUT", request.url)
        )

    _mock_http_client(monkeypatch, handler)
    last, video_id = await service.query_upload_status("https://upload.example.com/x", 10)

    assert (last, video_id) == (10, "DONE")


async def test_query_upload_status_dead_session(monkeypatch):
    service = get_platform_service(Platform.youtube)

    def handler(request):
        return httpx.Response(404, request=httpx.Request("PUT", request.url))

    _mock_http_client(monkeypatch, handler)

    with pytest.raises(YouTubeUploadError) as exc_info:
        await service.query_upload_status("https://upload.example.com/x", 10)

    assert exc_info.value.status_code == 404


async def test_put_upload_chunk_sends_correct_headers(monkeypatch):
    service = get_platform_service(Platform.youtube)
    captured = {}

    def handler(request):
        captured["content_range"] = request.headers.get("Content-Range")
        captured["content_length"] = request.headers.get("Content-Length")
        captured["body"] = request.content
        return httpx.Response(
            308,
            headers={"Range": "bytes=0-4"},
            request=httpx.Request("PUT", request.url),
        )

    _mock_http_client(monkeypatch, handler)
    resp = await service.put_upload_chunk("https://upload.example.com/x", b"01234", 0, 10)

    assert resp.status_code == 308
    assert captured["content_range"] == "bytes 0-4/10"
    assert captured["content_length"] == "5"
    assert captured["body"] == b"01234"


def test_extract_google_error_json():
    req = httpx.Request("POST", "https://google.com")
    resp = httpx.Response(403, json={"error": {"code": 403, "message": "Forbidden"}}, request=req)
    message = YouTubeService.extract_google_error(resp)
    assert "403" in message
    assert "Forbidden" in message


def test_extract_google_error_non_json():
    req = httpx.Request("POST", "https://google.com")
    resp = httpx.Response(500, content=b"<html>oops</html>", request=req)
    assert "500" in YouTubeService.extract_google_error(resp)


# --- thumbnail upload (thumbnails/set) ---------------------------------------------


async def test_set_thumbnail_sends_image_bytes(monkeypatch):
    service = get_platform_service(Platform.youtube)
    captured = {}

    def handler(request):
        captured["url"] = str(request.url)
        captured["content_type"] = request.headers.get("Content-Type")
        captured["auth"] = request.headers.get("Authorization")
        captured["body"] = request.content
        return httpx.Response(200, json={"items": [{"default": "http://img"}]}, request=request)

    _mock_http_client(monkeypatch, handler)
    await service.set_thumbnail("tok", "VID1", b"\xff\xd8\xff\xe0", "image/jpeg")

    assert captured["url"].endswith("videoId=VID1")
    assert captured["content_type"] == "image/jpeg"
    assert captured["auth"] == "Bearer tok"
    assert captured["body"] == b"\xff\xd8\xff\xe0"


async def test_set_thumbnail_raises_on_google_error(monkeypatch):
    service = get_platform_service(Platform.youtube)

    def handler(request):
        return httpx.Response(
            403,
            json={"error": {"code": 403, "message": "not owner"}},
            request=request,
        )

    _mock_http_client(monkeypatch, handler)
    with pytest.raises(YouTubeUploadError) as exc_info:
        await service.set_thumbnail("tok", "VID1", b"bytes", "image/png")
    assert exc_info.value.status_code == 403


# --- cancel lifecycle -------------------------------------------------------------


def test_cancel_rejects_finished_upload():
    upload = YouTubeUpload(status=YouTubeUploadStatus.uploaded, session_uri="https://x")
    with pytest.raises(InvalidUploadStateError):
        _validate_cancel(upload)


def test_cancel_marks_cancelled_and_drops_session():
    upload = YouTubeUpload(status=YouTubeUploadStatus.uploading, session_uri="https://x")
    _do_cancel(upload)
    assert upload.status == YouTubeUploadStatus.cancelled
    assert upload.session_uri is None


# --- DB-dependent coverage (blocked by the shared CREATEDB privilege) -------------

_db_reason = (
    "requires the socialhub_test PostgreSQL database (CREATE DATABASE is blocked for the "
    "socialhub role). Enable once a DBA grants CREATEDB."
)


@pytest.mark.skip(reason=_db_reason)
async def test_unauthorized_init_rejected(api_client):
    resp = await api_client.post(
        "/youtube/upload/init",
        json={"account_id": str(uuid.uuid4()), "media_id": str(uuid.uuid4()), "title": "x"},
    )
    assert resp.status_code == 404


@pytest.mark.skip(reason=_db_reason)
async def test_user_cannot_access_another_users_upload(db_session, user, api_client):
    from app.models.youtube_upload import YouTubeUpload

    other = uuid.uuid4()
    upload = YouTubeUpload(
        id=uuid.uuid4(), user_id=other, account_id=uuid.uuid4(), status=YouTubeUploadStatus.initialized
    )
    db_session.add(upload)
    await db_session.commit()
    resp = await api_client.get(f"/youtube/upload/{upload.id}/progress")
    assert resp.status_code == 404


@pytest.mark.skip(reason=_db_reason)
async def test_upload_record_created_and_progress_returns_state(db_session, user):
    from app.services.youtube_upload_service import init_upload

    account = SocialAccount(
        user_id=user.id,
        platform=Platform.youtube,
        account_name="Test YT",
        platform_account_id="ch-1",
        access_token=get_encryptor().encrypt("tok"),
        refresh_token=get_encryptor().encrypt("rt"),
        expires_at=NOW + timedelta(hours=1),
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    upload = await init_upload(
        db_session,
        user_id=user.id,
        account_id=account.id,
        media_id=None,
        total_size=1024,
        title="Test",
        description=None,
        privacy_status="public",
    )
    assert upload.status == YouTubeUploadStatus.initialized
    assert upload.progress == 0
    assert (upload.metadata_json or {}).get("total_size") == 1024
