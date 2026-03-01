from sqlalchemy import Column, BigInteger, String, DateTime, Integer, DECIMAL, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base

class SendItem(Base):
    __tablename__ = "send_items"

    send_item_id = Column(BigInteger, primary_key=True, autoincrement=True)

    send_id = Column(BigInteger, ForeignKey("sends.send_id"), nullable=False, comment="발송 ID")

    order_item_id = Column(BigInteger, ForeignKey("order_items.order_item_id"), nullable=False, comment="주문 품목 ID")

    product_code = Column(String(50), nullable=False, comment="상품 코드 (스냅샷)")
    product_name = Column(String(255), nullable=False, comment="상품명 (스냅샷)")

    send_num = Column(Integer, nullable=False, server_default="1")

    cost_price = Column(Integer, nullable=False, server_default="0", comment="제작단가 (스냅샷)")

    unit_weight = Column(DECIMAL(8, 2), nullable=False, server_default="0.00", comment="한 권의 무게(g) (스냅샷)")
    unit_width = Column(DECIMAL(6, 1), nullable=False, server_default="0.0", comment="가로(mm) (스냅샷)")
    unit_length = Column(DECIMAL(6, 1), nullable=False, server_default="0.0", comment="세로(mm) (스냅샷)")
    unit_height = Column(DECIMAL(6, 1), nullable=False, server_default="0.0", comment="높이/두께(mm) (스냅샷)")

    admin_memo = Column(Text, nullable=True, comment="관리자 메모")
    
    cancelled_at = Column(DateTime, nullable=True, comment="취소 일시")

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
    
    # Relationships
    send = relationship(
        "Send",
        primaryjoin="SendItem.send_id == Send.send_id",
        foreign_keys=[send_id],
        back_populates="items"
    )
