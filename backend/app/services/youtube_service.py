from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.services.base import OAuthTokenSet, PlatformService, PublishContent, PublishResult

# Scopes requested on Google's consent screen.
#
#   youtube.upload      - upload/manage videos (the Studio uploader)
#   youtube.readonly    - read the channel + list the user's own playlists
#   youtube.force-ssl   - WRITE access for playlists: playlists.insert and
#                         playlistItems.insert both require the `youtube` /
#                         `youtube.force-ssl` / `youtubepartner` scope (see
#                         developers.google.com/youtube/v3/docs/playlists/insert and
#                         .../playlistItems/insert). Google recommends
#                         youtube.force-ssl for server-side web apps like this backend.
#
# Accounts authorized before this scope was added only carry youtube.upload +
# youtube.readonly, so playlist writes will 403 until the user reconnects. The frontend
# surfaces that via the stored `scopes` list (see SocialAccount.scopes).
YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
]

YOUTUBE_UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"


class YouTubeUploadError(Exception):
    """A YouTube/Google resumable-upload API failure. `status_code` mirrors the Google
    HTTP response (401 = bad credentials, 403 = permission, 404 = dead session, ...) so
    the API layer can map it to the right HTTP status without knowing Google's body."""

    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class YouTubeService(PlatformService):
    platform_name = "youtube"

    # Google tokens are refreshed with the OAuth refresh_token (not the access token).
    refresh_uses_refresh_token = True

    def __init__(self) -> None:
        self.settings = get_settings()

    def get_authorize_url(self, state: str) -> str:
        params = {
            "client_id": self.settings.youtube_client_id,
            "redirect_uri": self.settings.redirect_uri("youtube"),
            "response_type": "code",
            "scope": " ".join(YOUTUBE_SCOPES),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"

    async def connect(self, code: str) -> OAuthTokenSet:
        if self.settings.platform_sandbox_mode:
            return self._sandbox_token_set()

        async with httpx.AsyncClient(timeout=30) as client:
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": self.settings.youtube_client_id,
                    "client_secret": self.settings.youtube_client_secret,
                    "redirect_uri": self.settings.redirect_uri("youtube"),
                    "grant_type": "authorization_code",
                },
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()
            access_token = token_data["access_token"]
            expires_in = token_data.get("expires_in", 3600)

            channel_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/channels",
                params={"part": "snippet", "mine": "true"},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            channel_resp.raise_for_status()
            items = channel_resp.json().get("items", [])
            if not items:
                raise ValueError("No YouTube channel found for this Google account.")

            channel = items[0]
            snippet = channel["snippet"]

            return OAuthTokenSet(
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                expires_at=datetime.now(timezone.utc) + timedelta(seconds=expires_in),
                account_id=channel["id"],
                account_name=snippet.get("title", "YouTube Channel"),
                avatar_url=snippet.get("thumbnails", {}).get("default", {}).get("url"),
                scopes=YOUTUBE_SCOPES,
            )

    async def disconnect(self, access_token: str, account_id: str) -> None:
        if self.settings.platform_sandbox_mode:
            return
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                "https://oauth2.googleapis.com/revoke", params={"token": access_token}
            )

    async def validate_token(self, access_token: str) -> bool:
        if self.settings.platform_sandbox_mode:
            return True
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/tokeninfo",
                params={"access_token": access_token},
            )
            return resp.status_code == 200

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, datetime]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "refresh_token": refresh_token,
                    "client_id": self.settings.youtube_client_id,
                    "client_secret": self.settings.youtube_client_secret,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 3600))
            return data["access_token"], expires_at

    # --- YouTube Studio resumable upload (Task 2) -----------------------------
    # These three methods implement Google's resumable upload protocol with httpx:
    #   1. create_resumable_session  -> POST uploadType=resumable -> returns Location URI
    #   2. query_upload_status       -> PUT Content-Range: bytes */N -> resume offset or id
    #   3. put_upload_chunk          -> PUT Content-Range: bytes A-B/N -> 308 or 200/201
    # The video bytes are never held in memory as a whole -- callers hand chunks to
    # put_upload_chunk one at a time (see app/services/youtube_upload_service.py).

    async def create_resumable_session(
        self,
        access_token: str,
        metadata: dict,
        total_size: int | None = None,
        content_type: str = "video/*",
    ) -> str:
        """Create a YouTube resumable upload session and return its upload URI. The video
        bytes are NOT sent here -- only the snippet/status metadata; bytes go to the
        returned session URI via put_upload_chunk."""
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
            "X-Upload-Content-Type": content_type,
        }
        if total_size is not None:
            headers["X-Upload-Content-Length"] = str(total_size)

        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            resp = await client.post(
                YOUTUBE_UPLOAD_URL,
                params={"uploadType": "resumable", "part": "snippet,status"},
                content=json.dumps(metadata),
                headers=headers,
            )
            if resp.status_code not in (200, 201):
                raise YouTubeUploadError(
                    self.extract_google_error(resp), status_code=resp.status_code
                )
            location = resp.headers.get("Location")
            if not location:
                raise YouTubeUploadError(
                    "YouTube did not return a resumable upload session URI."
                )
            return location

    async def query_upload_status(
        self, session_uri: str, total_size: int
    ) -> tuple[int, str | None]:
        """Ask YouTube how many bytes it has already received for this session. Returns
        (next_byte_to_send, video_id|None) -- next_byte_to_send is 0 for a fresh session,
        and video_id is set if the upload already completed. Raises YouTubeUploadError on
        a dead/expired session (404) or any other failure."""
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0)) as client:
            resp = await client.put(
                session_uri,
                headers={
                    "Content-Length": "0",
                    "Content-Range": f"bytes */{total_size}",
                },
            )
        if resp.status_code in (200, 201):
            return total_size, self.parse_video_id(resp.json())
        if resp.status_code == 308:
            range_header = resp.headers.get("Range", "")
            if range_header.startswith("bytes=0-"):
                return int(range_header.split("-")[1]) + 1, None
            return 0, None
        if resp.status_code == 404:
            raise YouTubeUploadError(
                "The YouTube upload session is invalid or expired. Please restart the upload.",
                status_code=404,
            )
        raise YouTubeUploadError(self.extract_google_error(resp), status_code=resp.status_code)

    async def put_upload_chunk(
        self, session_uri: str, chunk: bytes, start: int, total_size: int
    ) -> httpx.Response:
        """Send one contiguous chunk of video bytes to the resumable session. Returns the
        raw response; the caller interprets it (308 = accepted, more chunks to follow;
        200/201 = complete with a video id in the JSON body; anything else = failure)."""
        end = start + len(chunk) - 1
        async with httpx.AsyncClient(timeout=httpx.Timeout(600.0)) as client:
            return await client.put(
                session_uri,
                content=chunk,
                headers={
                    "Content-Length": str(len(chunk)),
                    "Content-Range": f"bytes {start}-{end}/{total_size}",
                },
            )

    @staticmethod
    def extract_google_error(resp: httpx.Response) -> str:
        """A human-safe error message from a Google API error response. Never includes
        tokens or raw headers -- just the API's own message and status code."""
        try:
            data = resp.json()
        except Exception:  # noqa: BLE001 - non-JSON error body
            return f"YouTube request failed (HTTP {resp.status_code})."
        error = data.get("error", {})
        message = error.get("message") if isinstance(error, dict) else None
        code = error.get("code") if isinstance(error, dict) else None
        if message:
            return f"YouTube API error {code}: {message}".strip()
        return f"YouTube request failed (HTTP {resp.status_code})."

    @staticmethod
    def parse_video_id(data: dict) -> str:
        """Extract the video id from a completed upload response (empty-safe for tests)."""
        return data.get("id") or ""

    async def set_thumbnail(
        self,
        access_token: str,
        video_id: str,
        image_bytes: bytes,
        content_type: str = "image/jpeg",
    ) -> None:
        """Upload a thumbnail for an existing video via YouTube's thumbnails/set
        endpoint. The image is sent as a single-part POST body; no JSON metadata."""
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://www.googleapis.com/upload/youtube/v3/thumbnails/set",
                params={"videoId": video_id},
                content=image_bytes,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": content_type,
                },
            )
            if resp.status_code >= 400:
                raise YouTubeUploadError(
                    self.extract_google_error(resp), status_code=resp.status_code
                )

    async def upload_media(self, access_token: str, account_id: str, media_url: str, media_type: str) -> str:
        # YouTube has no separate "upload then reference" step for videos -- the binary is
        # uploaded directly as part of publish_post via multipart/resumable upload.
        return media_url

    # --- Playlists (Task: real playlist support) -----------------------------------
    # YouTube Data API v3 endpoints for managing the authenticated channel's playlists.
    # Every method is a thin, error-mapping wrapper over a Google endpoint; the business
    # rules (ownership, sandboxing, best-effort batch) live in youtube_playlist_service.
    # Errors are surfaced as YouTubeUploadError with Google's HTTP status so the API layer
    # can map them identically to the upload endpoints.

    @staticmethod
    def _normalize_playlist(item: dict) -> dict:
        """Flatten a youtube#playlist resource into the shape the API/frontend consume:
        playlist_id, title, description, privacy_status, item_count, thumbnail_url."""
        snippet = item.get("snippet", {}) or {}
        status = item.get("status", {}) or {}
        content_details = item.get("contentDetails", {}) or {}
        thumbnails = snippet.get("thumbnails", {}) or {}
        default_thumb = thumbnails.get("medium") or thumbnails.get("default") or {}
        return {
            "playlist_id": item.get("id", ""),
            "title": snippet.get("title", ""),
            "description": snippet.get("description", ""),
            "privacy_status": status.get("privacyStatus"),
            "item_count": content_details.get("itemCount", 0),
            "thumbnail_url": default_thumb.get("url"),
        }

    async def list_playlists(self, access_token: str) -> list[dict]:
        """List the authenticated channel's own playlists (mine=true). Requires the
        youtube.readonly (read) or youtube.force-ssl (read+write) scope."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/playlists",
                params={"part": "snippet,status,contentDetails", "mine": "true", "maxResults": 50},
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code >= 400:
                raise YouTubeUploadError(
                    self.extract_google_error(resp), status_code=resp.status_code
                )
            items = resp.json().get("items", [])
            return [self._normalize_playlist(item) for item in items]

    async def create_playlist(
        self,
        access_token: str,
        title: str,
        description: str | None,
        privacy_status: str,
    ) -> dict:
        """Create a playlist on the authenticated channel (playlists.insert). Requires the
        youtube / youtube.force-ssl scope."""
        metadata = {
            "snippet": {"title": title, "description": description or ""},
            "status": {"privacyStatus": privacy_status},
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://www.googleapis.com/youtube/v3/playlists",
                params={"part": "snippet,status"},
                json=metadata,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code >= 400:
                raise YouTubeUploadError(
                    self.extract_google_error(resp), status_code=resp.status_code
                )
            return self._normalize_playlist(resp.json())

    async def add_video_to_playlist(
        self, access_token: str, playlist_id: str, video_id: str
    ) -> dict:
        """Add an already-uploaded video to a playlist (playlistItems.insert). The video
        is never re-uploaded -- the bytes are already on YouTube; this only records the
        playlist association. Requires the youtube / youtube.force-ssl scope."""
        item = {
            "snippet": {
                "playlistId": playlist_id,
                "resourceId": {"kind": "youtube#video", "videoId": video_id},
            }
        }
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://www.googleapis.com/youtube/v3/playlistItems",
                params={"part": "snippet"},
                json=item,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if resp.status_code >= 400:
                raise YouTubeUploadError(
                    self.extract_google_error(resp), status_code=resp.status_code
                )
            data = resp.json()
            return {"playlist_id": playlist_id, "item_id": data.get("id", "")}

    async def publish_post(
        self, access_token: str, account_id: str, content: PublishContent
    ) -> PublishResult:
        if self.settings.platform_sandbox_mode:
            return PublishResult(success=True, platform_post_id=f"sandbox_yt_{uuid.uuid4().hex[:11]}")

        if content.media_type != "video" or not content.media_url:
            return PublishResult(
                success=False, error_message="YouTube publishing requires a video file."
            )

        try:
            async with httpx.AsyncClient(timeout=300) as client:
                video_resp = await client.get(content.media_url)
                video_resp.raise_for_status()
                video_bytes = video_resp.content

                title = (content.text[:95] + "...") if len(content.text) > 100 else (content.text or "Untitled")
                metadata = {
                    "snippet": {"title": title, "description": content.text},
                    "status": {"privacyStatus": "public"},
                }

                boundary = f"boundary_{uuid.uuid4().hex}"
                body = (
                    f"--{boundary}\r\n"
                    "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                    f"{json.dumps(metadata)}\r\n"
                    f"--{boundary}\r\n"
                    "Content-Type: video/*\r\n\r\n"
                ).encode() + video_bytes + f"\r\n--{boundary}--".encode()

                upload_resp = await client.post(
                    "https://www.googleapis.com/upload/youtube/v3/videos",
                    params={"uploadType": "multipart", "part": "snippet,status"},
                    content=body,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "Content-Type": f"multipart/related; boundary={boundary}",
                    },
                )
                data = upload_resp.json()
                if upload_resp.status_code >= 400:
                    error = data.get("error", {}).get("message", "YouTube upload failed")
                    return PublishResult(success=False, error_message=error, raw_response=data)

                return PublishResult(success=True, platform_post_id=data.get("id"), raw_response=data)
        except httpx.HTTPError as exc:
            return PublishResult(success=False, error_message=str(exc))

    def _sandbox_token_set(self) -> OAuthTokenSet:
        return OAuthTokenSet(
            access_token=f"sandbox_yt_token_{uuid.uuid4().hex[:8]}",
            refresh_token=f"sandbox_yt_refresh_{uuid.uuid4().hex[:8]}",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            account_id=f"sandbox_yt_channel_{uuid.uuid4().hex[:8]}",
            account_name="My YouTube Channel (Sandbox)",
            avatar_url=None,
        )
