from sqlalchemy import Column, BigInteger, String, DateTime, Integer, DECIMAL, Text, ForeignKey, Index, UniqueConstraint
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

    issue = Column(String(10), nullable=False, comment="발송 호 (YYYYMM)")

    send_num = Column(Integer, nullable=False, server_default="1")

    cost_price = Column(Integer, nullable=False, server_default="0", comment="제작단가 (스냅샷)")

    unit_weight = Column(DECIMAL(8, 2), nullable=True, comment="한 권의 무게(kg) (스냅샷)")
    unit_width = Column(DECIMAL(6, 1), nullable=True, comment="가로(mm) (스냅샷)")
    unit_length = Column(DECIMAL(6, 1), nullable=True, comment="세로(mm) (스냅샷)")
    unit_height = Column(DECIMAL(6, 1), nullable=True, comment="높이/두께(mm) (스냅샷)")

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
    order_item = relationship(
        "OrderItem",
        primaryjoin="SendItem.order_item_id == OrderItem.order_item_id",
        foreign_keys=[order_item_id],
        lazy="select"
    )

    __table_args__ = (
        # 한 OrderItem 에 같은 호 SendItem 이 두 번 만들어지는 것을 DB 레벨에서 차단
        # (마이그레이션 013). 위반 시 IntegrityError → 엔드포인트에서 400 변환.
        UniqueConstraint("order_item_id", "issue", name="uq_send_items_order_item_issue"),
        Index("ix_send_items_send_id", "send_id"),
        Index("ix_send_items_order_item_id", "order_item_id"),
    )
