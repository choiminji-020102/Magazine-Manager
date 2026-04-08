"""order_status enum에서 미사용 SHIPPING, COMPLETED 제거

Revision ID: 002
Revises: 09e35bff6dff
Create Date: 2026-04-08

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, Sequence[str], None] = '09e35bff6dff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """order_status enum에서 SHIPPING, COMPLETED 제거 (코드에서 미사용)"""
    op.execute(
        "ALTER TABLE orders MODIFY COLUMN order_status "
        "ENUM('ORDERED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'ORDERED' "
        "COMMENT '주문 처리 상태'"
    )


def downgrade() -> None:
    """order_status enum에 SHIPPING, COMPLETED 복원"""
    op.execute(
        "ALTER TABLE orders MODIFY COLUMN order_status "
        "ENUM('ORDERED', 'PAID', 'CANCELLED', 'SHIPPING', 'COMPLETED') NOT NULL DEFAULT 'ORDERED' "
        "COMMENT '주문 처리 상태'"
    )
