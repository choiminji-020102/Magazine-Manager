from sqlalchemy import Column, BigInteger, String, DateTime, Integer, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"
    
    order_id = Column(BigInteger, primary_key=True, autoincrement=True)
    customer_id = Column(BigInteger, nullable=False)
    external_order_id = Column(String(50), nullable=True)
    order_channel = Column(String(20), nullable=False)
    order_status = Column(String(20), nullable=False, default="ORDERED")
    total_amount = Column(Integer, nullable=False, default=0)
    discount_amount = Column(Integer, nullable=True, default=0)
    refund_amount = Column(Integer, nullable=True, default=0, comment="환불총액")
    send_fee = Column(Integer, nullable=True, default=0)
    payment_amount = Column(Integer, nullable=False, default=0)
    payment_method = Column(String(30), nullable=True)
    address_id = Column(BigInteger, nullable=True)
    request_memo = Column(Text, nullable=True)
    admin_memo = Column(Text, nullable=True)
    order_at = Column(DateTime, nullable=False, server_default=func.now())
    payment_at = Column(DateTime, nullable=True)
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