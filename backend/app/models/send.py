from sqlalchemy import Column, BigInteger, String, DateTime, Text, Date, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Send(Base):
    __tablename__ = "sends"
    
    send_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="발송 ID")
    order_id = Column(BigInteger, nullable=False, comment="연결된 주문 ID")
    address_id = Column(BigInteger, nullable=True, comment="배송지 정보 원본 ID")
    send_date = Column(Date, nullable=True, comment="발송 날짜")
    courier_company = Column(
        Enum("CJ대한통운", "로젠택배", "우체국택배", "한진택배", "롯데택배", name="courier_company_enum"),
        nullable=True,
        comment="택배사"
    )
    tracking_no = Column(String(50), nullable=True, comment="운송장 번호")
    send_status = Column(
        Enum("PREPARING", "SHIPPED", "DELIVERED", "CANCELLED", name="send_status_enum"),
        nullable=False,
        default="PREPARING",
        comment="발송 상태"
    )
    send_memo = Column(Text, nullable=True, comment="배송 특이사항 (내부 기록용)")
    address_name = Column(String(100), nullable=False, comment="수령인 이름 (스냅샷)")
    phone = Column(String(20), nullable=False, comment="수령인 연락처 (스냅샷)")
    nation = Column(String(50), nullable=False, default="대한민국", comment="국가명 (스냅샷)")
    postal_code = Column(String(10), nullable=False, comment="우편번호 (스냅샷)")
    address = Column(String(500), nullable=False, comment="주소 (스냅샷)")
    address_memo = Column(Text, nullable=True, comment="배송 메시지 (스냅샷)")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    cancelled_at = Column(DateTime, nullable=True, comment="취소 일시")
    
    # Relationships
    order = relationship(
        "Order",
        primaryjoin="Send.order_id == Order.order_id",
        foreign_keys=[order_id],
        back_populates="sends"
    )
    items = relationship(
        "SendItem",
        primaryjoin="Send.send_id == SendItem.send_id",
        foreign_keys="SendItem.send_id",
        back_populates="send",
        lazy="dynamic"
    )
