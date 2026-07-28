from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.services.base import OAuthTokenSet, PlatformService, PublishContent, PublishResult

YOUTUBE_SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
]


class YouTubeService(PlatformService):
    platform_name = "youtube"

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

    async def upload_media(self, access_token: str, account_id: str, media_url: str, media_type: str) -> str:
        # YouTube has no separate "upload then reference" step for videos -- the binary is
        # uploaded directly as part of publish_post via multipart/resumable upload.
        return media_url

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
