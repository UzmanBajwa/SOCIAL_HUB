from __future__ import annotations

import asyncio
import uuid
from abc import ABC, abstractmethod
from functools import lru_cache
from pathlib import Path

import aiofiles
import boto3
from botocore.client import Config as BotoConfig
from fastapi import UploadFile

from app.config import get_settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_UPLOAD_BYTES = 200 * 1024 * 1024  # 200MB


class UnsupportedMediaError(ValueError):
    pass


class StorageBackend(ABC):
    @abstractmethod
    async def save(self, file: UploadFile, destination_name: str) -> str:
        """Persist the file and return a publicly reachable URL."""

    @abstractmethod
    async def delete(self, file_url: str) -> None:
        """Best-effort removal of a previously stored file."""


class LocalStorage(StorageBackend):
    def __init__(self, upload_dir: str, public_base_url: str) -> None:
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.public_base_url = public_base_url.rstrip("/")

    async def save(self, file: UploadFile, destination_name: str) -> str:
        destination = self.upload_dir / destination_name
        async with aiofiles.open(destination, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):
                await out_file.write(chunk)
        return f"{self.public_base_url}/uploads/{destination_name}"

    async def delete(self, file_url: str) -> None:
        file_name = file_url.rsplit("/", 1)[-1]
        target = self.upload_dir / file_name
        if target.exists():
            target.unlink()


class R2Storage(StorageBackend):
    """Cloudflare R2 (S3-compatible) storage backend for production."""

    def __init__(
        self,
        account_id: str,
        access_key_id: str,
        secret_access_key: str,
        bucket_name: str,
        public_url: str,
    ) -> None:
        self.bucket_name = bucket_name
        self.public_url = public_url.rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
            config=BotoConfig(signature_version="s3v4"),
            region_name="auto",
        )

    async def save(self, file: UploadFile, destination_name: str) -> str:
        contents = await file.read()
        # boto3 is synchronous; run it off the event loop so one upload can't stall every
        # other request being served by this worker.
        await asyncio.to_thread(
            self.client.put_object,
            Bucket=self.bucket_name,
            Key=destination_name,
            Body=contents,
            ContentType=file.content_type or "application/octet-stream",
        )
        return f"{self.public_url}/{destination_name}"

    async def delete(self, file_url: str) -> None:
        key = file_url.rsplit("/", 1)[-1]
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket_name, Key=key)


@lru_cache
def get_storage() -> StorageBackend:
    settings = get_settings()
    if settings.storage_backend == "r2":
        return R2Storage(
            account_id=settings.r2_account_id,
            access_key_id=settings.r2_access_key_id,
            secret_access_key=settings.r2_secret_access_key,
            bucket_name=settings.r2_bucket_name,
            public_url=settings.r2_public_url,
        )
    return LocalStorage(settings.local_upload_dir, settings.backend_url)


def validate_upload(file: UploadFile) -> str:
    """Validates content type and returns 'image' or 'video'."""
    content_type = file.content_type or ""
    if content_type in ALLOWED_IMAGE_TYPES:
        return "image"
    if content_type in ALLOWED_VIDEO_TYPES:
        return "video"
    raise UnsupportedMediaError(f"Unsupported media type: {content_type}")


def generate_storage_key(original_filename: str) -> str:
    suffix = Path(original_filename).suffix.lower()
    return f"{uuid.uuid4().hex}{suffix}"
