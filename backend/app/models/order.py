from sqlalchemy import Column, BigInteger, String, DateTime, Integer, Text, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Order(Base):
    __tablename__ = "orders"

    order_id = Column(BigInteger, primary_key=True, autoincrement=True)

    external_order_id = Column(String(50), nullable=True, comment="외부 주문 ID - Cafe24")

    customer_id = Column(BigInteger, ForeignKey("customers.customer_id"), nullable=False, comment="고객 ID")

    address_id = Column(BigInteger, ForeignKey("addresses.address_id"), nullable=False, comment="배송지 ID")

    order_channel = Column(Enum("CAFE24", "GPMALL", "OFFLINE", name="order_channel_enum"), nullable=False, comment="주문 채널")
    order_status = Column(Enum("ORDERED", "PAID", "CANCELLED", name="order_status_enum"), nullable=False, server_default="ORDERED", comment="주문 상태")
    
    total_amount = Column(Integer, nullable=False, server_default="0", comment="총 주문 금액")
    discount_amount = Column(Integer, nullable=False, server_default="0", comment="할인 금액")
    refund_amount = Column(Integer, nullable=False, server_default="0", comment="환불 금액")
    send_fee = Column(Integer, nullable=False, server_default="0", comment="배송비")
    payment_amount = Column(Integer, nullable=False, server_default="0", comment="결제 금액 (= total_amount + send_fee)")

    payment_method = Column(String(30), nullable=True, comment="결제 방법")
    
    customer_memo = Column(Text, nullable=True, comment="고객 메모")
    admin_memo = Column(Text, nullable=True, comment="관리자 메모")
        
    order_at = Column(DateTime, nullable=False, server_default=func.now(), comment="주문 일시")
    payment_at = Column(DateTime, nullable=True, comment="결제 일시")
    cancelled_at = Column(DateTime, nullable=True, comment="취소 일시")
    
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    
    # Relationships
    customer = relationship(
        "Customer",
        primaryjoin="Order.customer_id == Customer.customer_id",
        foreign_keys=[customer_id],
        lazy="select"
    )
    address = relationship(
        "Address",
        primaryjoin="Order.address_id == Address.address_id",
        foreign_keys=[address_id],
        lazy="select"
    )
    items = relationship(
        "OrderItem",
        primaryjoin="Order.order_id == OrderItem.order_id",
        foreign_keys="OrderItem.order_id",
        back_populates="order",
        lazy="select"
    )
    sends = relationship(
        "Send",
        primaryjoin="Order.order_id == Send.order_id",
        foreign_keys="Send.order_id",
        back_populates="order",
        lazy="select"
    )

    __table_args__ = (
        Index("ix_orders_customer_id", "customer_id"),
        Index("ix_orders_order_status", "order_status"),
    )