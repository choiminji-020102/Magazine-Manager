from sqlalchemy import Column, BigInteger, String, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Pause(Base):
    __tablename__ = "pauses"

    pause_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="휴지 ID")

    order_item_id = Column(BigInteger, ForeignKey("order_items.order_item_id"), nullable=False, comment="연결된 주문 품목 ID")
    pause_issue = Column(String(6), nullable=False, comment="중단 호(202604)")

    reason = Column(Text, nullable=True, comment="고객 요청 사유")
    admin_id = Column(BigInteger, ForeignKey("admins.admin_id"), nullable=False, comment="처리 관리자 ID")

    is_deleted = Column(Boolean, nullable=False, server_default="0", comment="삭제 여부(소프트 삭제)")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    deleted_at = Column(DateTime, nullable=True, comment="삭제 일시")

    # Relationships
    order_item = relationship(
        "OrderItem",
        primaryjoin="Pause.order_item_id == OrderItem.order_item_id",
        foreign_keys=[order_item_id],
        back_populates="pauses"
    )
    admin = relationship(
        "Admin",
        primaryjoin="Pause.admin_id == Admin.admin_id",
        foreign_keys=[admin_id],
        lazy="select"
    )

    __table_args__ = (
        Index("ix_pauses_order_item_id", "order_item_id"),
        Index("ix_pauses_pause_issue", "pause_issue"),
        Index("ix_pauses_admin_id", "admin_id"),
        Index("ix_pauses_deleted_at", "deleted_at"),
        Index("ix_pauses_issue_deleted", "pause_issue", "deleted_at"),
    )
