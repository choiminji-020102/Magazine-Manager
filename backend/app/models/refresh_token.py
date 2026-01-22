from sqlalchemy import Column, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT

from app.db.base import Base


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    refresh_token_id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True)
    admin_id = Column(BIGINT(unsigned=True), nullable=False, index=True)
    token = Column(String(512), unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True, comment="만료 일시")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    revoked_at = Column(DateTime, nullable=True, comment="폐기 일시")
