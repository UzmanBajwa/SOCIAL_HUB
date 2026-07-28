import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.config import get_settings
from app.database.session import get_db
from app.models.enums import Platform
from app.models.user import User
from app.schemas.social_account import (
    ConnectCallbackRequest,
    ConnectResult,
    ConnectUrlResponse,
    PageCandidateRead,
    PageSelectionResponse,
    SelectPageRequest,
    SocialAccountRead,
)
from app.services import account_service
from app.services.registry import get_platform_service

router = APIRouter(prefix="/accounts", tags=["accounts"])


def _require_enabled(platform: Platform) -> None:
    settings = get_settings()
    if not settings.is_platform_enabled(platform.value):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"{platform.value.capitalize()} isn't supported in this deployment yet.",
        )


@router.get("", response_model=list[SocialAccountRead])
async def list_accounts(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[SocialAccountRead]:
    accounts = await account_service.list_accounts(db, current_user.id)
    return [SocialAccountRead.model_validate(a) for a in accounts]


@router.get("/connect/{platform}", response_model=ConnectUrlResponse)
async def get_connect_url(
    platform: Platform, current_user: User = Depends(get_current_user)
) -> ConnectUrlResponse:
    _require_enabled(platform)
    authorize_url, state = account_service.build_authorize_url(platform, current_user.id)
    return ConnectUrlResponse(authorize_url=authorize_url, state=state)


@router.post("/connect", response_model=ConnectResult, status_code=status.HTTP_200_OK)
async def connect_account(
    payload: ConnectCallbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConnectResult:
    _require_enabled(payload.platform)

    if payload.state and not account_service.consume_oauth_state(payload.state, current_user.id):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid or expired OAuth state.")

    service = get_platform_service(payload.platform)
    supports_page_selection = hasattr(service, "fetch_page_candidates")

    try:
        if supports_page_selection:
            selection_token, pages = await account_service.start_page_selection(
                payload.platform, current_user.id, payload.code
            )
            return ConnectResult(
                requires_selection=True,
                selection=PageSelectionResponse(
                    platform=payload.platform,
                    pages=[PageCandidateRead(**p) for p in pages],
                ),
                selection_token=selection_token,
                account=None,
            )

        account = await account_service.connect_account(db, current_user.id, payload.platform, payload.code)
        return ConnectResult(requires_selection=False, account=SocialAccountRead.model_validate(account))
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))


@router.post("/connect/select", response_model=SocialAccountRead, status_code=status.HTTP_201_CREATED)
async def select_page(
    payload: SelectPageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SocialAccountRead:
    _require_enabled(payload.platform)
    try:
        account = await account_service.finalize_page_selection(
            db, current_user.id, payload.selection_token, payload.page_id
        )
    except account_service.InvalidSelectionError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc))
    return SocialAccountRead.model_validate(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_account(
    account_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    try:
        await account_service.disconnect_account(db, current_user.id, account_id)
    except account_service.AccountNotFoundError:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account not found.")
