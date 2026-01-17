from sqlalchemy import Column, BigInteger, String, DateTime, Integer, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SendItem(Base):
    __tablename__ = "send_items"
    
    send_item_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="발송-구성 매핑 고유 ID")
    send_id = Column(BigInteger, nullable=False, comment="연결된 발송 ID")
    order_item_id = Column(BigInteger, nullable=False, comment="연결된 주문 품목 ID")
    product_code = Column(String(50), nullable=False, comment="내부 상품 코드")
    send_num = Column(Integer, nullable=False, default=1, comment="발송 수량")
    purchase = Column(Integer, nullable=True, default=0, comment="제작단가 (스냅샷)")
    product_name = Column(String(255), nullable=False, comment="상품명 (스냅샷)")
    unit_weight = Column(DECIMAL(8, 2), nullable=True, default=0.00, comment="한 권의 무게(g) (스냅샷)")
    unit_width = Column(DECIMAL(6, 1), nullable=True, default=0.0, comment="가로(mm) (스냅샷)")
    unit_length = Column(DECIMAL(6, 1), nullable=True, default=0.0, comment="세로(mm) (스냅샷)")
    unit_height = Column(DECIMAL(6, 1), nullable=True, default=0.0, comment="높이/두께(mm) (스냅샷)")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    cancelled_at = Column(DateTime, nullable=True, comment="취소 일시")
    
    # Relationships
    send = relationship(
        "Send",
        primaryjoin="SendItem.send_id == Send.send_id",
        foreign_keys=[send_id],
        back_populates="items"
    )
