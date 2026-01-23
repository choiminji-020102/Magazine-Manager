from sqlalchemy import Column, String, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT

from app.db.base import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    log_id = Column(BIGINT, primary_key=True, autoincrement=True, comment="로그 ID")
    admin_id = Column(BIGINT, nullable=True, index=True, comment="관리자 ID")
    admin_name = Column(String(50), nullable=True, comment="관리자 이름")
    action = Column(String(50), nullable=False, index=True, comment="액션")
    target_type = Column(String(50), nullable=False, index=True, comment="대상 타입")
    target_id = Column(BIGINT, nullable=True, index=True, comment="대상 ID")
    target_name = Column(String(255), nullable=True, comment="대상 이름")
    details = Column(JSON, nullable=True, comment="상세 정보")
    ip_address = Column(String(45), nullable=True, comment="IP 주소")
    user_agent = Column(String(500), nullable=True, comment="User Agent")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True, comment="생성 일시")