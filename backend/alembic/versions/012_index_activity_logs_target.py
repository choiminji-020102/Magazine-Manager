"""activity_logs 에 (target_type, target_id, action) 복합 인덱스 추가

target_type / target_id / action 으로 좁혀 RESEND 등 활동 로그를 조회하는
요청이 잦음 (DeliveredSendListPage 의 재배송 배지, OrderDetailPanel 의 재배송
이력 등). 누적 데이터 시 풀 테이블 스캔 방지를 위한 복합 인덱스.

조회 패턴: WHERE target_type = ? AND target_id IN (...) AND action = ?
복합 인덱스 컬럼 순서: target_type → target_id → action (좌측 prefix 활용
가능 — target_type 만으로도 쓸 수 있고, target_type+target_id 조합도 가능).

Revision ID: 012
Revises: 011
Create Date: 2026-05-06

"""
from typing import Sequence, Union

from alembic import op


revision: str = '012'
down_revision: Union[str, Sequence[str], None] = '011'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_activity_logs_target_action",
        "activity_logs",
        ["target_type", "target_id", "action"],
    )


def downgrade() -> None:
    op.drop_index("idx_activity_logs_target_action", table_name="activity_logs")
