import enum


class Platform(str, enum.Enum):
    facebook = "facebook"
    instagram = "instagram"
    linkedin = "linkedin"
    youtube = "youtube"


class AccountStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    revoked = "revoked"
    error = "error"


class PostStatus(str, enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    partially_published = "partially_published"
    failed = "failed"


class PostPlatformStatus(str, enum.Enum):
    pending = "pending"
    publishing = "publishing"
    # YouTube videos keep processing server-side after the upload finishes -- this state
    # lets a PostPlatform row reflect "uploaded, not yet live" without blocking the rest.
    processing = "processing"
    published = "published"
    failed = "failed"


class MediaType(str, enum.Enum):
    image = "image"
    video = "video"


class YouTubeUploadStatus(str, enum.Enum):
    """Lifecycle of a single YouTube Studio resumable upload session (youtube_uploads):

    initialized -> uploading -> uploaded -> (server-side processing, later task) -> completed
    Any of these can end in failed or cancelled.
    """
    initialized = "initialized"
    uploading = "uploading"
    uploaded = "uploaded"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"
