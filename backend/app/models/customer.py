import re
from enum import Enum as PyEnum

from sqlalchemy import Column, BigInteger, String, DateTime, Text, CHAR, Enum, Boolean, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Channel(str, PyEnum):
    CAFE24 = "CAFE24"
    GPMALL = "GPMALL"
    OFFLINE = "OFFLINE"


class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("customer_phone", "customer_name", name="uq_customer_phone_name"),
    )

    customer_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="고객 ID")
    create_channel = Column(Enum("CAFE24", "GPMALL", "OFFLINE", name="create_channel_enum"), nullable=False, server_default="OFFLINE", comment="유입 경로")

    customer_phone = Column(String(20), nullable=False, comment="고객 연락처 (정규화 포맷 저장 권장)")
    customer_phone_num4 = Column(CHAR(4), nullable=False, server_default="", comment="연락처 뒤 4자리 (검색/확인용)")

    customer_email = Column(String(254), nullable=True, comment="고객 이메일")
    customer_name = Column(String(50), nullable=False)

    is_active = Column(Boolean, nullable=False, server_default="1", comment="활성 상태")
    is_deleted = Column(Boolean, nullable=False, server_default="0", comment="삭제 여부(소프트 삭제)")

    admin_memo = Column(Text, nullable=True, comment="관리자 메모")

    last_order_at = Column(DateTime, nullable=True, comment="마지막 주문 일시")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    deleted_at = Column(DateTime, nullable=True, comment="삭제 일시")

    # Relationships (CustomerDetailResponse: recent_orders, addresses 중첩 객체)
    orders = relationship(
        "Order",
        primaryjoin="Customer.customer_id == Order.customer_id",
        foreign_keys="Order.customer_id",
        lazy="select"
    )
    addresses = relationship(
        "Address",
        primaryjoin="Customer.customer_id == Address.customer_id",
        foreign_keys="Address.customer_id",
        lazy="select"
    )

    @staticmethod
    def extract_phone_num4(phone: str) -> str:
        digits = re.sub(r'[^0-9]', '', phone)
        return digits[-4:] if len(digits) >= 4 else digits
