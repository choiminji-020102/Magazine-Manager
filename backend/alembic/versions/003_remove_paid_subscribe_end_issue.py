"""order_items에서 paid_subscribe_end_issue 컬럼 삭제

Revision ID: 003
Revises: 002
Create Date: 2026-04-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, Sequence[str], None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """paid_subscribe_end_issue 컬럼 삭제"""
    op.drop_column('order_items', 'paid_subscribe_end_issue')


def downgrade() -> None:
    """paid_subscribe_end_issue 컬럼 복원"""
    op.add_column('order_items', sa.Column(
        'paid_subscribe_end_issue', sa.String(6), nullable=True, comment='유료 구독 종료 호'
    ))
