"""Unit tests for the YouTube playlist backend (list / create / add-to-playlist).

Follows the same style as test_youtube_upload.py: Google HTTP calls are mocked with
httpx.MockTransport and the DB is replaced by stubbing the playlist service's account
loader + token refresher (plus one focused test of the account loader itself), so no
PostgreSQL is needed.
"""
import json
import uuid

import httpx
import pytest

from app.config import get_settings
from app.models.enums import AccountStatus, Platform
from app.models.social_account import SocialAccount
from app.services import youtube_playlist_service
from app.services.youtube_playlist_service import (
    AccountInactiveError,
    InvalidYouTubeAccountError,
    MissingPlaylistScopeError,
    _load_owned_account,
    add_video_to_playlist,
    add_video_to_playlists,
    create_playlist,
    list_playlists,
)
from app.services.youtube_service import YouTubeUploadError

FORCE_SSL = "https://www.googleapis.com/auth/youtube.force-ssl"
BASE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]


def _account(**overrides) -> SocialAccount:
    values: dict = {
        "id": uuid.uuid4(),
        "user_id": uuid.uuid4(),
        "platform": Platform.youtube,
        "status": AccountStatus.active,
        "scopes": [*BASE_SCOPES, FORCE_SSL],
    }
    values.update(overrides)
    return SocialAccount(**values)


def _mock_http_client(monkeypatch, handler):
    """Point every httpx.AsyncClient created inside youtube_service at a MockTransport.
    youtube_service opens and closes a client per request, so each instantiation gets a
    fresh client (a shared client would be closed after the first `async with`)."""
    real_async_client = httpx.AsyncClient

    def factory(*a, **k):
        return real_async_client(transport=httpx.MockTransport(handler))

    monkeypatch.setattr(httpx, "AsyncClient", factory)


def _stub_loader_and_token(monkeypatch, account):
    async def fake_load(db, user_id, account_id):
        return account

    async def fake_token(db, account, *, strict=False):
        return "tok"

    monkeypatch.setattr(youtube_playlist_service, "_load_owned_account", fake_load)
    monkeypatch.setattr(youtube_playlist_service, "ensure_valid_access_token", fake_token)


def _sandbox_off(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "platform_sandbox_mode", False)


def _sandbox_on(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "platform_sandbox_mode", True)


class _FakeResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class _FakeDB:
    """Replays a single SocialAccount for queries whose WHERE clause references that
    account's id, user_id and platform -- mirroring _load_owned_account's filtering."""

    def __init__(self, account):
        self._account = account

    async def execute(self, stmt):
        params = {str(k): str(v) for k, v in stmt.compile().params.items()}
        values = set(params.values())
        account = self._account
        platform_matches = account.platform.value in values or str(account.platform) in values
        if str(account.id) in values and str(account.user_id) in values and platform_matches:
            return _FakeResult(account)
        return _FakeResult(None)


# --- account loader: ownership / platform / status enforcement -------------------


async def test_account_loader_scopes_to_owning_user():
    owner = uuid.uuid4()
    account = _account(user_id=owner)
    db = _FakeDB(account)

    loaded = await _load_owned_account(db, owner, account.id)
    assert loaded is account

    with pytest.raises(InvalidYouTubeAccountError):
        await _load_owned_account(db, uuid.uuid4(), account.id)


async def test_account_loader_rejects_other_platform():
    account = _account(platform=Platform.facebook)
    db = _FakeDB(account)
    with pytest.raises(InvalidYouTubeAccountError):
        await _load_owned_account(db, account.user_id, account.id)


async def test_account_loader_rejects_inactive_account():
    account = _account(status=AccountStatus.expired)
    db = _FakeDB(account)
    with pytest.raises(AccountInactiveError):
        await _load_owned_account(db, account.user_id, account.id)


# --- list playlists --------------------------------------------------------------


def _playlist_item(playlist_id, title="My playlist", item_count=3, privacy="private"):
    return {
        "id": playlist_id,
        "snippet": {
            "title": title,
            "description": "A description",
            "thumbnails": {"medium": {"url": "https://example.com/thumb.jpg"}},
        },
        "status": {"privacyStatus": privacy},
        "contentDetails": {"itemCount": item_count},
    }


