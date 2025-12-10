# 표준 라이브러리
from enum import Enum as PyEnum

# 서드파티 라이브러리
from sqlalchemy import Boolean, Column, DateTime, Enum, Integer, String, func

# 로컬 애플리케이션
from app.db.base import Base

class AdminRole(PyEnum):
    SUPER_ADMIN = "SUPER_ADMIN"
    ADMIN = "ADMIN"
    MANAGER = "MANAGER"

# Admin 클래스는 database의 admins_mj 테이블과 매핑된다.
class Admin(Base):
    __tablename__ = "admins_mj"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    name = Column(String(100), nullable=False)
    role = Column(Enum(AdminRole), nullable=False, default=AdminRole.MANAGER)
    is_active = Column(Boolean, nullable=False, default=True)

    # timezone=True 사용 -> 이 필드는 타임존 정보를 포함한 aware datetime을 저장하도록 함.
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True) # Soft delete용 컬럼

    def __repr__(self):
        return (
            f"<Admin(id={self.id}, email={self.email}, "
            f"role={self.role}, is_active={self.is_active}, deleted_at={self.deleted_at})>"
        )