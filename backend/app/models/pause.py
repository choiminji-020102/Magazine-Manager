from sqlalchemy import Column, String, DateTime, Text
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT

from app.db.base import Base


class Pause(Base):
    __tablename__ = "pauses"
    
    pause_id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True, comment="휴지 구간 고유 ID")
    order_item_id = Column(BIGINT(unsigned=True), nullable=False, index=True, comment="연결된 주문 품목 ID")
    pause_issue = Column(String(20), nullable=False, index=True, comment="중단하는 호")
    reason = Column(Text, nullable=True, comment="고객 요청 사유")
    admin_id = Column(BIGINT(unsigned=True), nullable=True, index=True, comment="처리한 관리자 ID")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True, comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    deleted_at = Column(DateTime, nullable=True, index=True, comment="삭제 일시")
