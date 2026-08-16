from datetime import datetime, timedelta, timezone

import pytest

from app.models.enums import PostStatus
from app.schemas.post import PostCreate, PostUpdate
from app.services import post_service
from app.utils.validators import (
    EmptyPostError,
    PastPublishDateError,
    PlatformMediaRequirementError,
)

FUTURE = datetime.now(timezone.utc) + timedelta(days=1)
PAST = datetime.now(timezone.utc) - timedelta(days=1)

IMAGE_URL = "http://media.example.com/img.png"
MEDIA_ITEM = {"url": IMAGE_URL, "type": "image"}


async def _create_post(
    db_session,
    user,
    *,
    content="Hello world",
    media_url=None,
    media_type=None,
    media_items=None,
    publish_date=None,
    accounts=(),
):
    payload = PostCreate(
        content=content,
        media_url=media_url,
        media_type=media_type,
        media_items=media_items,
        publish_date=publish_date,
        platform_account_ids=[a.id for a in accounts],
    )
    return await post_service.create_post(db_session, user.id, payload)


async def test_create_with_future_publish_date_schedules(db_session, user):
    post = await _create_post(db_session, user, content="Future post", publish_date=FUTURE)

    assert post.status == PostStatus.scheduled
    assert post.publish_date is not None


async def test_create_with_past_publish_date_rejected(db_session, user):
    with pytest.raises(PastPublishDateError):
        await _create_post(db_session, user, content="Past post", publish_date=PAST)


async def test_update_with_future_publish_date_schedules_draft(db_session, user):
    post = await _create_post(db_session, user, content="Draft to schedule")

    updated = await post_service.update_post(
        db_session, user.id, post.id, PostUpdate(publish_date=FUTURE)
    )

    assert updated.status == PostStatus.scheduled


async def test_update_with_past_publish_date_rejected(db_session, user):
    post = await _create_post(db_session, user, content="Draft")

    with pytest.raises(PastPublishDateError):
        await post_service.update_post(
            db_session, user.id, post.id, PostUpdate(publish_date=PAST)
        )


async def test_schedule_with_past_publish_date_rejected(db_session, user):
    post = await _create_post(db_session, user, content="Draft")

    with pytest.raises(PastPublishDateError):
        await post_service.schedule_post(db_session, user.id, post.id, PAST)


async def test_update_explicit_null_clears_media(db_session, user):
    post = await _create_post(
        db_session, user, media_url=IMAGE_URL, media_type="image", media_items=[MEDIA_ITEM]
    )
    assert post.media_items is not None

    updated = await post_service.update_post(
        db_session, user.id, post.id, PostUpdate.model_validate({"media_items": None})
    )

    assert updated.media_items is None
    assert updated.media_url is None
    assert updated.media_type is None


async def test_update_omitted_media_keeps_media(db_session, user):
    post = await _create_post(
        db_session, user, media_url=IMAGE_URL, media_type="image", media_items=[MEDIA_ITEM]
    )

    updated = await post_service.update_post(
        db_session, user.id, post.id, PostUpdate(content="Edited text")
    )

    assert updated.content == "Edited text"
    assert updated.media_items == [{"url": IMAGE_URL, "type": "image"}]
    assert updated.media_url == IMAGE_URL
    assert updated.media_type == "image"


async def test_update_empty_media_list_clears_items(db_session, user):
    post = await _create_post(
        db_session, user, media_url=IMAGE_URL, media_type="image", media_items=[MEDIA_ITEM]
    )

    updated = await post_service.update_post(
        db_session, user.id, post.id, PostUpdate.model_validate({"media_items": []})
    )

    assert updated.media_items is None
    assert updated.media_url is None


async def test_draft_update_allows_empty_content(db_session, user):
    post = await _create_post(db_session, user, content="Draft")

    updated = await post_service.update_post(
        db_session, user.id, post.id, PostUpdate(content="")
    )

    assert updated.content == ""
    assert updated.status == PostStatus.draft


async def test_scheduled_post_rejects_update_with_empty_content(db_session, user):
    post = await _create_post(db_session, user, content="Scheduled post", publish_date=FUTURE)
    assert post.status == PostStatus.scheduled

    with pytest.raises(EmptyPostError):
        await post_service.update_post(db_session, user.id, post.id, PostUpdate(content=""))


async def test_scheduled_post_rejects_update_removing_instagram_media(
    db_session, user, instagram_account
):
    post = await _create_post(
        db_session,
        user,
        content="Scheduled IG post",
        media_url=IMAGE_URL,
        media_type="image",
        media_items=[MEDIA_ITEM],
        publish_date=FUTURE,
        accounts=[instagram_account],
    )
    assert post.status == PostStatus.scheduled

    with pytest.raises(PlatformMediaRequirementError):
        await post_service.update_post(
            db_session, user.id, post.id, PostUpdate.model_validate({"media_items": None})
        )


async def test_api_explicit_null_media_items_clears_media(api_client):
    created = await api_client.post(
        "/posts",
        json={
            "content": "With media",
            "media_url": IMAGE_URL,
            "media_type": "image",
            "media_items": [MEDIA_ITEM],
        },
    )
    assert created.status_code == 201
    post_id = created.json()["id"]

    updated = await api_client.put(f"/posts/{post_id}", json={"media_items": None})

    assert updated.status_code == 200
    body = updated.json()
    assert body["media_items"] is None
    assert body["media_url"] is None
    assert body["media_type"] is None


async def test_api_past_publish_date_rejected(api_client):
    response = await api_client.post(
        "/posts", json={"content": "Past", "publish_date": PAST.isoformat()}
    )

    assert response.status_code == 400
