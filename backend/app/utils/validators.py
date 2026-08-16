from datetime import datetime, timezone

from app.models.enums import Platform


class EmptyPostError(ValueError):
    pass


class PlatformMediaRequirementError(ValueError):
    pass


class PastPublishDateError(ValueError):
    pass


def validate_post_has_content(content: str, media_url: str | None) -> None:
    """A post must have either text or media -- an empty post is never publishable."""
    if not content.strip() and not media_url:
        raise EmptyPostError("A post needs text content, media, or both.")


def validate_platform_media_requirements(
    platforms: list[Platform], media_url: str | None, media_item_count: int = 0
) -> None:
    """Instagram's Graph API rejects text-only feed posts -- every post needs an image
    or video. LinkedIn's organic Posts API doesn't support multi-image carousels (that's
    sponsored-only). Facebook has neither restriction. Enforced here (in addition to the
    client-side check) since the API must never trust the frontend alone."""
    if Platform.instagram in platforms and not media_url:
        raise PlatformMediaRequirementError("Instagram requires an image or video to publish a post.")
    if Platform.linkedin in platforms and media_item_count > 1:
        raise PlatformMediaRequirementError(
            "LinkedIn doesn't support multi-image carousel posts -- use a single image or video, "
            "or deselect LinkedIn."
        )


def validate_future_publish_date(publish_date: datetime) -> None:
    """Rejects scheduling with a publish date in the past. publish_date is always UTC
    (the frontend converts from the user's selected timezone before sending it), so the
    comparison is against the current UTC time. A naive datetime is treated as UTC."""
    if publish_date.tzinfo is None:
        publish_date = publish_date.replace(tzinfo=timezone.utc)
    if publish_date <= datetime.now(timezone.utc):
        raise PastPublishDateError("Publish date must be in the future.")
