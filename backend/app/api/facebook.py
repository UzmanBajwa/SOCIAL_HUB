import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database.session import get_db
from app.models.enums import Platform
from app.models.social_account import SocialAccount
from app.models.user import User
from app.schemas.facebook import PageSearchResult, PlaceSearchResult
from app.services.encryption import get_encryptor
from app.services.registry import get_platform_service

router = APIRouter(prefix="/facebook", tags=["facebook"])


async def _get_facebook_account(db: AsyncSession, user_id: uuid.UUID, account_id: uuid.UUID) -> SocialAccount:
    result = await db.execute(
        select(SocialAccount).where(
            SocialAccount.id == account_id,
            SocialAccount.user_id == user_id,
            SocialAccount.platform == Platform.facebook,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Facebook account not found.")
    return account


@router.get("/mentions/search", response_model=list[PageSearchResult])
async def search_mentions(
    account_id: uuid.UUID,
    q: str = Query(default="", max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PageSearchResult]:
    account = await _get_facebook_account(db, current_user.id, account_id)
    access_token = get_encryptor().decrypt(account.access_token)
    service = get_platform_service(Platform.facebook)
    results = await service.search_pages(access_token, q)
    return [PageSearchResult(**r) for r in results]


@router.get("/locations/search", response_model=list[PlaceSearchResult])
async def search_locations(
    account_id: uuid.UUID,
    q: str = Query(default="", max_length=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[PlaceSearchResult]:
    account = await _get_facebook_account(db, current_user.id, account_id)
    access_token = get_encryptor().decrypt(account.access_token)
    service = get_platform_service(Platform.facebook)
    results = await service.search_places(access_token, q)
    return [PlaceSearchResult(**r) for r in results]
