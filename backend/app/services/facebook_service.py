from __future__ import annotations

import uuid
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.services import meta_shared
from app.services.base import OAuthTokenSet, PageCandidate, PlatformService, PublishContent, PublishResult

FACEBOOK_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    # Required for /me/accounts to return Pages owned via a Business Manager portfolio
    # (as opposed to pages a user administers directly on their personal profile) -- without
    # it, the call silently returns an empty list instead of erroring.
    "business_management",
]


class FacebookService(PlatformService):
    platform_name = "facebook"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.graph_version = self.settings.facebook_graph_version
        self.base_url = f"https://graph.facebook.com/{self.graph_version}"

    def get_authorize_url(self, state: str) -> str:
        params = {
            "client_id": self.settings.facebook_app_id,
            "redirect_uri": self.settings.redirect_uri("facebook"),
            "state": state,
            "scope": ",".join(FACEBOOK_SCOPES),
            "response_type": "code",
        }
        return f"https://www.facebook.com/{self.graph_version}/dialog/oauth?{urlencode(params)}"

    async def fetch_page_candidates(self, code: str) -> list[PageCandidate]:
        """Exchanges the OAuth code for a long-lived user token, then returns every
        Facebook Page the user administers so they can pick which one to connect."""
        if self.settings.platform_sandbox_mode:
            return self._sandbox_pages()

        async with httpx.AsyncClient(timeout=30) as client:
            short_lived_token = await meta_shared.exchange_code_for_user_token(
                client,
                self.base_url,
                self.settings.facebook_app_id,
                self.settings.facebook_app_secret,
                self.settings.redirect_uri("facebook"),
                code,
            )
            long_lived_token = await meta_shared.exchange_for_long_lived_token(
                client, self.base_url, self.settings.facebook_app_id, self.settings.facebook_app_secret, short_lived_token
            )
            pages = await meta_shared.fetch_pages(client, self.base_url, long_lived_token)

            if not pages:
                raise ValueError("No Facebook Pages found for this account. Publishing requires a Page you admin.")

            return [
                PageCandidate(
                    id=page["id"],
                    name=page["name"],
                    access_token=page["access_token"],
                    avatar_url=page.get("picture", {}).get("data", {}).get("url"),
                    category=page.get("category"),
                    scopes=page.get("tasks", []),
                )
                for page in pages
            ]

    async def connect(self, code: str) -> OAuthTokenSet:
        """Legacy single-shot connect (auto-picks the first Page). Superseded by the
        fetch_page_candidates -> user selection -> account_service.finalize flow for
        Facebook/Instagram, but kept so this class still satisfies PlatformService."""
        candidates = await self.fetch_page_candidates(code)
        page = candidates[0]
        return OAuthTokenSet(
            access_token=page.access_token,
            refresh_token=None,
            expires_at=None,
            account_id=page.id,
            account_name=page.name,
            avatar_url=page.avatar_url,
            scopes=page.scopes,
            extra_data={"category": page.category},
        )

    async def disconnect(self, access_token: str, account_id: str) -> None:
        if self.settings.platform_sandbox_mode:
            return
        async with httpx.AsyncClient(timeout=30) as client:
            await client.delete(
                f"{self.base_url}/{account_id}/permissions", params={"access_token": access_token}
            )

    async def validate_token(self, access_token: str) -> bool:
        if self.settings.platform_sandbox_mode:
            return True
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{self.base_url}/me", params={"access_token": access_token})
            return resp.status_code == 200

    async def upload_media(self, access_token: str, account_id: str, media_url: str, media_type: str) -> str:
        # Facebook accepts a public media URL directly at publish time, so no separate
        # upload step is required -- we just pass the URL through.
        return media_url

    async def publish_post(
        self, access_token: str, account_id: str, content: PublishContent
    ) -> PublishResult:
        if self.settings.platform_sandbox_mode:
            return PublishResult(success=True, platform_post_id=f"sandbox_fb_{uuid.uuid4().hex[:12]}")

        try:
            async with httpx.AsyncClient(timeout=60) as client:
                if content.media_type == "video" and content.media_url:
                    endpoint = f"{self.base_url}/{account_id}/videos"
                    payload = {
                        "access_token": access_token,
                        "description": content.text,
                        "file_url": content.media_url,
                    }
                elif content.media_type == "image" and content.media_url:
                    endpoint = f"{self.base_url}/{account_id}/photos"
                    payload = {
                        "access_token": access_token,
                        "caption": content.text,
                        "url": content.media_url,
                    }
                else:
                    endpoint = f"{self.base_url}/{account_id}/feed"
                    payload = {"access_token": access_token, "message": content.text}

                resp = await client.post(endpoint, data=payload)
                data = resp.json()
                if resp.status_code >= 400:
                    error = data.get("error", {}).get("message", "Unknown Facebook API error")
                    return PublishResult(success=False, error_message=error, raw_response=data)

                post_id = data.get("post_id") or data.get("id")
                return PublishResult(success=True, platform_post_id=post_id, raw_response=data)
        except httpx.HTTPError as exc:
            return PublishResult(success=False, error_message=str(exc))

    def _sandbox_pages(self) -> list[PageCandidate]:
        return [
            PageCandidate(
                id=f"sandbox_fb_page_{uuid.uuid4().hex[:8]}",
                name="FAME TE",
                access_token=f"sandbox_fb_token_{uuid.uuid4().hex[:8]}",
                category="Media/News Company",
                scopes=FACEBOOK_SCOPES,
            ),
            PageCandidate(
                id=f"sandbox_fb_page_{uuid.uuid4().hex[:8]}",
                name="FAME TE Community",
                access_token=f"sandbox_fb_token_{uuid.uuid4().hex[:8]}",
                category="Community",
                scopes=FACEBOOK_SCOPES,
            ),
        ]
