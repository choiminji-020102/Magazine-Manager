from sqlalchemy import Column, BigInteger, String, DateTime, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class OrderItem(Base):
    __tablename__ = "order_items"
    
    order_item_id = Column(BigInteger, primary_key=True, autoincrement=True)
    external_order_item_id = Column(String(100), nullable=True)
    order_id = Column(BigInteger, nullable=False)
    product_code = Column(String(50), nullable=False)
    product_kind = Column(String(20), nullable=False)
    product_name = Column(String(255), nullable=False)
    price = Column(Integer, nullable=True, default=0)
    sale = Column(Integer, nullable=True, default=0)
    refund = Column(Integer, nullable=True, default=0, comment="환불액")
    order_num = Column(Integer, nullable=True, default=1)
    subscribe_start_issue = Column(String(10), nullable=True)
    subscribe_end_issue = Column(String(10), nullable=True)
    subscribe_period = Column(Integer, nullable=True, default=12, comment="구독 기간(개월)")
    last_send_issue = Column(String(10), nullable=True)
    final_subscribe_end_issue = Column(String(10), nullable=True)
    address_id = Column(BigInteger, nullable=False)
    memo = Column(Text, nullable=True, comment="메모")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    sended_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
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
        lazy="dynamic"
    )
    address = relationship(
        "Address",
        primaryjoin="OrderItem.address_id == Address.address_id",
        foreign_keys=[address_id],
        lazy="joined"
    )
