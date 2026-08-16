"""Facebook Composer MVP: carousel media, pin, reel, mentions, location, timezone

Revision ID: 0004_facebook_composer
Revises: 0003_reel_options
Create Date: 2026-07-29 10:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_facebook_composer"
down_revision: Union[str, None] = "0003_reel_options"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("posts", sa.Column("media_items", postgresql.JSONB(), nullable=True))
    op.add_column(
        "posts", sa.Column("is_pinned", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column(
        "posts", sa.Column("publish_as_reel", sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column("posts", sa.Column("mentions", postgresql.JSONB(), nullable=True))
    op.add_column("posts", sa.Column("location", postgresql.JSONB(), nullable=True))
    op.add_column("posts", sa.Column("timezone", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("posts", "timezone")
    op.drop_column("posts", "location")
    op.drop_column("posts", "mentions")
    op.drop_column("posts", "publish_as_reel")
    op.drop_column("posts", "is_pinned")
    op.drop_column("posts", "media_items")
