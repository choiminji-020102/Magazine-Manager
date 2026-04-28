"""send_status enum에 PREPARING 다시 추가

마이그레이션 009에서 PREPARING을 enum에서 제거했지만, SHIPPING_REFACTOR_PLAN.md의
새 흐름에서는 [발송 생성] 단계에서 PREPARING Send를 만들기 때문에 다시 필요.

결과 enum: PREPARING / SHIPPING / DELIVERED / CANCELLED.
default는 명시적으로 두지 않음 (항상 호출 코드에서 명시).

Revision ID: 010
Revises: 009
Create Date: 2026-04-26

"""
from typing import Sequence, Union

from alembic import op


revision: str = '010'
down_revision: Union[str, Sequence[str], None] = '009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL "
        "COMMENT '발송 상태'"
    )


def downgrade() -> None:
    # PREPARING 행이 있으면 enum 축소가 실패하므로 SHIPPING으로 임시 변환
    op.execute("UPDATE sends SET send_status = 'SHIPPING' WHERE send_status = 'PREPARING'")
    op.execute(
        "ALTER TABLE sends MODIFY COLUMN send_status "
        "ENUM('SHIPPING', 'DELIVERED', 'CANCELLED') NOT NULL "
        "COMMENT '발송 상태'"
    )
