# app/models/refresh_token.py

# 표준 라이브러리
from datetime import datetime

# 서드파티 라이브러리
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

# 로컬 애플리케이션
from app.db.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_token_mj"

    id = Column(Integer, primary_key=True, index=True)

    # 어떤 관리자의 토큰인지
    admin_id = Column(Integer, ForeignKey("admins_mj.id"), nullable=False, index=True)
    admin = relationship("Admin", backref="refresh_token")

    # 실제 JWT 문자열 (보안 상 해시를 저장하는 방식도 있음. 여기선 단순화를 위해 그대로 저장)
    token = Column(String(512), nullable=False, unique=True, index=True)

    # 만료 시각 (JWT exp와 일치시켜 두면 관리하기 좋음)
    expires_at = Column(DateTime, nullable=False)

    # 폐기/회전 관리용
    is_revoked = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime, nullable=True)
