"""shipping refactor: send 모델 전면 변경

- sends.order_id FK + 컬럼 제거 (관계는 SendItem→OrderItem→Order로 파생)
- sends.official_send_date 컬럼 제거 (SHIPPING 시점 = Send 생성 시점이라 무의미)
- sends.prepared_at 컬럼 제거 (PREPARING 단계 자체가 사라짐)
- sends.send_method 컬럼 신규 (기출유우편/기출유택배/일반우편/찾아가기)
- sends.courier_company enum 축소 (4값 → CJ대한통운/자체배송 2값)
- sends.send_status enum에서 PREPARING 제거 + default 제거

현재 sends/send_items 운영 데이터가 비어있으므로 enum 축소·NOT NULL 추가 모두 안전.

Revision ID: 009
Revises: 008
Create Date: 2026-04-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '009'
down_revision: Union[str, Sequence[str], None] = '008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. sends.order_id FK + 인덱스 + 컬럼 제거
    op.drop_constraint('sends_ibfk_1', 'sends', type_='foreignkey')
    op.drop_index('ix_sends_order_id', table_name='sends')
    op.drop_column('sends', 'order_id')

    # 2. sends.official_send_date 제거
    op.drop_column('sends', 'official_send_date')

    # 3. sends.prepared_at 제거
    op.drop_column('sends', 'prepared_at')

    # 4. sends.send_method 신규
    op.execute(
        "ALTER TABLE sends ADD COLUMN send_method "
        "ENUM('기출유우편', '기출유택배', '일반우편', '찾아가기') NULL "
        "COMMENT '발송 방법'"
    )

    # 5. sends.courier_company enum 축소 (현재 운영 데이터 비어있음 — 안전)
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN courier_company "
        "ENUM('CJ대한통운', '자체배송') NULL "
        "COMMENT '택배사'"
    )

    # 6. sends.send_status enum에서 PREPARING 제거 + default 제거
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL "
        "COMMENT '발송 상태'"
    )


def downgrade() -> None:
    # 6. send_status 복원
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PREPARING' "
        "COMMENT '발송 상태'"
    )

    # 5. courier_company 복원
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN courier_company "
        "ENUM('CJ대한통운', '기출유우편', '일반우편', '찾아가기') NULL "
        "COMMENT '택배사/배송수단'"
    )

    # 4. send_method 제거
    op.drop_column('sends', 'send_method')

    # 3. prepared_at 복원
    op.add_column('sends', sa.Column('prepared_at', sa.DateTime(), nullable=True))

    # 2. official_send_date 복원
    op.add_column(
        'sends',
        sa.Column(
            'official_send_date',
            sa.Date(),
            nullable=True,
            comment='YEARLY 전용 공식 발송일.',
        ),
    )

    # 1. order_id 복원
    op.add_column(
        'sends',
        sa.Column('order_id', sa.BigInteger(), nullable=False, comment='연결된 주문 ID'),
    )
    op.create_index('ix_sends_order_id', 'sends', ['order_id'])
    op.create_foreign_key('sends_ibfk_1', 'sends', 'orders', ['order_id'], ['order_id'])
