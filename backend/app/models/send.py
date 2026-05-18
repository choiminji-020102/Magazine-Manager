from sqlalchemy import Column, BigInteger, String, DateTime, Text, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Send(Base):
    __tablename__ = "sends"

    send_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="발송 ID")
    address_id = Column(BigInteger, ForeignKey("addresses.address_id"), nullable=True, comment="배송지 ID (스냅샷 연결용)")

    # 'CANCELLED' 값은 현재 dead — 발송 취소 기능 미구현으로 어디서도 세팅되지 않음 (cancelled_at 컬럼 주석 참조).
    send_status = Column(Enum("PREPARING", "DELIVERED", "CANCELLED", name="send_status_enum"), nullable=False, comment="발송 상태")
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

    delivered_at = Column(DateTime, nullable=True)
    # dead — 발송 취소 기능 미구현. 백엔드 어디서도 세팅되지 않음. send_status='CANCELLED' 값도 동일하게 미구현.
    # 현재 취소 흐름은 PREPARING SendItem hard delete (send_service.delete_preparing_send_items_for_order_items) 경로만 존재.
    # 향후 발송 취소 기능 도입 시 본 컬럼·enum 값·dispatch_grouping_service 의 방어 필터를 함께 활성화.
    cancelled_at = Column(DateTime, nullable=True, comment="취소 일시 (dead — 미구현)")

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

    @property
    def order_ids(self) -> list[int]:
        # SendItem → OrderItem 경유로 이 Send에 묶인 모든 주문 ID (distinct, 정렬)
        seen: set[int] = set()
        result: list[int] = []
        for si in self.items or []:
            if si.cancelled_at is not None:
                continue
            oi = si.order_item
            if oi is None or oi.order_id in seen:
                continue
            seen.add(oi.order_id)
            result.append(oi.order_id)
        return sorted(result)

    @property
    def related_orders(self) -> list[dict]:
        # SendItem → OrderItem → Order → Customer 경유로 묶인 주문 정보 (distinct, order_id 정렬).
        # OrderDetailPanel 에서 "함께 묶인 주문" 표시용 — 자기 주문 제외는 프론트가 처리.
        seen: set[int] = set()
        result: list[dict] = []
        for si in self.items or []:
            if si.cancelled_at is not None:
                continue
            oi = si.order_item
            if oi is None or oi.order_id in seen:
                continue
            order = oi.order
            if order is None or order.customer is None:
                continue
            seen.add(oi.order_id)
            result.append({
                "order_id": oi.order_id,
                "customer_name": order.customer.customer_name,
                "customer_phone": order.customer.customer_phone,
            })
        return sorted(result, key=lambda x: x["order_id"])

    __table_args__ = (
        Index("ix_sends_send_status", "send_status"),
        Index("ix_sends_postal_code", "postal_code"),
    )
