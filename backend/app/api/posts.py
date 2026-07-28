import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.schemas.post import PostCreate, PostRead, PostUpdate, ScheduleRequest
from app.services import post_service

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: PostCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostRead:
    try:
        post = await post_service.create_post(db, current_user.id, payload)
    except (post_service.InvalidAccountSelectionError, ValueError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return PostRead.model_validate(post)


@router.get("", response_model=list[PostRead])
async def list_posts(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[PostRead]:
    posts = await post_service.list_posts(db, current_user.id)
    return [PostRead.model_validate(p) for p in posts]


@router.get("/{post_id}", response_model=PostRead)
async def get_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostRead:
    try:
        post = await post_service.get_post_or_raise(db, current_user.id, post_id)
    except post_service.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found.")
    return PostRead.model_validate(post)


@router.put("/{post_id}", response_model=PostRead)
async def update_post(
    post_id: uuid.UUID,
    payload: PostUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostRead:
    try:
        post = await post_service.update_post(db, current_user.id, post_id, payload)
    except post_service.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found.")
    except (ValueError, post_service.InvalidAccountSelectionError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return PostRead.model_validate(post)


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await post_service.delete_post(db, current_user.id, post_id)
    except post_service.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found.")


@router.post("/{post_id}/publish", response_model=PostRead)
async def publish_post(
    post_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostRead:
    try:
        post = await post_service.publish_post_now(db, current_user.id, post_id)
    except post_service.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found.")
    except (post_service.InvalidAccountSelectionError, ValueError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return PostRead.model_validate(post)


@router.post("/{post_id}/schedule", response_model=PostRead)
async def schedule_post(
    post_id: uuid.UUID,
    payload: ScheduleRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PostRead:
    try:
        post = await post_service.schedule_post(db, current_user.id, post_id, payload.publish_date)
    except post_service.PostNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Post not found.")
    except (post_service.InvalidAccountSelectionError, ValueError) as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return PostRead.model_validate(post)
