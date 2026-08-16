from __future__ import annotations

import uuid
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.services.base import OAuthTokenSet, PageCandidate, PlatformService, PublishContent, PublishResult

# Company Page posting only, by design -- personal profile posting (w_member_social)
# is intentionally not requested. r_organization_admin is what lets us list which
# Company Pages the member administers (the page-selection step, same pattern as
# Facebook's Pages).
LINKEDIN_SCOPES = ["w_organization_social", "r_organization_admin"]

# LinkedIn's documented multi-part video upload chunk size.
VIDEO_CHUNK_SIZE = 4 * 1024 * 1024


class LinkedInService(PlatformService):
    platform_name = "linkedin"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.rest_base_url = "https://api.linkedin.com/rest"
        self.v2_base_url = "https://api.linkedin.com/v2"

    def _headers(self, access_token: str) -> dict:
        return {
            "Authorization": f"Bearer {access_token}",
            "X-Restli-Protocol-Version": "2.0.0",
            "Linkedin-Version": self.settings.linkedin_api_version,
        }

    def get_authorize_url(self, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.settings.linkedin_client_id,
            "redirect_uri": self.settings.redirect_uri("linkedin"),
            "state": state,
            "scope": " ".join(LINKEDIN_SCOPES),
        }
        return f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"

    async def fetch_page_candidates(self, code: str) -> list[PageCandidate]:
        """Exchanges the OAuth code for a member access token, then returns every
        Company Page the member administers (ADMINISTRATOR role) so they can pick which
        one to connect -- same two-step pattern as Facebook Pages."""
        if self.settings.platform_sandbox_mode:
            return self._sandbox_pages()

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
            access_token = token_resp.json()["access_token"]

            acls_resp = await client.get(
                f"{self.v2_base_url}/organizationAcls",
                params={
                    "q": "roleAssignee",
                    "role": "ADMINISTRATOR",
                    "state": "APPROVED",
                    "projection": "(elements*(organization~(id,localizedName)))",
                },
                headers={"Authorization": f"Bearer {access_token}", "X-Restli-Protocol-Version": "2.0.0"},
            )
            acls_resp.raise_for_status()
            elements = acls_resp.json().get("elements", [])

            if not elements:
                raise ValueError(
                    "No LinkedIn Company Pages found where you're an administrator. "
                    "Publishing requires admin access to a Company Page."
                )

            candidates = []
            for element in elements:
                org = element.get("organization~", {})
                org_id = str(org.get("id", ""))
                if not org_id:
                    continue
                candidates.append(
                    PageCandidate(
                        id=org_id,
                        name=org.get("localizedName", "LinkedIn Company Page"),
                        access_token=access_token,
                        # LinkedIn's logo field requires a separate, deeper-nested lookup
                        # than Facebook's picture field -- skipped for now; the UI falls
                        # back to initials, which is a fine degradation, not a broken one.
                        avatar_url=None,
                    )
                )
            return candidates

    async def connect(self, code: str) -> OAuthTokenSet:
        """Legacy single-shot connect (auto-picks the first Page). Superseded by
        fetch_page_candidates -> account_service.finalize_page_selection."""
        candidates = await self.fetch_page_candidates(code)
        page = candidates[0]
        return OAuthTokenSet(
            access_token=page.access_token,
            refresh_token=None,
            expires_at=None,
            account_id=page.id,
            account_name=page.name,
            avatar_url=page.avatar_url,
        )

    async def disconnect(self, access_token: str, account_id: str) -> None:
        return None  # LinkedIn has no public revoke endpoint for this token type.

    async def validate_token(self, access_token: str) -> bool:
        if self.settings.platform_sandbox_mode:
            return True
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{self.v2_base_url}/organizationAcls",
                params={"q": "roleAssignee", "role": "ADMINISTRATOR"},
                headers={"Authorization": f"Bearer {access_token}", "X-Restli-Protocol-Version": "2.0.0"},
            )
            return resp.status_code == 200

    async def upload_media(self, access_token: str, account_id: str, media_url: str, media_type: str) -> str:
        if self.settings.platform_sandbox_mode:
            kind = "video" if media_type == "video" else "image"
            return f"urn:li:{kind}:sandbox_{uuid.uuid4().hex[:10]}"

        async with httpx.AsyncClient(timeout=300) as client:
            if media_type == "video":
                return await self._upload_video(client, access_token, account_id, media_url)
            return await self._upload_image(client, access_token, account_id, media_url)

    async def _upload_image(
        self, client: httpx.AsyncClient, access_token: str, account_id: str, media_url: str
    ) -> str:
        init_resp = await client.post(
            f"{self.rest_base_url}/images",
            params={"action": "initializeUpload"},
            json={"initializeUploadRequest": {"owner": f"urn:li:organization:{account_id}"}},
            headers=self._headers(access_token),
        )
        init_resp.raise_for_status()
        value = init_resp.json()["value"]

        media_bytes_resp = await client.get(media_url)
        media_bytes_resp.raise_for_status()

        upload_resp = await client.put(value["uploadUrl"], content=media_bytes_resp.content)
        upload_resp.raise_for_status()
        return value["image"]

    async def _upload_video(
        self, client: httpx.AsyncClient, access_token: str, account_id: str, media_url: str
    ) -> str:
        media_bytes_resp = await client.get(media_url)
        media_bytes_resp.raise_for_status()
        video_bytes = media_bytes_resp.content

        init_resp = await client.post(
            f"{self.rest_base_url}/videos",
            params={"action": "initializeUpload"},
            json={
                "initializeUploadRequest": {
                    "owner": f"urn:li:organization:{account_id}",
                    "fileSizeBytes": len(video_bytes),
                    "uploadCaptions": False,
                    "uploadThumbnail": False,
                }
            },
            headers=self._headers(access_token),
        )
        init_resp.raise_for_status()
        value = init_resp.json()["value"]
        video_urn = value["video"]
        upload_token = value.get("uploadToken", "")

        uploaded_part_ids = []
        for part in value["uploadInstructions"]:
            chunk = video_bytes[part["firstByte"] : part["lastByte"] + 1]
            put_resp = await client.put(
                part["uploadUrl"], content=chunk, headers={"Content-Type": "application/octet-stream"}
            )
            put_resp.raise_for_status()
            uploaded_part_ids.append(put_resp.headers.get("etag", "").strip('"'))

        finalize_resp = await client.post(
            f"{self.rest_base_url}/videos",
            params={"action": "finalizeUpload"},
            json={
                "finalizeUploadRequest": {
                    "video": video_urn,
                    "uploadToken": upload_token,
                    "uploadedPartIds": uploaded_part_ids,
                }
            },
            headers=self._headers(access_token),
        )
        finalize_resp.raise_for_status()
        return video_urn

    async def publish_post(
        self, access_token: str, account_id: str, content: PublishContent
    ) -> PublishResult:
        if self.settings.platform_sandbox_mode:
            return PublishResult(success=True, platform_post_id=f"sandbox_li_{uuid.uuid4().hex[:12]}")

        try:
            body: dict = {
                "author": f"urn:li:organization:{account_id}",
                "commentary": content.text,
                "visibility": "PUBLIC",
                "distribution": {
                    "feedDistribution": "MAIN_FEED",
                    "targetEntities": [],
                    "thirdPartyDistributionChannels": [],
                },
                "lifecycleState": "PUBLISHED",
                "isReshareDisabledByAuthor": False,
            }

            if content.media_url and content.media_type in ("image", "video"):
                media_urn = await self.upload_media(access_token, account_id, content.media_url, content.media_type)
                body["content"] = {"media": {"id": media_urn}}

            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(f"{self.rest_base_url}/posts", json=body, headers=self._headers(access_token))
                if resp.status_code >= 400:
                    return PublishResult(success=False, error_message=resp.text)

                post_id = resp.headers.get("x-restli-id")
                return PublishResult(success=True, platform_post_id=post_id)
        except httpx.HTTPError as exc:
            return PublishResult(success=False, error_message=str(exc))

    def _sandbox_pages(self) -> list[PageCandidate]:
        return [
            PageCandidate(
                id=f"sandbox_li_org_{uuid.uuid4().hex[:8]}",
                name="FAME TE (Sandbox Company Page)",
                access_token=f"sandbox_li_token_{uuid.uuid4().hex[:8]}",
            )
        ]
