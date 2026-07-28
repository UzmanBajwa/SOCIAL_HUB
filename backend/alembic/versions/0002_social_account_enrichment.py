"""enrich social_accounts with username, scopes, extra_data

Revision ID: 0002_social_account_enrichment
Revises: 0001_initial_schema
Create Date: 2026-07-28 00:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002_social_account_enrichment"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("social_accounts", sa.Column("account_username", sa.String(length=255), nullable=True))
    op.add_column("social_accounts", sa.Column("scopes", postgresql.JSONB(), nullable=True))
    op.add_column("social_accounts", sa.Column("extra_data", postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("social_accounts", "extra_data")
    op.drop_column("social_accounts", "scopes")
    op.drop_column("social_accounts", "account_username")
