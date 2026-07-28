"""add reel options to posts (thumbnail_url, share_to_feed)

Revision ID: 0003_reel_options
Revises: 0002_social_account_enrichment
Create Date: 2026-07-29 02:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_reel_options"
down_revision: Union[str, None] = "0002_social_account_enrichment"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("thumbnail_url", sa.String(length=1024), nullable=True))
    op.add_column(
        "posts", sa.Column("share_to_feed", sa.Boolean(), nullable=False, server_default=sa.true())
    )


def downgrade() -> None:
    op.drop_column("posts", "share_to_feed")
    op.drop_column("posts", "thumbnail_url")
