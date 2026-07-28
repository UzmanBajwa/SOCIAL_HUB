from app.models.enums import Platform


class EmptyPostError(ValueError):
    pass


class PlatformMediaRequirementError(ValueError):
    pass


def validate_post_has_content(content: str, media_url: str | None) -> None:
    """A post must have either text or media -- an empty post is never publishable."""
    if not content.strip() and not media_url:
        raise EmptyPostError("A post needs text content, media, or both.")


def validate_platform_media_requirements(platforms: list[Platform], media_url: str | None) -> None:
    """Instagram's Graph API rejects text-only feed posts -- every post needs an image
    or video. Facebook has no such requirement. Enforced here (in addition to the
    client-side check) since the API must never trust the frontend alone."""
    if Platform.instagram in platforms and not media_url:
        raise PlatformMediaRequirementError("Instagram requires an image or video to publish a post.")
