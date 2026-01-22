from sqlalchemy import Column, String, DateTime, Text, CHAR
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT

from app.db.base import Base


class Customer(Base):
    __tablename__ = "customers"

    customer_id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True, comment="내부 고객 고유 ID")
    customer_name = Column(String(50), nullable=False, index=True, comment="고객 이름")
    customer_phone = Column(String(20), unique=True, nullable=False, comment="연락처")
    customer_phone_num4 = Column(CHAR(4), nullable=False, index=True, comment="연락처 뒷자리(고정길이)")
    customer_email = Column(String(191), nullable=True, comment="이메일")
    create_channel = Column(String(20), nullable=False, default="CAFE24", comment="유입 경로")
    admin_memo = Column(Text, nullable=True, comment="관리자 메모(특이사항)")
    last_order_at = Column(DateTime, nullable=True, index=True, comment="최근 주문 일시")
    
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True, comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment="수정 일시")
    deleted_at = Column(DateTime, nullable=True, index=True, comment="삭제 일시(소프트 삭제용)")

    @staticmethod
    def extract_phone_num4(phone: str) -> str:
        import re
        digits = re.sub(r"[^0-9]", "", phone)
        return digits[-4:] if len(digits) >= 4 else digits