async def test_list_playlists_normalizes_items(monkeypatch):
    _sandbox_off(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())

    def handler(request):
        return httpx.Response(
            200,
            json={"items": [_playlist_item("PL_ONE"), _playlist_item("PL_TWO", item_count=0)]},
            request=request,
        )

    _mock_http_client(monkeypatch, handler)
    playlists = await list_playlists(monkeypatch, None, uuid.uuid4())

    assert len(playlists) == 2
    first = playlists[0]
    assert first.playlist_id == "PL_ONE"
    assert first.title == "My playlist"
    assert first.description == "A description"
    assert first.privacy_status == "private"
    assert first.item_count == 3
    assert first.thumbnail_url == "https://example.com/thumb.jpg"
    assert playlists[1].item_count == 0


async def test_list_playlists_raises_on_google_error(monkeypatch):
    _sandbox_off(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())

    def handler(request):
        return httpx.Response(
            403,
            json={"error": {"code": 403, "message": "Forbidden"}},
            request=request,
        )

    _mock_http_client(monkeypatch, handler)
    with pytest.raises(YouTubeUploadError) as exc_info:
        await list_playlists(monkeypatch, None, uuid.uuid4())
    assert exc_info.value.status_code == 403


async def test_list_playlists_enforces_ownership(monkeypatch):
    async def fake_load(db, user_id, account_id):
        raise InvalidYouTubeAccountError("YouTube account not found.")

    monkeypatch.setattr(youtube_playlist_service, "_load_owned_account", fake_load)
    with pytest.raises(InvalidYouTubeAccountError):
        await list_playlists(monkeypatch, None, uuid.uuid4())


# --- create playlist --------------------------------------------------------------


async def test_create_playlist_sends_expected_payload(monkeypatch):
    _sandbox_off(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())
    captured = {}

    def handler(request):
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json=_playlist_item("PL_NEW", title="Course", privacy="unlisted"),
            request=request,
        )

    _mock_http_client(monkeypatch, handler)
    created = await create_playlist(
        monkeypatch,
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        title="Course",
        description="All lectures",
        privacy_status="unlisted",
    )

    assert captured["url"].startswith("https://www.googleapis.com/youtube/v3/playlists")
    assert "part=snippet%2Cstatus" in captured["url"]
    assert captured["body"] == {
        "snippet": {"title": "Course", "description": "All lectures"},
        "status": {"privacyStatus": "unlisted"},
    }
    assert created.playlist_id == "PL_NEW"
    assert created.title == "Course"
    assert created.privacy_status == "unlisted"


async def test_create_playlist_requires_playlist_scope(monkeypatch):
    _stub_loader_and_token(monkeypatch, _account(scopes=BASE_SCOPES))
    with pytest.raises(MissingPlaylistScopeError):
        await create_playlist(
            monkeypatch,
            user_id=uuid.uuid4(),
            account_id=uuid.uuid4(),
            title="X",
            description=None,
            privacy_status="public",
        )


async def test_create_playlist_raises_on_google_error(monkeypatch):
    _sandbox_off(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())

    def handler(request):
        return httpx.Response(
            400,
            json={"error": {"code": 400, "message": "playlistTitleRequired"}},
            request=request,
        )

    _mock_http_client(monkeypatch, handler)
    with pytest.raises(YouTubeUploadError) as exc_info:
        await create_playlist(
            monkeypatch,
            user_id=uuid.uuid4(),
            account_id=uuid.uuid4(),
            title="X",
            description=None,
            privacy_status="public",
        )
    assert exc_info.value.status_code == 400


# --- add video to playlist --------------------------------------------------------


async def test_add_video_to_playlist_sends_expected_payload(monkeypatch):
    _sandbox_off(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())
    captured = {}

    def handler(request):
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "item_123"}, request=request)

    _mock_http_client(monkeypatch, handler)
    result = await add_video_to_playlist(
        monkeypatch,
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        playlist_id="PL_ONE",
        video_id="VID_9",
    )

    assert captured["url"].startswith("https://www.googleapis.com/youtube/v3/playlistItems")
    assert captured["body"] == {
        "snippet": {
            "playlistId": "PL_ONE",
            "resourceId": {"kind": "youtube#video", "videoId": "VID_9"},
        }
    }
    assert result.playlist_id == "PL_ONE"
    assert result.success is True
    assert result.error is None


