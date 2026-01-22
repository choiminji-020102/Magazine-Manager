from sqlalchemy import Column, String, Boolean, DateTime, Enum
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT

from app.db.base import Base


class Admin(Base):
    __tablename__ = "admins"
    admin_id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True, comment="관리자 ID")
    email = Column(String(100), nullable=False, unique=True, comment="이메일(로그인 ID)")
    hashed_password = Column(String(255), nullable=False, comment="암호화된 비밀번호")
    admin_name = Column(String(50), nullable=False, comment="관리자 이름")
    admin_role = Column(Enum("SUPER_ADMIN", "ADMIN", "MANAGER", name="admin_role_enum", native_enum=False), nullable=False, default="MANAGER", comment="권한 등급")
    is_active = Column(Boolean, nullable=False, default=True, comment="계정 활성 여부")
    last_login_at = Column(DateTime, nullable=True, comment="마지막 로그인 일시")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True, comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment="수정 일시")
    deleted_at = Column(DateTime, nullable=True, index=True, comment="삭제 일시")
