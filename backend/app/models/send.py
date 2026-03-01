from sqlalchemy import Column, BigInteger, String, DateTime, Text, Date, Enum, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Send(Base):
    __tablename__ = "sends"

    send_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="발송 ID")
    order_id = Column(BigInteger, ForeignKey("orders.order_id"), nullable=False, comment="연결된 주문 ID")
    
    send_status = Column(Enum("PREPARING", "WAITING", "SHIPPING", "DELIVERED", "CANCELLED", name="send_status_enum"), nullable=False, default="PREPARING", comment="발송 상태")
    courier_company = Column(Enum("CJ대한통운", "자체배송", name="courier_company_enum"), nullable=True, comment="택배사")
    
    tracking_no = Column(String(50), nullable=True, comment="운송장 번호")

    recipient_name = Column(String(100), nullable=False, comment="수령인 이름 (스냅샷)")
    recipient_phone = Column(String(20), nullable=False, comment="수령인 연락처 (스냅샷)")
    country_name = Column(String(50), nullable=False, default="대한민국", comment="국가명 (스냅샷)")
    postal_code = Column(String(10), nullable=False, comment="우편번호 (스냅샷)")
    address = Column(String(500), nullable=False, comment="주소 (스냅샷)")
    customer_memo = Column(Text, nullable=True, comment="고객 배송 요청 사항 (스냅샷)")
    
    admin_memo = Column(Text, nullable=True, comment="관리자 메모")

    prepared_at = Column(DateTime, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True, comment="취소 일시")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    
    official_send_date = Column(Date, nullable=True, comment="월간지 공식 발송 예정 날짜(2026-01-21)")

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
        lazy="select"
    )
