from enum import Enum as PyEnum

from sqlalchemy import Column, BigInteger, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func

from app.db.base import Base


class AdminRole(str, PyEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"


class Admin(Base):
    __tablename__ = "admins"
    
    admin_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="관리자 ID")

    admin_email = Column(String(254), nullable=False, unique=True, comment="관리자 이메일 (로그인 ID)")
    admin_password = Column(String(255), nullable=False, comment="해시된 비밀번호")

    admin_name = Column(String(50), nullable=False, comment="관리자 이름")
    admin_role = Column(Enum("SUPER_ADMIN", "ADMIN", "MANAGER", name="admin_role_enum"), nullable=False, server_default="MANAGER", comment="관리자 권한")
    
    is_active = Column(Boolean, nullable=False, server_default="1", comment="활성 상태")
    is_deleted = Column(Boolean, nullable=False, server_default="0", comment="삭제 여부")

    last_login_at = Column(DateTime, nullable=True, comment="마지막 로그인 일시")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    deleted_at = Column(DateTime, nullable=True, comment="삭제 일시")
