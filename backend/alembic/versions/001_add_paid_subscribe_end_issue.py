"""add paid_subscribe_end_issue to order_items

Revision ID: 001
Revises:
Create Date: 2026-03-19

"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'order_items',
        sa.Column(
            'paid_subscribe_end_issue',
            sa.String(6),
            nullable=False,
            server_default='000000',
            comment='유료 구독 종료 호 — 생성 시 subscribe_end_issue와 동일, 유료 연장 시에만 갱신 (환불 계산 기준)',
        ),
    )
    # server_default 제거 (신규 레코드에서 불필요)
    op.alter_column('order_items', 'paid_subscribe_end_issue', server_default=None)

    # 기존 데이터: subscribe_end_issue 값으로 채움
    op.execute(
        "UPDATE order_items SET paid_subscribe_end_issue = subscribe_end_issue"
    )


def downgrade() -> None:
    op.drop_column('order_items', 'paid_subscribe_end_issue')
