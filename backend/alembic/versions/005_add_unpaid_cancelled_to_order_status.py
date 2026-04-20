"""order_status enum에 UNPAID_CANCELLED 추가 (결제 전 취소 구분)

Revision ID: 005
Revises: 004
Create Date: 2026-04-20

"""
from typing import Sequence, Union

from alembic import op

revision: str = '005'
down_revision: Union[str, Sequence[str], None] = '004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """결제 전 취소(UNPAID_CANCELLED)와 결제 후 취소(CANCELLED) 구분"""
    op.execute(
        "ALTER TABLE orders MODIFY COLUMN order_status "
        "ENUM('ORDERED', 'PAID', 'CANCELLED', 'UNPAID_CANCELLED') NOT NULL DEFAULT 'ORDERED' "
        "COMMENT '주문 처리 상태'"
    )


def downgrade() -> None:
    """UNPAID_CANCELLED 데이터가 있다면 CANCELLED로 합친 뒤 ENUM에서 제거"""
    op.execute("UPDATE orders SET order_status = 'CANCELLED' WHERE order_status = 'UNPAID_CANCELLED'")
    op.execute(
        "ALTER TABLE orders MODIFY COLUMN order_status "
        "ENUM('ORDERED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'ORDERED' "
        "COMMENT '주문 처리 상태'"
    )
