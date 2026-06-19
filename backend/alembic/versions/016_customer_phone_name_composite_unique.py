"""customers.customer_phone 단일 unique → (customer_phone, customer_name) 복합 unique

동일 전화번호로 다른 이름(예: 본인/배우자)이 주문하는 케이스 허용.
Cafe24 import 시 phone+name 불일치로 IntegrityError 발생하던 문제 해결.

Revision ID: 016
Revises: 015
Create Date: 2026-06-19
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 기존 customer_phone 단일 unique 제약 제거 (MySQL에서 unique 인덱스명 = 컬럼명)
    op.drop_constraint("customer_phone", "customers", type_="unique")
    # (customer_phone, customer_name) 복합 unique 추가
    op.create_unique_constraint("uq_customer_phone_name", "customers", ["customer_phone", "customer_name"])


def downgrade() -> None:
    op.drop_constraint("uq_customer_phone_name", "customers", type_="unique")
    op.create_unique_constraint("customer_phone", "customers", ["customer_phone"])
