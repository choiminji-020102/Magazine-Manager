from sqlalchemy import (Column, BigInteger, String, DateTime, JSON, Enum, Index)
from sqlalchemy.sql import func

from app.db.base import Base
from app.schemas.activity_log import ActivityAction, ActivityTargetType

class ActivityLog(Base):
    __tablename__ = "activity_logs"
    
    log_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="로그 ID")
    
    admin_id = Column(BigInteger, nullable=True, comment="관리자 ID")
    admin_name = Column(String(50), nullable=True, comment="관리자 이름(스냅샷)")
    
    action = Column(Enum(ActivityAction, native_enum=False), nullable=False, comment="액션")
    
    target_type = Column(Enum(ActivityTargetType, native_enum=False), nullable=False, comment="대상 타입")
    target_id = Column(BigInteger, nullable=True, comment="대상 ID")
    target_name = Column(String(255), nullable=True, comment="대상 이름(스냅샷)")
    
    ip_address = Column(String(45), nullable=True, comment="IP 주소")
    user_agent = Column(String(512), nullable=True, comment="User Agent")

    details = Column(JSON, nullable=True, comment="로그 상세 정보")
    
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")

    __table_args__ = (
        Index("idx_admin_id", "admin_id"),
    )