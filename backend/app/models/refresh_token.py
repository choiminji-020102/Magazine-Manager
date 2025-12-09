# 표준 라이브러리
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, func

# 로컬 애플리케이션
from app.db.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_token_mj"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("admins_mj.id"), nullable=False, index=True)  # 어떤 관리자의 토큰인지
    token = Column(String(512), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime, nullable=True)  # 폐기 시간
