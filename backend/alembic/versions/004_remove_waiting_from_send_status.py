"""send_status enum에서 WAITING 제거

Revision ID: 004
Revises: 003
Create Date: 2026-04-12

"""
from typing import Sequence, Union

from alembic import op

revision: str = '004'
down_revision: Union[str, Sequence[str], None] = '003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PREPARING' "
        "COMMENT '발송 상태'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('PREPARING', 'WAITING', 'SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PREPARING' "
        "COMMENT '발송 상태'"
    )
