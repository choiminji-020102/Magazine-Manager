from sqlalchemy import Column, BigInteger, String, DateTime, Integer, Text, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(BigInteger, primary_key=True, autoincrement=True)

    external_order_item_id = Column(String(100), nullable=True, comment="외부 주문 품목 ID")

    order_id = Column(BigInteger, ForeignKey("orders.order_id"), nullable=False, comment="주문 ID")

    address_id = Column(BigInteger, ForeignKey("addresses.address_id"), nullable=False, comment="품목 배송지 ID")

    product_code = Column(String(50), nullable=False, comment="상품 코드")
    product_kind = Column(Enum("YEARLY", "MONTHLY", name="product_kind_enum"), nullable=False, comment="상품종류")
    product_name = Column(String(255), nullable=False, comment="상품명")

    list_price = Column(Integer, nullable=False, server_default="0", comment="정가")
    sale_price = Column(Integer, nullable=False, server_default="0", comment="판매가")
    refund_amount = Column(Integer, nullable=False, server_default="0", comment="환불액")
    order_num = Column(Integer, nullable=False, server_default="1", comment="수량")

    subscribe_start_issue = Column(String(6), nullable=False, comment="구독 시작 호(202604) — 주문 시 1회 설정 후 절대 수정 불가")
    subscribe_end_issue = Column(String(6), nullable=False, comment="구독 종료 호(202604) — 주문 시 1회 설정 후 절대 수정 불가")
    final_subscribe_start_issue = Column(String(6), nullable=False, comment="최종 구독 시작 호(구독 기간 앞당기기/밀기 반영)(202604)")
    final_subscribe_end_issue = Column(String(6), nullable=False, comment="최종 구독 종료 호(연장/휴지/단축 반영)(202604)")
    paid_subscribe_end_issue = Column(String(6), nullable=False, comment="유료 구독 종료 호 — 생성 시 subscribe_end_issue와 동일, 유료 연장 시에만 갱신 (환불 계산 기준)")
    subscribe_period = Column(Integer, nullable=False, server_default="12", comment="구독 기간(개월)")

    last_send_issue = Column(String(6), nullable=True, comment="마지막 발송 호(YYYYMM). YEARLY/MONTHLY 모두 기록. last_send_issue == final_subscribe_end_issue 이고 해당 Send.send_status == DELIVERED 이면 구독 완전 완료")

    admin_memo = Column(Text, nullable=True, comment="관리자 메모")

    sended_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    order = relationship(
        "Order",
        primaryjoin="OrderItem.order_id == Order.order_id",
        foreign_keys=[order_id],
        back_populates="items"
    )
    pauses = relationship(
        "Pause",
        primaryjoin="OrderItem.order_item_id == Pause.order_item_id",
        foreign_keys="Pause.order_item_id",
        back_populates="order_item",
        lazy="select"
    )
    address = relationship(
        "Address",
        primaryjoin="OrderItem.address_id == Address.address_id",
        foreign_keys=[address_id],
        lazy="joined"
    )
    send_items = relationship(
        "SendItem",
        primaryjoin="OrderItem.order_item_id == SendItem.order_item_id",
        foreign_keys="SendItem.order_item_id",
        lazy="select"
    )

    __table_args__ = (
        Index("ix_order_items_order_id", "order_id"),
        Index("ix_order_items_address_id", "address_id"),
        Index("ix_order_items_product_code", "product_code"),
        Index("ix_order_items_product_kind", "product_kind"),
        Index("ix_order_items_subscribe_start_issue", "subscribe_start_issue"),
        Index("ix_order_items_final_subscribe_end_issue", "final_subscribe_end_issue"),
        Index("ix_order_items_last_send_issue", "last_send_issue"),
        Index("ix_order_items_cancelled_at", "cancelled_at"),
        Index("ix_order_items_sended_at", "sended_at"),
    )
