"""order_items 테이블에 cafe24_shipping_code 컬럼 추가

YEARLY 주문 import 시 POST /api/v2/admin/shipments (standby) 응답의
shipping_code를 저장. DELIVERED 전환 시 PUT /api/v2/admin/shipments의
shipping_code 파라미터로 사용.

Revision ID: 014
Revises: 013
Create Date: 2026-06-11
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '014'
down_revision: Union[str, Sequence[str], None] = '013'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'order_items',
        sa.Column(
            'cafe24_shipping_code',
            sa.String(100),
            nullable=True,
            comment='Cafe24 배송번호 (YEARLY import 시 POST standby 응답의 shipping_code)',
        ),
    )


def downgrade() -> None:
    op.drop_column('order_items', 'cafe24_shipping_code')
