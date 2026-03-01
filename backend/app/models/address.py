from sqlalchemy import (
    Column,
    BigInteger,
    String,
    DateTime,
    Text,
    Boolean,
    Index,
    ForeignKey,
)
from sqlalchemy.sql import func

from app.db.base import Base


class Address(Base):
    __tablename__ = "addresses"

    address_id = Column(BigInteger, primary_key=True, autoincrement=True)

    customer_id = Column(BigInteger, ForeignKey("customers.customer_id"), nullable=False, comment="고객 ID")

    recipient_name = Column(String(50), nullable=False, comment="수령인 이름")
    recipient_phone = Column(String(20), nullable=False, comment="수령인 전화번호 (E.164 권장)")

    country_code = Column(String(2), nullable=False, default="KR", comment="국가 코드")

    postal_code = Column(String(10), nullable=False, comment="우편번호")

    address = Column(String(255), nullable=False, comment="주소")

    customer_memo = Column(Text, nullable=True, comment="고객 배송 요청 사항")
    admin_memo = Column(Text, nullable=True, comment="관리자 메모")

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_addresses_customer_id", "customer_id"),
        Index("ix_addresses_postal_code", "postal_code"),
    )
