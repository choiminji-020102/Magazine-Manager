from sqlalchemy import Column, BigInteger, String, DateTime
from sqlalchemy.sql import func

from app.db.base import Base

class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    
    refresh_token_id = Column(BigInteger, primary_key=True, autoincrement=True)
    admin_id = Column(BigInteger, nullable=False)
    token = Column(String(512), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False, comment="만료 일시")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    revoked_at = Column(DateTime, nullable=True, comment="폐기 일시")
