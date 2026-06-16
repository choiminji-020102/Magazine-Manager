"""order_items.sended_at → delivered_at 컬럼 리네임

Send.delivered_at과 의미·시점이 동일한 비정규화 필드이므로 이름을 통일.
인덱스도 함께 재생성.

Revision ID: 015
Revises: 014
Create Date: 2026-06-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = '015'
down_revision: Union[str, Sequence[str], None] = '014'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(conn, table: str, index: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.statistics "
        "WHERE table_schema = DATABASE() AND table_name = :t AND index_name = :i"
    ), {"t": table, "i": index})
    return result.scalar() > 0


def _column_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(sa.text(
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.scalar() > 0


def upgrade() -> None:
    conn = op.get_bind()

    if _index_exists(conn, "order_items", "ix_order_items_sended_at"):
        op.execute("DROP INDEX ix_order_items_sended_at ON order_items")

    if _column_exists(conn, "order_items", "sended_at"):
        op.execute("ALTER TABLE order_items CHANGE sended_at delivered_at DATETIME NULL")

    if not _index_exists(conn, "order_items", "ix_order_items_delivered_at"):
        op.execute("CREATE INDEX ix_order_items_delivered_at ON order_items (delivered_at)")


def downgrade() -> None:
    conn = op.get_bind()

    if _index_exists(conn, "order_items", "ix_order_items_delivered_at"):
        op.execute("DROP INDEX ix_order_items_delivered_at ON order_items")

    if _column_exists(conn, "order_items", "delivered_at"):
        op.execute("ALTER TABLE order_items CHANGE delivered_at sended_at DATETIME NULL")

    if not _index_exists(conn, "order_items", "ix_order_items_sended_at"):
        op.execute("CREATE INDEX ix_order_items_sended_at ON order_items (sended_at)")
