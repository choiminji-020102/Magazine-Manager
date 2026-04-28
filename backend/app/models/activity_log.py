from enum import Enum

from sqlalchemy import Column, BigInteger, String, DateTime, JSON, Enum as SAEnum, Index, ForeignKey
from sqlalchemy.sql import func

from app.db.base import Base


class ActivityAction(str, Enum):
    """활동 로그 액션 타입"""
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    ACTIVATE = "ACTIVATE"
    DEACTIVATE = "DEACTIVATE"
    RESTORE = "RESTORE"
    CANCEL = "CANCEL"
    DISPATCH = "DISPATCH"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    SIGNUP = "SIGNUP"
    ANSWER = "ANSWER"
    RESEND = "RESEND"


class ActivityTargetType(str, Enum):
    """활동 로그 대상 타입 (DB 테이블과 1:1 매칭, 복수형 금지)"""
    ACTIVITY_LOG = "ACTIVITY_LOG"
    ADDRESS = "ADDRESS"
    ADMIN = "ADMIN"
    AUTH = "AUTH"
    CAFE24 = "CAFE24"
    CUSTOMER = "CUSTOMER"
    INQUIRY = "INQUIRY"
    ORDER_ITEM = "ORDER_ITEM"
    ORDER = "ORDER"
    PAUSE = "PAUSE"
    PRODUCT = "PRODUCT"
    # REFRESH_TOKEN = "REFRESH_TOKEN"
    SEND_ITEM = "SEND_ITEM"
    SEND = "SEND"


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    log_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="로그 ID")

    admin_id = Column(BigInteger, ForeignKey("admins.admin_id"), nullable=True, comment="관리자 ID")
    admin_name = Column(String(50), nullable=True, comment="관리자 이름(스냅샷)")

    action = Column(SAEnum(ActivityAction, native_enum=False), nullable=False, comment="액션")

    target_type = Column(SAEnum(ActivityTargetType, native_enum=False), nullable=False, comment="대상 타입")
    target_id = Column(BigInteger, nullable=True, comment="대상 ID")
    target_name = Column(String(255), nullable=True, comment="대상 이름(스냅샷)")

    ip_address = Column(String(45), nullable=True, comment="IP 주소")
    user_agent = Column(String(512), nullable=True, comment="User Agent")

    details = Column(JSON, nullable=True, comment="로그 상세 정보")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")

    __table_args__ = (
        Index("idx_admin_id", "admin_id"),
    )
