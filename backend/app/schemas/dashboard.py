from pydantic import BaseModel

from app.schemas.post import PostRead
from app.schemas.social_account import SocialAccountRead


class DashboardResponse(BaseModel):
    connected_accounts: list[SocialAccountRead]
    upcoming_scheduled_posts: list[PostRead]
    recent_posts: list[PostRead]
    total_posts_published: int
    total_accounts_connected: int
