"""orders.external_order_id에 UNIQUE 제약 추가

Revision ID: 006
Revises: 005
Create Date: 2026-04-21

Cafe24 주문 일괄 import 시 동시 요청으로 동일 external_order_id가 두 번
INSERT되는 것을 DB 레벨에서 차단하기 위해 UNIQUE 인덱스를 추가한다.

NULL은 MySQL에서 UNIQUE 제약과 무관하게 여러 개 허용되므로,
OFFLINE 주문(external_order_id가 NULL인 경우)에는 영향 없음.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '006'
down_revision: Union[str, Sequence[str], None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE orders "
        "ADD UNIQUE KEY uk_orders_external_order_id (external_order_id)"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE orders "
        "DROP INDEX uk_orders_external_order_id"
    )
