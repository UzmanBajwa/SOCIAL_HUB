import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.database.session import AsyncSessionLocal
from app.models.enums import PostStatus
from app.services import account_service, post_service

logger = logging.getLogger("socialhub.scheduler")

_scheduler = AsyncIOScheduler()

# Token refresh doesn't need per-minute polling like publishing does -- accounts are
# checked against a 10-day-out window (account_service.TOKEN_REFRESH_WINDOW), so an
# hourly check is plenty of margin without hammering the platform APIs.
REFRESH_INTERVAL_SECONDS = 60 * 60


async def publish_due_posts() -> None:
    """Runs every SCHEDULER_POLL_SECONDS: finds scheduled posts whose publish_date has
    passed and publishes them the same way the `/posts/{id}/publish` route does."""
    async with AsyncSessionLocal() as session:
        due_posts = await post_service.get_due_scheduled_posts(session)
        if not due_posts:
            return

        post_ids = [post.id for post in due_posts]
        for post in due_posts:
            post.status = PostStatus.publishing
        await session.commit()

    for post_id in post_ids:
        try:
            await post_service.publish_post_platforms(post_id)
        except Exception:  # noqa: BLE001 - one post failing must not stop the others
            logger.exception("Failed to publish scheduled post %s", post_id)


async def refresh_expiring_tokens() -> None:
    """Runs hourly: refreshes any connected account's token that's within
    TOKEN_REFRESH_WINDOW of expiring (currently only Instagram implements refresh;
    Facebook Page tokens don't expire and are skipped automatically)."""
    async with AsyncSessionLocal() as session:
        try:
            await account_service.refresh_expiring_tokens(session)
        except Exception:  # noqa: BLE001 - must not crash the scheduler loop
            logger.exception("Token refresh job failed")


def start_scheduler() -> AsyncIOScheduler:
    settings = get_settings()
    if not _scheduler.running:
        _scheduler.add_job(
            publish_due_posts,
            "interval",
            seconds=settings.scheduler_poll_seconds,
            id="publish_due_posts",
            replace_existing=True,
            max_instances=1,
        )
        _scheduler.add_job(
            refresh_expiring_tokens,
            "interval",
            seconds=REFRESH_INTERVAL_SECONDS,
            id="refresh_expiring_tokens",
            replace_existing=True,
            max_instances=1,
        )
        _scheduler.start()
        logger.info(
            "Scheduler started - publishing poll every %ss, token refresh every %ss",
            settings.scheduler_poll_seconds,
            REFRESH_INTERVAL_SECONDS,
        )
    return _scheduler


def shutdown_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
