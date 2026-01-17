from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base  # 프로젝트에 맞게 import 경로 확인

class Cafe24Token(Base):
    __tablename__ = "cafe24_tokens"

    cafe24_token_id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=True)
    refresh_token_expires_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    client_id: Mapped[str] = mapped_column(String(100), nullable=True)
    mall_id: Mapped[str] = mapped_column(String(100), nullable=True)
    user_id: Mapped[str] = mapped_column(String(100), nullable=True)
    
    scopes: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    
    issued_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True)
    shop_no: Mapped[str] = mapped_column(String(30), nullable=True)
    token_type: Mapped[str] = mapped_column(String(30), nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
