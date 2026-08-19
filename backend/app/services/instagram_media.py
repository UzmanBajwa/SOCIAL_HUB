from __future__ import annotations

import io
import logging
import uuid

import httpx
from PIL import Image, ImageOps

from app.services.storage import get_storage

logger = logging.getLogger(__name__)

# Instagram Content Publishing API supported image aspect ratios.
# Images must satisfy:  MIN_RATIO <= width/height <= MAX_RATIO
# See https://developers.facebook.com/docs/instagram-api/guides/content-publishing
MIN_ASPECT_RATIO = 4 / 5  # 0.8  (portrait limit)
MAX_ASPECT_RATIO = 1.91    #       (landscape limit)

# JPEG output settings for transformed images.
JPEG_QUALITY = 95
JPEG_MIME = "image/jpeg"
JPEG_EXTENSION = ".jpg"


class InstagramImageProcessingError(Exception):
    """Raised when the image cannot be downloaded or processed."""


def _is_compatible(width: int, height: int) -> bool:
    """Return True if the image's aspect ratio is within Instagram limits."""
    if height <= 0 or width <= 0:
        return False
    ratio = width / height
    return MIN_ASPECT_RATIO <= ratio <= MAX_ASPECT_RATIO


def _center_crop(img: Image.Image, target_ratio: float) -> Image.Image:
    """Center-crop *img* to the given width:height *target_ratio*.

    The crop keeps as much of the original image as possible while
    matching the exact target aspect ratio.  For a landscape target
    (target_ratio > 1) the height is kept and the width is trimmed;
    for a portrait target (target_ratio < 1) the width is kept and
    the height is trimmed.
    """
    w, h = img.size
    current_ratio = w / h

    if current_ratio > target_ratio:
        # Too wide — trim width.
        new_w = round(h * target_ratio)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    elif current_ratio < target_ratio:
        # Too tall — trim height.
        new_h = round(w / target_ratio)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))

    return img


async def _download_image(url: str) -> Image.Image:
    """Download an image from *url* and return a Pillow Image with EXIF
    orientation applied.

    Raises ``InstagramImageProcessingError`` on any failure.
    """
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        raise InstagramImageProcessingError(
            f"Failed to download image from {url}: {exc}"
        ) from exc

    try:
        img = Image.open(io.BytesIO(resp.content))
        img = ImageOps.exif_transpose(img)
    except Exception as exc:
        raise InstagramImageProcessingError(
            f"Failed to open or process image EXIF data: {exc}"
        ) from exc

    return img


def _save_to_bytes(img: Image.Image) -> bytes:
    """Convert *img* to JPEG bytes.  Converts palette/RGBA images to RGB
    first so the JPEG encoder doesn't fail on transparency."""
    if img.mode in ("RGBA", "LA", "P"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if "A" in img.mode else None)
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=JPEG_QUALITY)
    return buf.getvalue()


async def prepare_instagram_image(image_url: str) -> str:
    """Ensure *image_url* meets Instagram's aspect-ratio requirements.

    * If the image is already compatible, returns *image_url* unchanged.
    * Otherwise, center-crops the image to the nearest supported ratio,
      saves it through the storage backend, and returns a new public URL.

    Raises ``InstagramImageProcessingError`` on any failure.
    """
    img = await _download_image(image_url)
    w, h = img.size

    if _is_compatible(w, h):
        return image_url

    ratio = w / h
    if ratio > MAX_ASPECT_RATIO:
        target_ratio = MAX_ASPECT_RATIO
    else:
        target_ratio = MIN_ASPECT_RATIO

    cropped = _center_crop(img, target_ratio)
    jpeg_bytes = _save_to_bytes(cropped)

    dest_name = f"ig_{uuid.uuid4().hex}{JPEG_EXTENSION}"
    storage = get_storage()
    public_url = await storage.save_bytes(jpeg_bytes, dest_name, JPEG_MIME)
    return public_url