async def test_add_video_to_playlist_raises_on_failure(monkeypatch):
    _sandbox_off(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())

    def handler(request):
        return httpx.Response(
            403,
            json={"error": {"code": 403, "message": "playlistItemsNotAccessible"}},
            request=request,
        )

    _mock_http_client(monkeypatch, handler)
    with pytest.raises(YouTubeUploadError) as exc_info:
        await add_video_to_playlist(
            monkeypatch,
            user_id=uuid.uuid4(),
            account_id=uuid.uuid4(),
            playlist_id="PL_ONE",
            video_id="VID_9",
        )
    # The batch path intentionally collapses per-playlist errors into a message (no
    # granular status code), so assert on the message rather than status_code.
    assert "403" in str(exc_info.value)


async def test_add_video_to_playlists_is_best_effort(monkeypatch):
    """One playlist failing (403) must not stop the next playlist from succeeding, and
    the results must reflect each playlist individually."""
    _sandbox_off(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())
    called: list[str] = []

    def handler(request):
        body = json.loads(request.content)
        pid = body["snippet"]["playlistId"]
        called.append(pid)
        if pid == "PL_BAD":
            return httpx.Response(
                403,
                json={"error": {"code": 403, "message": "playlistItemsNotAccessible"}},
                request=request,
            )
        return httpx.Response(200, json={"id": f"item_{pid}"}, request=request)

    _mock_http_client(monkeypatch, handler)
    results = await add_video_to_playlists(
        monkeypatch,
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        playlist_ids=["PL_BAD", "PL_GOOD"],
        video_id="VID_9",
    )

    assert called == ["PL_BAD", "PL_GOOD"]
    assert len(results) == 2
    assert results[0].playlist_id == "PL_BAD"
    assert results[0].success is False
    assert "403" in (results[0].error or "")
    assert results[1].playlist_id == "PL_GOOD"
    assert results[1].success is True
    assert results[1].error is None


async def test_add_video_to_playlists_missing_scope_yields_failures_not_exceptions(monkeypatch):
    """The publish flow must never raise because of a missing playlist scope -- it should
    get per-playlist failed results carrying the reconnect message instead."""
    _stub_loader_and_token(monkeypatch, _account(scopes=BASE_SCOPES))
    results = await add_video_to_playlists(
        monkeypatch,
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        playlist_ids=["PL_ONE"],
        video_id="VID_9",
    )
    assert len(results) == 1
    assert results[0].success is False
    assert "Reconnect your YouTube account" in (results[0].error or "")


async def test_add_video_to_playlists_empty_selection(monkeypatch):
    results = await add_video_to_playlists(
        monkeypatch,
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        playlist_ids=[],
        video_id="VID_9",
    )
    assert results == []


# --- sandbox mode -----------------------------------------------------------------


async def test_list_playlists_sandbox_returns_empty(monkeypatch):
    _sandbox_on(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())
    assert await list_playlists(monkeypatch, None, uuid.uuid4()) == []


async def test_create_playlist_sandbox_returns_simulated_playlist(monkeypatch):
    _sandbox_on(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())
    created = await create_playlist(
        monkeypatch,
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        title="Sandbox series",
        description=None,
        privacy_status="public",
    )
    assert created.playlist_id.startswith("sandbox_playlist_")
    assert created.title == "Sandbox series"
    assert created.privacy_status == "public"


async def test_add_video_to_playlists_sandbox_succeeds(monkeypatch):
    _sandbox_on(monkeypatch)
    _stub_loader_and_token(monkeypatch, _account())
    results = await add_video_to_playlists(
        monkeypatch,
        user_id=uuid.uuid4(),
        account_id=uuid.uuid4(),
        playlist_ids=["PL_ONE", "PL_TWO"],
        video_id="VID_9",
    )
    assert [r.success for r in results] == [True, True]
