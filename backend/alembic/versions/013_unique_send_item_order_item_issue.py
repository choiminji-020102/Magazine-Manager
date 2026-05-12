"""send_items 에 (order_item_id, issue) UNIQUE 제약 추가

중복 SendItem 생성 방지 — race condition (두 운영자가 동시에 [발송 생성]
같은 호 클릭) 또는 코딩 실수로 같은 OrderItem 에 같은 호 SendItem 이
두 번 생성되는 것을 DB 레벨에서 차단.

`SendItem.cancelled_at` 은 현재 코드 어디서도 SET 안 함 (SELECT 필터 전용)
이므로 한 (order_item_id, issue) 가 두 행으로 존재할 일 없음 → 풀 UNIQUE 안전.

위반 시 SQLAlchemy IntegrityError → 엔드포인트가 catch 해서 409 Conflict 친절 메시지로 변환
(`dispatches.py:regenerate_preparing_sends_endpoint` / `add_to_preparing_yearly_endpoint` /
`send_items.py:create_send_item` 3곳).

Revision ID: 013
Revises: 012
Create Date: 2026-05-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '013'
down_revision: Union[str, Sequence[str], None] = '012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 안전망 — 운영 DB 가 비어있다는 전제(PLAN §3 (다))지만, 만약 기존에 (order_item_id, issue)
    # 중복 행이 남아있으면 UNIQUE 생성이 silent 하게 실패할 수 있어 사전 검사.
    bind = op.get_bind()
    duplicates = bind.execute(
        sa.text(
            "SELECT order_item_id, issue, COUNT(*) AS cnt "
            "FROM send_items GROUP BY order_item_id, issue HAVING COUNT(*) > 1"
        )
    ).fetchall()
    if duplicates:
        raise RuntimeError(
            f"send_items 에 (order_item_id, issue) 중복 행이 {len(duplicates)} 그룹 존재. "
            f"수동 정리 후 다시 실행하세요. 샘플: {duplicates[:3]}"
        )

    op.create_unique_constraint(
        "uq_send_items_order_item_issue",
        "send_items",
        ["order_item_id", "issue"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_send_items_order_item_issue",
        "send_items",
        type_="unique",
    )
