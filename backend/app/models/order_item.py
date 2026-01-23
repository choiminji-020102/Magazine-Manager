import enum
from sqlalchemy import Column, String, DateTime, Text, Enum
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT, INTEGER
from sqlalchemy.orm import relationship

from app.db.base import Base


class ProductKind(str, enum.Enum):
    YEARLY = "YEARLY"
    MONTHLY = "MONTHLY"
    SINGLE = "SINGLE"


class OrderItem(Base):
    __tablename__ = "order_items"

    order_item_id = Column(BIGINT, primary_key=True, autoincrement=True)

    external_order_item_id = Column(String(100), nullable=True)

    order_id = Column(BIGINT, nullable=False, index=True)

    product_code = Column(String(50), nullable=False, index=True)

    product_kind = Column(
        Enum(ProductKind, native_enum=False),
        nullable=False,
        index=True,
    )

    product_name = Column(String(255), nullable=False)

    price = Column(INTEGER, nullable=True, default=0)
    sale = Column(INTEGER, nullable=True, default=0)
    refund = Column(INTEGER, nullable=True, default=0)
    order_num = Column(INTEGER, nullable=True, default=1)

    subscribe_start_issue = Column(String(10), nullable=True, index=True)
    subscribe_end_issue = Column(String(10), nullable=True)

    subscribe_period = Column(INTEGER, nullable=True, default=12)

    last_send_issue = Column(String(10), nullable=True, index=True)
    final_subscribe_end_issue = Column(String(10), nullable=True, index=True)

    address_id = Column(BIGINT, nullable=False, index=True)

    memo = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True)
    sended_at = Column(DateTime, nullable=True, index=True)
    cancelled_at = Column(DateTime, nullable=True, index=True)
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())

    # Relationships
    order = relationship(
        "Order",
        primaryjoin="OrderItem.order_id == Order.order_id",
        foreign_keys=[order_id],
        back_populates="items",
    )

    pauses = relationship(
        "Pause",
        primaryjoin="OrderItem.order_item_id == Pause.order_item_id",
        foreign_keys="Pause.order_item_id",
        lazy="dynamic",
    )

    address = relationship(
        "Address",
        primaryjoin="OrderItem.address_id == Address.address_id",
        foreign_keys=[address_id],
        lazy="joined",
    )