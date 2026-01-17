from sqlalchemy import Column, BigInteger, String, DateTime, Text
from sqlalchemy.sql import func

from app.core.database import Base


class Address(Base):
    __tablename__ = "addresses"
    
    address_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="배송지 ID")
    customer_id = Column(BigInteger, nullable=True, comment="고객 ID")
    address_name = Column(String(50), nullable=False, comment="수령인 이름")
    phone = Column(String(20), nullable=False, comment="수령인 연락처")
    nation = Column(String(50), nullable=False, default="대한민국", comment="국가명")
    postal_code = Column(String(10), nullable=False, comment="배송지 우편번호")
    address = Column(String(500), nullable=False, comment="주소")
    address_memo = Column(Text, nullable=True, comment="배송 특이사항")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
