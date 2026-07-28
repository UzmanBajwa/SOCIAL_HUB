from functools import lru_cache

from app.models.enums import Platform
from app.services.base import PlatformService
from app.services.facebook_service import FacebookService
from app.services.instagram_service import InstagramService
from app.services.linkedin_service import LinkedInService
from app.services.youtube_service import YouTubeService


@lru_cache
def _instances() -> dict[Platform, PlatformService]:
    return {
        Platform.facebook: FacebookService(),
        Platform.instagram: InstagramService(),
        Platform.linkedin: LinkedInService(),
        Platform.youtube: YouTubeService(),
    }


def get_platform_service(platform: Platform) -> PlatformService:
    try:
        return _instances()[platform]
    except KeyError as exc:
        raise ValueError(f"Unsupported platform: {platform}") from exc
