from sqlalchemy import Column, BigInteger, String, DateTime, Text
from sqlalchemy.sql import func

from app.db.base import Base

class Pause(Base):
    __tablename__ = "pauses"
    
    pause_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="휴지 구간 고유 ID")
    order_item_id = Column(BigInteger, nullable=False, comment="연결된 주문 품목 ID")
    pause_issue = Column(String(20), nullable=False, comment="중단하는 호")
    reason = Column(Text, nullable=True, comment="고객 요청 사유")
    admin_id = Column(BigInteger, nullable=True, comment="처리한 관리자 ID")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    deleted_at = Column(DateTime, nullable=True, comment="삭제 일시")
