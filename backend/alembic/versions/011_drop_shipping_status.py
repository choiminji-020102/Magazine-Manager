"""SHIPPING 단계 폐기 (send_status enum 4값 → 3값, shipped_at 컬럼 DROP)

SHIPPING_REFACTOR_PLAN.md §6.1 / §7 단계 4-α.
"보냈다 = 끝" 정책으로 PREPARING → DELIVERED 2단계만 유지.
운영 DB가 비어있어 데이터 마이그레이션 불필요.

Revision ID: 011
Revises: 010
Create Date: 2026-04-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '011'
down_revision: Union[str, Sequence[str], None] = '010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 잔존 SHIPPING 행이 있으면 enum 축소 실패하므로 안전망으로 DELIVERED 처리
    op.execute("UPDATE sends SET send_status = 'DELIVERED' WHERE send_status = 'SHIPPING'")
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('PREPARING', 'DELIVERED', 'CANCELLED') NOT NULL "
        "COMMENT '발송 상태'"
    )
    op.drop_column("sends", "shipped_at")


def downgrade() -> None:
    op.add_column("sends", sa.Column("shipped_at", sa.DateTime, nullable=True))
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL "
        "COMMENT '발송 상태'"
    )
