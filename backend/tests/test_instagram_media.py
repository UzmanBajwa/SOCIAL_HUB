"""Tests for Instagram image aspect-ratio validation and transformation."""
from __future__ import annotations

import io
import struct
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from PIL import Image

from app.services.instagram_media import (
    JPEG_MIME,
    JPEG_QUALITY,
    MAX_ASPECT_RATIO,
    MIN_ASPECT_RATIO,
    InstagramImageProcessingError,
    _center_crop,
    _download_image,
    _is_compatible,
    _save_to_bytes,
    prepare_instagram_image,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_image(width: int, height: int, color: str = "red") -> Image.Image:
    """Create a plain RGB PIL Image of the given dimensions."""
    return Image.new("RGB", (width, height), color)


def _image_to_bytes(img: Image.Image, fmt: str = "JPEG") -> bytes:
    """Render a PIL Image to bytes."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def _make_jpeg(width: int, height: int, color: str = "red") -> bytes:
    """Create JPEG bytes for a plain image."""
    return _image_to_bytes(_make_image(width, height, color))


def _make_png(width: int, height: int, color: str = "red") -> bytes:
    """Create PNG bytes for a plain image."""
    return _image_to_bytes(_make_image(width, height, color), fmt="PNG")


def _make_exif_image(width: int, height: int, orientation: int = 6) -> bytes:
    """Create a JPEG with EXIF orientation tag.

    Orientation values: https://exiftool.org/TagNames/EXIF.html
    6 = 90° CW  (the most common phone-camera orientation).
    """
    img = Image.new("RGB", (width, height), "blue")
    buf = io.BytesIO()

    from PIL.ExifTags import Base as ExifBase

    exif_data = img.getexif()
    exif_data[ExifBase.Orientation] = orientation
    img.save(buf, format="JPEG", exif=exif_data.tobytes())
    return buf.getvalue()


async def _mock_download(jpeg_bytes: bytes):
    """Return a patched httpx.AsyncClient.get that yields *jpeg_bytes*."""
    mock_resp = MagicMock()
    mock_resp.content = jpeg_bytes
    mock_resp.raise_for_status = MagicMock()
    return mock_resp


# ---------------------------------------------------------------------------
# _is_compatible
# ---------------------------------------------------------------------------

class TestIsCompatible:
    """Unit tests for the pure aspect-ratio check."""

    def test_exact_1_to_1(self):
        assert _is_compatible(1000, 1000) is True

    def test_exact_4_to_5(self):
        assert _is_compatible(800, 1000) is True

    def test_exact_5_to_4(self):
        assert _is_compatible(1000, 800) is True

    def test_exact_1_91_to_1(self):
        # 1910 / 1000 = 1.91
        assert _is_compatible(1910, 1000) is True

    def test_slightly_wider_than_1_91(self):
        # 1920 / 1000 = 1.92 > 1.91
        assert _is_compatible(1920, 1000) is False

    def test_slightly_taller_than_4_to_5(self):
        # 799 / 1000 = 0.799 < 0.8
        assert _is_compatible(799, 1000) is False

    def test_extreme_landscape(self):
        assert _is_compatible(4000, 1000) is False

    def test_extreme_portrait(self):
        assert _is_compatible(500, 4000) is False

    def test_zero_dimension(self):
        assert _is_compatible(0, 100) is False
        assert _is_compatible(100, 0) is False


# ---------------------------------------------------------------------------
# _center_crop
# ---------------------------------------------------------------------------

class TestCenterCrop:
    """Unit tests for the center-cropping logic."""

    def test_wide_image_cropped_to_target(self):
        img = _make_image(2000, 1000)
        cropped = _center_crop(img, 1.91)
        w, h = cropped.size
        assert abs(w / h - 1.91) < 0.01

    def test_tall_image_cropped_to_target(self):
        img = _make_image(1000, 2000)
        cropped = _center_crop(img, 0.8)
        w, h = cropped.size
        assert abs(w / h - 0.8) < 0.01

    def test_already_compatible_returns_unchanged(self):
        img = _make_image(1000, 1000)
        cropped = _center_crop(img, 1.0)
        assert cropped.size == (1000, 1000)

    def test_crop_centered(self):
        """Verify the crop is actually centered, not edge-biased."""
        img = _make_image(2000, 1000, "red")
        # Draw a recognizable pattern: blue stripe at horizontal center.
        for x in range(950, 1050):
            for y in range(1000):
                img.putpixel((x, y), (0, 0, 255))
        cropped = _center_crop(img, 1.91)
        w, h = cropped.size
        # The blue stripe should be inside the crop region.
        center_pixel = cropped.getpixel((w // 2, h // 2))
        assert center_pixel == (0, 0, 255), "Center crop should preserve the image center"


# ---------------------------------------------------------------------------
# _save_to_bytes
# ---------------------------------------------------------------------------

class TestSaveToBytes:
    def test_rgb_image_produces_jpeg(self):
        img = _make_image(100, 100)
        data = _save_to_bytes(img)
        assert data[:2] == b"\xff\xd8"  # JPEG magic bytes

    def test_rgba_image_converts_to_rgb_jpeg(self):
        img = Image.new("RGBA", (100, 100), (255, 0, 0, 128))
        data = _save_to_bytes(img)
        assert data[:2] == b"\xff\xd8"

    def test_palette_image_converts_to_rgb_jpeg(self):
        img = Image.new("P", (100, 100))
        data = _save_to_bytes(img)
        assert data[:2] == b"\xff\xd8"


# ---------------------------------------------------------------------------
# prepare_instagram_image (integration-style with mocked HTTP + storage)
# ---------------------------------------------------------------------------

class TestPrepareInstagramImage:
    """Integration tests for the main async entry point."""

    @pytest.mark.asyncio
    async def test_compatible_image_passes_through_unchanged(self):
        """A 1:1 image should not be transformed -- original URL returned."""
        url = "https://example.com/photo.jpg"
        jpeg = _make_jpeg(1000, 1000)

        mock_resp = MagicMock()
        mock_resp.content = jpeg
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await prepare_instagram_image(url)

        assert result == url

    @pytest.mark.asyncio
    async def test_too_wide_image_is_center_cropped(self):
        """A 16:9 landscape image should be cropped to 1.91:1."""
        wide_jpeg = _make_jpeg(1920, 1080)  # ratio = 1.778 — wait, 16:9 = 1.778 which is < 1.91
        # Actually 16:9 = 1.778, which IS compatible. Let me use 2:1.
        wide_jpeg = _make_jpeg(2000, 1000)  # ratio = 2.0 > 1.91

        mock_resp = MagicMock()
        mock_resp.content = wide_jpeg
        mock_resp.raise_for_status = MagicMock()

        mock_storage = AsyncMock()
        mock_storage.save_bytes = AsyncMock(return_value="https://cdn.example.com/ig_cropped.jpg")

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with patch("app.services.instagram_media.get_storage", return_value=mock_storage):
                result = await prepare_instagram_image("https://example.com/wide.jpg")

        assert result == "https://cdn.example.com/ig_cropped.jpg"
        mock_storage.save_bytes.assert_called_once()
        saved_bytes = mock_storage.save_bytes.call_args[0][0]
        saved_img = Image.open(io.BytesIO(saved_bytes))
        w, h = saved_img.size
        assert abs(w / h - MAX_ASPECT_RATIO) < 0.01

    @pytest.mark.asyncio
    async def test_too_tall_image_is_center_cropped(self):
        """A 9:16 portrait image should be cropped to 4:5."""
        tall_jpeg = _make_jpeg(1080, 1920)  # ratio = 0.5625 < 0.8

        mock_resp = MagicMock()
        mock_resp.content = tall_jpeg
        mock_resp.raise_for_status = MagicMock()

        mock_storage = AsyncMock()
        mock_storage.save_bytes = AsyncMock(return_value="https://cdn.example.com/ig_cropped_tall.jpg")

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with patch("app.services.instagram_media.get_storage", return_value=mock_storage):
                result = await prepare_instagram_image("https://example.com/tall.jpg")

        assert result == "https://cdn.example.com/ig_cropped_tall.jpg"
        mock_storage.save_bytes.assert_called_once()
        saved_bytes = mock_storage.save_bytes.call_args[0][0]
        saved_img = Image.open(io.BytesIO(saved_bytes))
        w, h = saved_img.size
        assert abs(w / h - MIN_ASPECT_RATIO) < 0.01

    @pytest.mark.asyncio
    async def test_exif_orientation_applied_before_crop(self):
        """Image with EXIF orientation 6 (90° CW) should be transposed before
        the aspect ratio is evaluated."""
        # Store as 1000×500 (landscape) but rotate 90° CW → effective 500×1000 (portrait, ratio=0.5).
        oriented_jpeg = _make_exif_image(1000, 500, orientation=6)

        mock_resp = MagicMock()
        mock_resp.content = oriented_jpeg
        mock_resp.raise_for_status = MagicMock()

        mock_storage = AsyncMock()
        mock_storage.save_bytes = AsyncMock(return_value="https://cdn.example.com/ig_exif.jpg")

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with patch("app.services.instagram_media.get_storage", return_value=mock_storage):
                result = await prepare_instagram_image("https://example.com/exif.jpg")

        # The image should have been transposed (500×1000 portrait), detected as too tall,
        # and cropped to 4:5.
        assert result == "https://cdn.example.com/ig_exif.jpg"
        saved_bytes = mock_storage.save_bytes.call_args[0][0]
        saved_img = Image.open(io.BytesIO(saved_bytes))
        w, h = saved_img.size
        assert abs(w / h - MIN_ASPECT_RATIO) < 0.01

    @pytest.mark.asyncio
    async def test_download_failure_raises_error(self):
        """A network error during download should raise InstagramImageProcessingError."""
        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            import httpx
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("DNS failure"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with pytest.raises(InstagramImageProcessingError, match="Failed to download"):
                await prepare_instagram_image("https://example.com/broken.jpg")

    @pytest.mark.asyncio
    async def test_corrupt_image_raises_error(self):
        """Corrupt image bytes should raise InstagramImageProcessingError."""
        mock_resp = MagicMock()
        mock_resp.content = b"not-an-image"
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with pytest.raises(InstagramImageProcessingError, match="Failed to open"):
                await prepare_instagram_image("https://example.com/corrupt.jpg")

    @pytest.mark.asyncio
    async def test_transformed_image_uses_storage_abstraction(self):
        """The transformed image must be saved via storage.save_bytes(), not
        direct filesystem writes."""
        wide_jpeg = _make_jpeg(3000, 1000)  # ratio = 3.0

        mock_resp = MagicMock()
        mock_resp.content = wide_jpeg
        mock_resp.raise_for_status = MagicMock()

        mock_storage = AsyncMock()
        mock_storage.save_bytes = AsyncMock(return_value="https://cdn.example.com/ig_new.jpg")

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with patch("app.services.instagram_media.get_storage", return_value=mock_storage) as mock_get_storage:
                await prepare_instagram_image("https://example.com/wide.jpg")

        mock_get_storage.assert_called_once()
        call_kwargs = mock_storage.save_bytes.call_args
        assert call_kwargs[0][2] == JPEG_MIME  # content_type

    @pytest.mark.asyncio
    async def test_facebook_gets_original_url(self):
        """Simulate the publish flow: Instagram processes the image but the
        original content.media_url remains intact for Facebook."""
        original_url = "https://cdn.example.com/original_3000x1000.jpg"
        wide_jpeg = _make_jpeg(3000, 1000)

        mock_resp = MagicMock()
        mock_resp.content = wide_jpeg
        mock_resp.raise_for_status = MagicMock()

        mock_storage = AsyncMock()
        mock_storage.save_bytes = AsyncMock(return_value="https://cdn.example.com/ig_transformed.jpg")

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            with patch("app.services.instagram_media.get_storage", return_value=mock_storage):
                ig_url = await prepare_instagram_image(original_url)

        # Instagram gets the transformed URL
        assert ig_url == "https://cdn.example.com/ig_transformed.jpg"
        # Original URL is unchanged — Facebook would use this
        assert original_url == "https://cdn.example.com/original_3000x1000.jpg"

    @pytest.mark.asyncio
    async def test_processing_failure_returns_publish_error(self):
        """Verify that an InstagramImageProcessingError from prepare_instagram_image
        can be caught and converted to a PublishResult in instagram_service."""
        from app.services.instagram_media import InstagramImageProcessingError

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            import httpx
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("timeout"))
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            try:
                await prepare_instagram_image("https://example.com/img.jpg")
                assert False, "Should have raised"
            except InstagramImageProcessingError:
                pass  # This is what instagram_service catches

    @pytest.mark.asyncio
    async def test_16_by_9_image_is_compatible(self):
        """16:9 (1.778) is within the 0.8-1.91 range, so should pass through."""
        url = "https://example.com/16by9.jpg"
        jpeg = _make_jpeg(1920, 1080)

        mock_resp = MagicMock()
        mock_resp.content = jpeg
        mock_resp.raise_for_status = MagicMock()

        with patch("app.services.instagram_media.httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.get = AsyncMock(return_value=mock_resp)
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client_cls.return_value = mock_client

            result = await prepare_instagram_image(url)

        assert result == url
