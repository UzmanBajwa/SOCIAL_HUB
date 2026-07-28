from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database.session import get_db
from app.models.media import Media
from app.models.user import User
from app.schemas.media import MediaRead
from app.services.storage import (
    MAX_UPLOAD_BYTES,
    UnsupportedMediaError,
    generate_storage_key,
    get_storage,
    validate_upload,
)

router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload", response_model=MediaRead, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MediaRead:
    try:
        media_type = validate_upload(file)
    except UnsupportedMediaError as exc:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc))

    contents_size = 0
    chunk = await file.read(1024 * 1024)
    while chunk:
        contents_size += len(chunk)
        if contents_size > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)}MB upload limit.",
            )
        chunk = await file.read(1024 * 1024)
    await file.seek(0)

    storage_key = generate_storage_key(file.filename or "upload")
    file_url = await get_storage().save(file, storage_key)

    media = Media(
        user_id=current_user.id,
        file_name=file.filename or storage_key,
        file_url=file_url,
        type=media_type,
        size=contents_size,
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)
    return MediaRead.model_validate(media)


@router.get("", response_model=list[MediaRead])
async def list_media(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[MediaRead]:
    result = await db.execute(
        select(Media).where(Media.user_id == current_user.id).order_by(Media.created_at.desc())
    )
    return [MediaRead.model_validate(m) for m in result.scalars().all()]
