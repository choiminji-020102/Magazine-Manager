from sqlalchemy import Column, BigInteger, String, DateTime, Text
from sqlalchemy.sql import func

from app.db.base import Base


class Cafe24Token(Base):
    __tablename__ = "cafe24_tokens"

    cafe24_token_id = Column(BigInteger, primary_key=True, autoincrement=True)

    access_token = Column(Text, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    refresh_token = Column(Text, nullable=True)
    refresh_token_expires_at = Column(DateTime, nullable=True)

    client_id = Column(String(100), nullable=True)
    mall_id = Column(String(100), nullable=True)
    user_id = Column(String(100), nullable=True)

    scopes = Column(Text, nullable=False, server_default="[]")

    issued_at = Column(DateTime, nullable=True)
    shop_no = Column(String(30), nullable=True)
    token_type = Column(String(30), nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
