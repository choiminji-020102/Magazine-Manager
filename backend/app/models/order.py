from sqlalchemy import Column, String, DateTime, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT, INTEGER
import enum

from app.db.base import Base

class OrderChannel(str, enum.Enum):
    CAFE24 = "CAFE24"
    GPMALL = "GPMALL"
    OFFLINE = "OFFLINE"


class OrderStatus(str, enum.Enum):
    ORDERED = "ORDERED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"
    SHIPPING = "SHIPPING"
    COMPLETED = "COMPLETED"


class Order(Base):
    __tablename__ = "orders"

    order_id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    customer_id = Column(BIGINT(unsigned=True), nullable=False, index=True)
    external_order_id = Column(String(50), nullable=True, unique=True)

    order_channel = Column(Enum(OrderChannel, native_enum=False), nullable=False, index=True)
    order_status = Column(Enum(OrderStatus, native_enum=False), nullable=False, default=OrderStatus.ORDERED)

    total_amount = Column(INTEGER(unsigned=True), nullable=False, default=0)
    discount_amount = Column(INTEGER(unsigned=True), nullable=True, default=0)
    refund_amount = Column(INTEGER(unsigned=True), nullable=True, default=0)
    send_fee = Column(INTEGER(unsigned=True), nullable=True, default=0)
    payment_amount = Column(INTEGER(unsigned=True), nullable=False, default=0)
    payment_method = Column(String(30), nullable=True)

    address_id = Column(BIGINT(unsigned=True), nullable=True)

    request_memo = Column(Text, nullable=True)
    admin_memo = Column(Text, nullable=True)

    order_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    payment_at = Column(DateTime, nullable=True, index=True)
    cancelled_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    customer = relationship(
        "Customer",
        primaryjoin="Order.customer_id == Customer.customer_id",
        foreign_keys=[customer_id],
        lazy="joined"
    )
    address = relationship(
        "Address",
        primaryjoin="Order.address_id == Address.address_id",
        foreign_keys=[address_id],
        lazy="joined"
    )
    items = relationship(
        "OrderItem",
        primaryjoin="Order.order_id == OrderItem.order_id",
        foreign_keys="OrderItem.order_id",
        back_populates="order",
        lazy="dynamic"
    )
    sends = relationship(
        "Send",
        primaryjoin="Order.order_id == Send.order_id",
        foreign_keys="Send.order_id",
        back_populates="order",
        lazy="dynamic"
    )