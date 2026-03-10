from sqlalchemy import Column, BigInteger, String, DateTime, Text, Enum, ForeignKey, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class Inquiry(Base):
    __tablename__ = "inquiries"

    inquiry_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="문의 ID")
    customer_id = Column(BigInteger, ForeignKey("customers.customer_id"), nullable=False, comment="고객 ID")
    inquiry_type = Column(Enum("PHONE", "EMAIL", "KAKAO", "VISIT", "OTHER", name="inquiry_type_enum"), nullable=False, server_default="PHONE", comment="문의 유형")
    inquiry_category = Column(String(50), nullable=True, comment="문의 분류")
    title = Column(String(200), nullable=True, comment="문의 제목")
    content = Column(Text, nullable=True, comment="문의 내용")
    answer = Column(Text, nullable=True, comment="답변 내용")
    inquiry_status = Column(Enum("RECEIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", name="inquiry_status_enum"), nullable=False, server_default="RECEIVED", comment="처리 상태")
    order_id = Column(BigInteger, ForeignKey("orders.order_id"), nullable=True, comment="관련 주문 ID")
    order_item_id = Column(BigInteger, ForeignKey("order_items.order_item_id"), nullable=True, comment="관련 주문품목 ID")
    handled_by = Column(BigInteger, ForeignKey("admins.admin_id"), nullable=True, comment="담당 관리자 ID")
    handled_at = Column(DateTime, nullable=True, comment="처리 완료 일시")

    is_deleted = Column(Boolean, nullable=False, server_default="0", comment="삭제 여부(소프트 삭제)")
    deleted_at = Column(DateTime, nullable=True, comment="삭제 일시")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")

    # Relationships (InquiryDetailResponse에서 customer, order, handler 중첩 객체 필요)
    customer = relationship(
        "Customer",
        primaryjoin="Inquiry.customer_id == Customer.customer_id",
        foreign_keys=[customer_id],
        lazy="select"
    )
    order = relationship(
        "Order",
        primaryjoin="Inquiry.order_id == Order.order_id",
        foreign_keys=[order_id],
        lazy="select"
    )
    handler = relationship(
        "Admin",
        primaryjoin="Inquiry.handled_by == Admin.admin_id",
        foreign_keys=[handled_by],
        lazy="select"
    )

    __table_args__ = (
        Index("ix_inquiries_customer_id", "customer_id"),
        Index("ix_inquiries_inquiry_status", "inquiry_status"),
    )
