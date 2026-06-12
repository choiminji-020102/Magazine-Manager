"""order_items.sended_at → delivered_at 컬럼 리네임

Send.delivered_at과 의미·시점이 동일한 비정규화 필드이므로 이름을 통일.
인덱스도 함께 재생성.

Revision ID: 015
Revises: 014
Create Date: 2026-06-13
"""
from typing import Sequence, Union

from alembic import op


revision: str = '015'
down_revision: Union[str, Sequence[str], None] = '014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index('ix_order_items_sended_at', table_name='order_items')
    op.alter_column('order_items', 'sended_at', new_column_name='delivered_at')
    op.create_index('ix_order_items_delivered_at', 'order_items', ['delivered_at'])


def downgrade() -> None:
    op.drop_index('ix_order_items_delivered_at', table_name='order_items')
    op.alter_column('order_items', 'delivered_at', new_column_name='sended_at')
    op.create_index('ix_order_items_sended_at', 'order_items', ['sended_at'])
