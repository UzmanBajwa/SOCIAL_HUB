from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.services.base import OAuthTokenSet, PageCandidate, PlatformService, PublishContent, PublishResult
from app.services.instagram_media import InstagramImageProcessingError, prepare_instagram_image

# Instagram API with Instagram Login: the user authorizes directly with their Instagram
# account -- no Facebook Page required. This uses its own Meta app (separate App ID/
# Secret from Facebook) and its own endpoints (instagram.com / graph.instagram.com), not
# the Facebook Graph API. See docs/meta-oauth-setup.md.
INSTAGRAM_SCOPES = [
    "instagram_business_basic",
    "instagram_business_content_publish",
]

# Long-lived tokens are valid 60 days and refreshable any time after the first 24 hours.
# See account_service.TOKEN_REFRESH_WINDOW for how proactively the scheduler refreshes
# them (app/scheduler/jobs.py's refresh_expiring_tokens job).


class InstagramService(PlatformService):
    platform_name = "instagram"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.graph_version = self.settings.instagram_graph_version
        self.graph_base_url = f"https://graph.instagram.com/{self.graph_version}"

    def get_authorize_url(self, state: str) -> str:
        params = {
            "client_id": self.settings.instagram_app_id,
            "redirect_uri": self.settings.redirect_uri("instagram"),
            "scope": ",".join(INSTAGRAM_SCOPES),
            "response_type": "code",
            "state": state,
        }
        return f"https://www.instagram.com/oauth/authorize?{urlencode(params)}"

    async def fetch_page_candidates(self, code: str) -> list[PageCandidate]:
        """Always returns exactly one candidate -- the Instagram Business account itself
        (there's no Page to choose between with direct Instagram Login). Kept as a list
        so this platform reuses the exact same start_page_selection/finalize_page_selection
        flow as Facebook without any special-casing in account_service or the frontend."""
        if self.settings.platform_sandbox_mode:
            return self._sandbox_pages()

        async with httpx.AsyncClient(timeout=30) as client:
            token_resp = await client.post(
                "https://api.instagram.com/oauth/access_token",
                data={
                    "client_id": self.settings.instagram_app_id,
                    "client_secret": self.settings.instagram_app_secret,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.settings.redirect_uri("instagram"),
                    "code": code,
                },
            )
            token_resp.raise_for_status()
            short_lived_token = token_resp.json()["access_token"]

            long_lived_resp = await client.get(
                "https://graph.instagram.com/access_token",
                params={
                    "grant_type": "ig_exchange_token",
                    "client_secret": self.settings.instagram_app_secret,
                    "access_token": short_lived_token,
                },
            )
            long_lived_resp.raise_for_status()
            long_lived_data = long_lived_resp.json()
            long_lived_token = long_lived_data["access_token"]
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=long_lived_data.get("expires_in", 5184000))

            profile_resp = await client.get(
                f"{self.graph_base_url}/me",
                params={
                    "fields": "user_id,username,name,account_type,profile_picture_url",
                    "access_token": long_lived_token,
                },
            )
            profile_resp.raise_for_status()
            profile = profile_resp.json()

            return [
                PageCandidate(
                    id=profile.get("user_id", profile.get("id")),
                    name=profile.get("name") or profile.get("username"),
                    username=profile.get("username"),
                    access_token=long_lived_token,
                    avatar_url=profile.get("profile_picture_url"),
                    scopes=INSTAGRAM_SCOPES,
                    extra_data={"account_type": profile.get("account_type")},
                    expires_at=expires_at,
                )
            ]

    async def connect(self, code: str) -> OAuthTokenSet:
        """Legacy single-shot connect, kept so this class satisfies PlatformService.
        The real flow is fetch_page_candidates -> account_service.finalize_page_selection."""
        candidates = await self.fetch_page_candidates(code)
        account = candidates[0]
        return OAuthTokenSet(
            access_token=account.access_token,
            refresh_token=None,
            expires_at=account.expires_at,
            account_id=account.id,
            account_name=account.name,
            avatar_url=account.avatar_url,
            account_username=account.username,
            scopes=account.scopes,
            extra_data=account.extra_data,
        )

    async def refresh_access_token(self, access_token: str) -> tuple[str, datetime]:
        """Refreshes a long-lived token that's at least 24h old but not yet expired.
        Called by the scheduler's refresh job (see app/scheduler/jobs.py), not at publish
        time -- Instagram tokens don't auto-renew on use the way Facebook Page tokens do."""
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                "https://graph.instagram.com/refresh_access_token",
                params={"grant_type": "ig_refresh_token", "access_token": access_token},
            )
            resp.raise_for_status()
            data = resp.json()
            expires_at = datetime.now(timezone.utc) + timedelta(seconds=data.get("expires_in", 5184000))
            return data["access_token"], expires_at

    async def disconnect(self, access_token: str, account_id: str) -> None:
        return None  # No server-side revoke endpoint for Instagram Login tokens.

    async def validate_token(self, access_token: str) -> bool:
        if self.settings.platform_sandbox_mode:
            return True
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{self.graph_base_url}/me", params={"access_token": access_token})
            return resp.status_code == 200

    async def upload_media(self, access_token: str, account_id: str, media_url: str, media_type: str) -> str:
        # Instagram requires a two-step "container" publish; the container id itself acts
        # as the media handle consumed by publish_post.
        return media_url

    async def publish_post(
        self, access_token: str, account_id: str, content: PublishContent
    ) -> PublishResult:
        if self.settings.platform_sandbox_mode:
            return PublishResult(success=True, platform_post_id=f"sandbox_ig_{uuid.uuid4().hex[:12]}")

        if not content.media_url:
            return PublishResult(success=False, error_message="Instagram requires an image or video.")

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                container_payload = {
                    "access_token": access_token,
                    "caption": content.text,
                }
                if content.media_type == "video":
                    container_payload["media_type"] = "REELS"
                    container_payload["video_url"] = content.media_url
                    container_payload["share_to_feed"] = "true" if content.share_to_feed else "false"
                    if content.thumbnail_url:
                        container_payload["cover_url"] = content.thumbnail_url
                else:
                    try:
                        ig_media_url = await prepare_instagram_image(content.media_url)
                    except InstagramImageProcessingError as exc:
                        return PublishResult(success=False, error_message=str(exc))
                    container_payload["image_url"] = ig_media_url

                create_resp = await client.post(
                    f"{self.graph_base_url}/{account_id}/media", data=container_payload
                )
                create_data = create_resp.json()
                if create_resp.status_code >= 400:
                    error = create_data.get("error", {}).get("message", "Failed to create IG media container")
                    return PublishResult(success=False, error_message=error, raw_response=create_data)

                creation_id = create_data["id"]

                # Both image and video containers process asynchronously -- Instagram
                # returns "Media ID is not available" from media_publish if called before
                # a container (of either type) reaches FINISHED. Images are usually fast
                # but not instant, so this poll isn't video-only.
                max_attempts = 20 if content.media_type == "video" else 10
                for _ in range(max_attempts):
                    status_resp = await client.get(
                        f"{self.graph_base_url}/{creation_id}",
                        params={"access_token": access_token, "fields": "status_code,status"},
                    )
                    status_data = status_resp.json()
                    status_code = status_data.get("status_code")
                    if status_code == "FINISHED":
                        break
                    if status_code in ("ERROR", "EXPIRED"):
                        detail = status_data.get("status") or "No further detail returned by Instagram."
                        return PublishResult(
                            success=False,
                            error_message=f"Instagram failed to process the media: {detail}",
                            raw_response=status_data,
                        )
                    await asyncio.sleep(3)
                else:
                    return PublishResult(
                        success=False,
                        error_message="Instagram is still processing the media; try again shortly.",
                    )

                publish_resp = await client.post(
                    f"{self.graph_base_url}/{account_id}/media_publish",
                    data={"access_token": access_token, "creation_id": creation_id},
                )
                publish_data = publish_resp.json()
                if publish_resp.status_code >= 400:
                    error = publish_data.get("error", {}).get("message", "Failed to publish IG media")
                    return PublishResult(success=False, error_message=error, raw_response=publish_data)

                return PublishResult(
                    success=True, platform_post_id=publish_data.get("id"), raw_response=publish_data
                )
        except httpx.HTTPError as exc:
            return PublishResult(success=False, error_message=str(exc))

    def _sandbox_pages(self) -> list[PageCandidate]:
        return [
            PageCandidate(
                id=f"sandbox_ig_user_{uuid.uuid4().hex[:8]}",
                name="famete11",
                username="famete11",
                access_token=f"sandbox_ig_token_{uuid.uuid4().hex[:8]}",
                scopes=INSTAGRAM_SCOPES,
                extra_data={"account_type": "BUSINESS"},
                expires_at=datetime.now(timezone.utc) + timedelta(days=60),
            )
        ]
