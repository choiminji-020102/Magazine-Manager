from sqlalchemy import Column, BigInteger, String, DateTime, Text, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Send(Base):
    __tablename__ = "sends"

    send_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="발송 ID")
    address_id = Column(BigInteger, ForeignKey("addresses.address_id"), nullable=True, comment="배송지 ID (스냅샷 연결용)")

    send_status = Column(Enum("PREPARING", "SHIPPING", "DELIVERED", "CANCELLED", name="send_status_enum"), nullable=False, comment="발송 상태")
    send_method = Column(Enum("기출유우편", "기출유택배", "일반우편", "찾아가기", name="send_method_enum"), nullable=True, comment="발송 방법")
    courier_company = Column(Enum("CJ대한통운", "자체배송", name="courier_company_enum"), nullable=True, comment="택배사")

    tracking_no = Column(String(50), nullable=True, comment="운송장 번호")

    recipient_name = Column(String(100), nullable=False, comment="수령인 이름 (스냅샷)")
    recipient_phone = Column(String(20), nullable=False, comment="수령인 연락처 (스냅샷)")
    country_code = Column(String(2), nullable=False, server_default="KR", comment="국가 코드 (스냅샷)")
    postal_code = Column(String(10), nullable=False, comment="우편번호 (스냅샷)")
    recipient_address = Column(String(500), nullable=False, comment="주소 (스냅샷)")
    customer_memo = Column(Text, nullable=True, comment="고객 배송 요청 사항 (스냅샷)")

    admin_memo = Column(Text, nullable=True, comment="관리자 메모")

    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True, comment="취소 일시")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")

    # Relationships
    address = relationship(
        "Address",
        primaryjoin="Send.address_id == Address.address_id",
        foreign_keys=[address_id],
        lazy="select"
    )
    items = relationship(
        "SendItem",
        primaryjoin="Send.send_id == SendItem.send_id",
        foreign_keys="SendItem.send_id",
        back_populates="send",
        lazy="select"
    )

    __table_args__ = (
        Index("ix_sends_send_status", "send_status"),
        Index("ix_sends_postal_code", "postal_code"),
    )
