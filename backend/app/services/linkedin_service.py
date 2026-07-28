from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.services.base import OAuthTokenSet, PlatformService, PublishContent, PublishResult

LINKEDIN_SCOPES = ["openid", "profile", "w_member_social", "email"]


class LinkedInService(PlatformService):
    platform_name = "linkedin"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = "https://api.linkedin.com/v2"

    def get_authorize_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.settings.linkedin_client_id,
            "redirect_uri": self.settings.redirect_uri("linkedin"),
            "state": state,
            "scope": " ".join(LINKEDIN_SCOPES),
        }
        return f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"

    async def connect(self, code: str) -> OAuthTokenSet:
        if self.settings.platform_sandbox_mode:
            return self._sandbox_token_set()

        async with httpx.AsyncClient(timeout=30) as client:
            token_resp = await client.post(
                "https://www.linkedin.com/oauth/v2/accessToken",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.settings.redirect_uri("linkedin"),
                    "client_id": self.settings.linkedin_client_id,
                    "client_secret": self.settings.linkedin_client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()
            access_token = token_data["access_token"]
            expires_in = token_data.get("expires_in", 3600)

            profile_resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            profile_resp.raise_for_status()
            profile = profile_resp.json()

            return OAuthTokenSet(
                access_token=access_token,
                refresh_token=token_data.get("refresh_token"),
                expires_at=datetime.now(timezone.utc) + timedelta(seconds=expires_in),
                account_id=profile["sub"],
                account_name=profile.get("name", "LinkedIn Member"),
                avatar_url=profile.get("picture"),
            )

    async def disconnect(self, access_token: str, account_id: str) -> None:
        return None  # LinkedIn has no token revoke endpoint for member auth flows.

    async def validate_token(self, access_token: str) -> bool:
        if self.settings.platform_sandbox_mode:
            return True
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                "https://api.linkedin.com/v2/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            return resp.status_code == 200

    async def upload_media(self, access_token: str, account_id: str, media_url: str, media_type: str) -> str:
        if self.settings.platform_sandbox_mode:
            return f"urn:li:digitalmediaAsset:sandbox_{uuid.uuid4().hex[:10]}"

        recipe = (
            "urn:li:digitalmediaRecipe:feedshare-video"
            if media_type == "video"
            else "urn:li:digitalmediaRecipe:feedshare-image"
        )
        author_urn = f"urn:li:person:{account_id}"

        async with httpx.AsyncClient(timeout=60) as client:
            register_resp = await client.post(
                f"{self.base_url}/assets?action=registerUpload",
                json={
                    "registerUploadRequest": {
                        "recipes": [recipe],
                        "owner": author_urn,
                        "serviceRelationships": [
                            {
                                "relationshipType": "OWNER",
                                "identifier": "urn:li:userGeneratedContent",
                            }
                        ],
                    }
                },
                headers={"Authorization": f"Bearer {access_token}"},
            )
            register_resp.raise_for_status()
            register_data = register_resp.json()["value"]
            upload_url = register_data["uploadMechanism"][
                "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
            ]["uploadUrl"]
            asset_urn = register_data["asset"]

            media_bytes_resp = await client.get(media_url)
            media_bytes_resp.raise_for_status()

            await client.put(
                upload_url,
                content=media_bytes_resp.content,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            return asset_urn

    async def publish_post(
        self, access_token: str, account_id: str, content: PublishContent
    ) -> PublishResult:
        if self.settings.platform_sandbox_mode:
            return PublishResult(success=True, platform_post_id=f"sandbox_li_{uuid.uuid4().hex[:12]}")

        author_urn = f"urn:li:person:{account_id}"
        share_content: dict = {
            "shareCommentary": {"text": content.text},
            "shareMediaCategory": "NONE",
        }

        try:
            if content.media_url:
                asset_urn = await self.upload_media(
                    access_token, account_id, content.media_url, content.media_type or "image"
                )
                share_content["shareMediaCategory"] = (
                    "VIDEO" if content.media_type == "video" else "IMAGE"
                )
                share_content["media"] = [{"status": "READY", "media": asset_urn}]

            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    f"{self.base_url}/ugcPosts",
                    json={
                        "author": author_urn,
                        "lifecycleState": "PUBLISHED",
                        "specificContent": {"com.linkedin.ugc.ShareContent": share_content},
                        "visibility": {
                            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                        },
                    },
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-Restli-Protocol-Version": "2.0.0",
                    },
                )
                if resp.status_code >= 400:
                    return PublishResult(success=False, error_message=resp.text)

                post_id = resp.headers.get("x-restli-id") or resp.json().get("id")
                return PublishResult(success=True, platform_post_id=post_id)
        except httpx.HTTPError as exc:
            return PublishResult(success=False, error_message=str(exc))

    def _sandbox_token_set(self) -> OAuthTokenSet:
        return OAuthTokenSet(
            access_token=f"sandbox_li_token_{uuid.uuid4().hex[:8]}",
            refresh_token=None,
            expires_at=datetime.now(timezone.utc) + timedelta(days=60),
            account_id=f"sandbox_li_member_{uuid.uuid4().hex[:8]}",
            account_name="My LinkedIn Profile (Sandbox)",
            avatar_url=None,
        )
