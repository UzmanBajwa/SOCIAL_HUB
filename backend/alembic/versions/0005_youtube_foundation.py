"""YouTube foundation: platform_options, post_platform meta, youtube_uploads

Revision ID: 0005_youtube_foundation
Revises: 0004_facebook_composer
Create Date: 2026-08-14 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005_youtube_foundation"
down_revision: Union[str, None] = "0004_facebook_composer"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("platform_options", postgresql.JSONB(), nullable=True))
    op.add_column("post_platforms", sa.Column("meta", postgresql.JSONB(), nullable=True))

    op.create_table(
        "youtube_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "account_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("social_accounts.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "post_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("posts.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="initialized"),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("video_id", sa.String(length=255), nullable=True),
        sa.Column("session_uri", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
    )
    op.create_index("ix_youtube_uploads_user_id", "youtube_uploads", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_youtube_uploads_user_id", table_name="youtube_uploads")
    op.drop_table("youtube_uploads")
    op.drop_column("post_platforms", "meta")
    op.drop_column("posts", "platform_options")
