"""YouTube uploader: media link + metadata bag on youtube_uploads

Revision ID: 0006_youtube_upload_metadata
Revises: 0005_youtube_foundation
Create Date: 2026-08-14 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_youtube_upload_metadata"
down_revision: Union[str, None] = "0005_youtube_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "youtube_uploads",
        sa.Column(
            "media_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("media.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "youtube_uploads", sa.Column("metadata_json", postgresql.JSONB(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("youtube_uploads", "metadata_json")
    op.drop_column("youtube_uploads", "media_id")
