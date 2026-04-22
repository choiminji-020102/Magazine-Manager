"""courier_company enum 확장 (기출유 엑셀 플로우 지원)

기존: CJ대한통운, 자체배송
신규: CJ대한통운, 기출유우편, 일반우편, 찾아가기

Revision ID: 008
Revises: 007
Create Date: 2026-04-22

"""
from typing import Sequence, Union

from alembic import op

revision: str = '008'
down_revision: Union[str, Sequence[str], None] = '007'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 기존 '자체배송' 레코드가 남아있으면 enum 축소로 실패하므로 먼저 NULL 처리
    # (운영에서 자체배송 데이터는 삭제 예정이라 안전)
    op.execute(
        "UPDATE sends SET courier_company = NULL "
        "WHERE courier_company = '자체배송'"
    )

    op.execute(
        "ALTER TABLE sends MODIFY COLUMN courier_company "
        "ENUM('CJ대한통운', '기출유우편', '일반우편', '찾아가기') NULL "
        "COMMENT '택배사/배송수단'"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE sends SET courier_company = NULL "
        "WHERE courier_company IN ('기출유우편', '일반우편', '찾아가기')"
    )

    op.execute(
        "ALTER TABLE sends MODIFY COLUMN courier_company "
        "ENUM('CJ대한통운', '자체배송') NULL "
        "COMMENT '택배사'"
    )
