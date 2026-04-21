"""addresses 테이블에 vip1~vip6 플래그 컬럼 추가

Revision ID: 007
Revises: 006
Create Date: 2026-04-22

관리자가 해외배송/합포장/평생무상/간사 직접배송 등 특수 케이스를 배송지
단위로 표시할 수 있도록 범용 boolean 슬롯 6개를 추가한다.
각 슬롯의 실제 의미(라벨)와 활성화 여부는 파일(backend/data/vip_slots.json)
에서 관리되며, 이 테이블에는 T/F 값만 저장된다.
"""
from typing import Sequence, Union

from alembic import op


revision: str = '007'
down_revision: Union[str, Sequence[str], None] = '006'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE addresses "
        "ADD COLUMN vip1 TINYINT(1) NOT NULL DEFAULT 0, "
        "ADD COLUMN vip2 TINYINT(1) NOT NULL DEFAULT 0, "
        "ADD COLUMN vip3 TINYINT(1) NOT NULL DEFAULT 0, "
        "ADD COLUMN vip4 TINYINT(1) NOT NULL DEFAULT 0, "
        "ADD COLUMN vip5 TINYINT(1) NOT NULL DEFAULT 0, "
        "ADD COLUMN vip6 TINYINT(1) NOT NULL DEFAULT 0"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE addresses "
        "DROP COLUMN vip1, "
        "DROP COLUMN vip2, "
        "DROP COLUMN vip3, "
        "DROP COLUMN vip4, "
        "DROP COLUMN vip5, "
        "DROP COLUMN vip6"
    )
