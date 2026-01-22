from sqlalchemy import Column, String, DateTime, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.mysql import BIGINT, INTEGER

from app.db.base import Base


class SendItem(Base):
    __tablename__ = "send_items"
    
    send_item_id = Column(BIGINT(unsigned=True), primary_key=True, autoincrement=True, comment="발송-구성 매핑 고유 ID")
    send_id = Column(BIGINT(unsigned=True), nullable=False, index=True, comment="연결된 발송 ID")
    order_item_id = Column(BIGINT(unsigned=True), nullable=False, index=True, comment="연결된 주문 품목 ID")
    product_code = Column(String(50), nullable=False, index=True, comment="내부 상품 코드")
    send_num = Column(INTEGER(unsigned=True), nullable=False, default=1, comment="발송 수량")
    purchase = Column(INTEGER(unsigned=True), nullable=True, default=0, comment="제작단가 (스냅샷)")
    product_name = Column(String(255), nullable=False, comment="상품명 (스냅샷)")
    unit_weight = Column(DECIMAL(8, 2, unsigned=True), nullable=True, default=0.00, comment="한 권의 무게(g) (스냅샷)")
    unit_width = Column(DECIMAL(6, 1, unsigned=True), nullable=True, default=0.0, comment="가로(mm) (스냅샷)")
    unit_length = Column(DECIMAL(6, 1, unsigned=True), nullable=True, default=0.0, comment="세로(mm) (스냅샷)")
    unit_height = Column(DECIMAL(6, 1, unsigned=True), nullable=True, default=0.0, comment="높이/두께(mm) (스냅샷)")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True, comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment="수정 일시")
    cancelled_at = Column(DateTime, nullable=True, index=True, comment="취소 일시")
    
    # Relationships
    send = relationship(
        "Send",
        primaryjoin="SendItem.send_id == Send.send_id",
        foreign_keys=[send_id],
        back_populates="items"
    )
