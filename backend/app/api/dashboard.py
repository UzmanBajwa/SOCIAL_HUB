from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database.session import get_db
from app.models.enums import PostStatus
from app.models.post import Post
from app.models.user import User
from app.schemas.dashboard import DashboardResponse
from app.schemas.post import PostRead
from app.schemas.social_account import SocialAccountRead
from app.services import account_service, post_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> DashboardResponse:
    accounts = await account_service.list_accounts(db, current_user.id)
    all_posts = await post_service.list_posts(db, current_user.id)

    upcoming = sorted(
        (p for p in all_posts if p.status == PostStatus.scheduled and p.publish_date),
        key=lambda p: p.publish_date,
    )[:10]
    recent = all_posts[:10]

    published_count_result = await db.execute(
        select(func.count()).select_from(Post).where(
            Post.user_id == current_user.id,
            Post.status.in_([PostStatus.published, PostStatus.partially_published]),
        )
    )
    published_count = published_count_result.scalar_one()

    return DashboardResponse(
        connected_accounts=[SocialAccountRead.model_validate(a) for a in accounts],
        upcoming_scheduled_posts=[PostRead.model_validate(p) for p in upcoming],
        recent_posts=[PostRead.model_validate(p) for p in recent],
        total_posts_published=published_count,
        total_accounts_connected=len(accounts),
    )
