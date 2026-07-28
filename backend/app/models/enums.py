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
    published = "published"
    failed = "failed"


class MediaType(str, enum.Enum):
    image = "image"
    video = "video"
