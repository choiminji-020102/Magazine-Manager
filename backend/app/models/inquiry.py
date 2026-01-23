from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT

from app.db.base import Base


class Inquiry(Base):
    __tablename__ = "inquiries"
    
    inquiry_id = Column(BIGINT, primary_key=True, autoincrement=True, comment="문의 ID")
    customer_id = Column(BIGINT, nullable=False, index=True, comment="고객 ID")
    inquiry_type = Column(String(20), nullable=False, default="PHONE", index=True, comment="문의 유형")
    inquiry_category = Column(String(50), nullable=True, comment="문의 분류")
    title = Column(String(200), nullable=True, comment="문의 제목")
    content = Column(Text, nullable=True, comment="문의 내용")
    answer = Column(Text, nullable=True, comment="답변 내용")
    inquiry_status = Column(String(20), nullable=False, default="RECEIVED", index=True, comment="처리 상태")
    order_id = Column(BIGINT, nullable=True, index=True, comment="관련 주문 ID")
    order_item_id = Column(BIGINT, nullable=True, index=True, comment="관련 주문품목 ID")
    handled_by = Column(BIGINT, nullable=True, index=True, comment="담당 관리자 ID")
    handled_at = Column(DateTime, nullable=True, comment="처리 완료 일시")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True, comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")