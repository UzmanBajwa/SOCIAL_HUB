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
                    extra_data={
                        "whatsapp_connection_status": "connected" if page.get("whatsapp_number") else "not_connected",
                        "whatsapp_number": page.get("whatsapp_number"),
                    },
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
            extra_data={"category": page.category, **page.extra_data},
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

    async def search_pages(self, access_token: str, query: str) -> list[dict]:
        """Backs the @mention autocomplete. Returns [{"id", "name", "avatar_url"}, ...]."""
        if not query.strip():
            return []
        if self.settings.platform_sandbox_mode:
            return self._sandbox_page_search(query)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/pages/search",
                params={"q": query, "access_token": access_token, "fields": "id,name,picture"},
            )
            resp.raise_for_status()
            return [
                {
                    "id": p["id"],
                    "name": p["name"],
                    "avatar_url": p.get("picture", {}).get("data", {}).get("url"),
                }
                for p in resp.json().get("data", [])
            ]

    async def search_places(self, access_token: str, query: str) -> list[dict]:
        """Backs the location picker. Returns [{"id", "name"}, ...]."""
        if not query.strip():
            return []
        if self.settings.platform_sandbox_mode:
            return self._sandbox_place_search(query)

        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.base_url}/search",
                params={"type": "place", "q": query, "access_token": access_token, "fields": "id,name,location"},
            )
            resp.raise_for_status()
            return [{"id": p["id"], "name": p["name"]} for p in resp.json().get("data", [])]

    async def publish_post(
        self, access_token: str, account_id: str, content: PublishContent
    ) -> PublishResult:
        if self.settings.platform_sandbox_mode:
            return PublishResult(success=True, platform_post_id=f"sandbox_fb_{uuid.uuid4().hex[:12]}")

        message = self._apply_mentions(content.text, content.mentions)
        items = content.media_items or (
            [{"url": content.media_url, "type": content.media_type}] if content.media_url else []
        )

        try:
            async with httpx.AsyncClient(timeout=120) as client:
                if content.publish_as_reel and content.media_type == "video" and content.media_url:
                    result = await self._publish_reel(client, access_token, account_id, content, message)
                elif len(items) > 1:
                    result = await self._publish_carousel(client, access_token, account_id, items, message, content)
                else:
                    result = await self._publish_single(client, access_token, account_id, message, content)

                if result.success and result.platform_post_id and content.is_pinned:
                    await client.post(
                        f"{self.base_url}/{result.platform_post_id}",
                        data={"access_token": access_token, "is_pinned": "true"},
                    )

                return result
        except httpx.HTTPError as exc:
            return PublishResult(success=False, error_message=str(exc))

    async def _publish_single(
        self, client: httpx.AsyncClient, access_token: str, account_id: str, message: str, content: PublishContent
    ) -> PublishResult:
        if content.media_type == "video" and content.media_url:
            endpoint = f"{self.base_url}/{account_id}/videos"
            payload = {"access_token": access_token, "description": message, "file_url": content.media_url}
        elif content.media_type == "image" and content.media_url:
            endpoint = f"{self.base_url}/{account_id}/photos"
            payload = {"access_token": access_token, "caption": message, "url": content.media_url}
        else:
            endpoint = f"{self.base_url}/{account_id}/feed"
            payload = {"access_token": access_token, "message": message}

        if content.location:
            payload["place"] = content.location["id"]

        resp = await client.post(endpoint, data=payload)
        data = resp.json()
        if resp.status_code >= 400:
            error = data.get("error", {}).get("message", "Unknown Facebook API error")
            return PublishResult(success=False, error_message=error, raw_response=data)

        post_id = data.get("post_id") or data.get("id")
        return PublishResult(success=True, platform_post_id=post_id, raw_response=data)

    async def _publish_carousel(
        self,
        client: httpx.AsyncClient,
        access_token: str,
        account_id: str,
        items: list[dict],
        message: str,
        content: PublishContent,
    ) -> PublishResult:
        """Facebook multi-photo posts: upload each photo unpublished, then attach all of
        them to one feed post via attached_media. Video isn't supported in a carousel by
        the Graph API, so mixed image+video selections are rejected with a clear error
        rather than silently dropping the video."""
        if any(item.get("type") != "image" for item in items):
            return PublishResult(success=False, error_message="Facebook carousels support images only, not video.")

        photo_ids: list[str] = []
        for item in items:
            resp = await client.post(
                f"{self.base_url}/{account_id}/photos",
                data={"access_token": access_token, "url": item["url"], "published": "false"},
            )
            data = resp.json()
            if resp.status_code >= 400:
                error = data.get("error", {}).get("message", "Failed to upload a carousel image")
                return PublishResult(success=False, error_message=error, raw_response=data)
            photo_ids.append(data["id"])

        payload = {
            "access_token": access_token,
            "message": message,
            **{f"attached_media[{i}]": f'{{"media_fbid":"{pid}"}}' for i, pid in enumerate(photo_ids)},
        }
        if content.location:
            payload["place"] = content.location["id"]

        resp = await client.post(f"{self.base_url}/{account_id}/feed", data=payload)
        data = resp.json()
        if resp.status_code >= 400:
            error = data.get("error", {}).get("message", "Failed to publish carousel post")
            return PublishResult(success=False, error_message=error, raw_response=data)

        return PublishResult(success=True, platform_post_id=data.get("id"), raw_response=data)

    async def _publish_reel(
        self,
        client: httpx.AsyncClient,
        access_token: str,
        account_id: str,
        content: PublishContent,
        message: str,
    ) -> PublishResult:
        """Facebook Reels use a distinct 3-phase upload: start (get an upload session),
        transfer the video, then finish (publish). Same file_url "pull" transfer style
        the rest of this codebase already relies on for regular video posts."""
        start_resp = await client.post(
            f"{self.base_url}/{account_id}/video_reels",
            data={"access_token": access_token, "upload_phase": "start"},
        )
        start_data = start_resp.json()
        if start_resp.status_code >= 400:
            error = start_data.get("error", {}).get("message", "Failed to start Reel upload session")
            return PublishResult(success=False, error_message=error, raw_response=start_data)

        video_id = start_data["video_id"]
        upload_url = start_data["upload_url"]

        transfer_resp = await client.post(
            upload_url,
            headers={"Authorization": f"OAuth {access_token}", "file_url": content.media_url or ""},
        )
        if transfer_resp.status_code >= 400:
            return PublishResult(success=False, error_message="Failed to transfer Reel video to Facebook.")

        finish_payload = {
            "access_token": access_token,
            "upload_phase": "finish",
            "video_id": video_id,
            "video_state": "PUBLISHED",
            "description": message,
        }
        if content.thumbnail_url:
            finish_payload["thumb_url"] = content.thumbnail_url

        finish_resp = await client.post(f"{self.base_url}/{account_id}/video_reels", data=finish_payload)
        finish_data = finish_resp.json()
        if finish_resp.status_code >= 400:
            error = finish_data.get("error", {}).get("message", "Failed to publish Reel")
            return PublishResult(success=False, error_message=error, raw_response=finish_data)

        return PublishResult(success=True, platform_post_id=video_id, raw_response=finish_data)

    def _apply_mentions(self, text: str, mentions: list[dict]) -> str:
        """The composer inserts readable `@[Page Name]` tokens into the visible text when
        a user picks a mention; Facebook's actual tagging syntax is `@[page_id]`. Swap
        each token for its real ID right before publishing."""
        result = text
        for mention in mentions:
            result = result.replace(f"@[{mention['name']}]", f"@[{mention['id']}]")
        return result

    def _sandbox_pages(self) -> list[PageCandidate]:
        return [
            PageCandidate(
                id=f"sandbox_fb_page_{uuid.uuid4().hex[:8]}",
                name="FAME TE",
                access_token=f"sandbox_fb_token_{uuid.uuid4().hex[:8]}",
                category="Media/News Company",
                scopes=FACEBOOK_SCOPES,
                extra_data={"whatsapp_connection_status": "connected", "whatsapp_number": "+1 555 0100"},
            ),
            PageCandidate(
                id=f"sandbox_fb_page_{uuid.uuid4().hex[:8]}",
                name="FAME TE Community",
                access_token=f"sandbox_fb_token_{uuid.uuid4().hex[:8]}",
                category="Community",
                scopes=FACEBOOK_SCOPES,
                extra_data={"whatsapp_connection_status": "not_connected", "whatsapp_number": None},
            ),
        ]

    def _sandbox_page_search(self, query: str) -> list[dict]:
        candidates = [
            {"id": "sandbox_page_1", "name": "First Aid Made Easy", "avatar_url": None},
            {"id": "sandbox_page_2", "name": "WHO", "avatar_url": None},
            {"id": "sandbox_page_3", "name": "AHA", "avatar_url": None},
        ]
        return [c for c in candidates if query.lower() in c["name"].lower()]

    def _sandbox_place_search(self, query: str) -> list[dict]:
        candidates = [
            {"id": "sandbox_place_1", "name": f"{query.title()} Medical Center"},
            {"id": "sandbox_place_2", "name": f"{query.title()} Convention Hall"},
        ]
        return candidates
