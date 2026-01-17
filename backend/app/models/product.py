from sqlalchemy import Column, BigInteger, String, Integer, Boolean, DateTime, Enum, DECIMAL
from sqlalchemy.sql import func

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"
    
    product_id = Column(BigInteger, primary_key=True, autoincrement=True, comment="상품 ID")
    product_code = Column(String(50), unique=True, nullable=False, comment="재고 코드")
    product_kind = Column(
        Enum("YEARLY", "MONTHLY", "SINGLE", name="product_kind_enum"),
        nullable=False,
        comment="상품종류"
    )
    product_name = Column(String(255), nullable=False, default="", comment="상품명")
    unit_weight = Column(DECIMAL(8, 2), default=0.00, comment="한 권의 무게(g)")
    unit_width = Column(DECIMAL(6, 1), default=0.0, comment="가로(mm)")
    unit_length = Column(DECIMAL(6, 1), default=0.0, comment="세로(mm)")
    unit_height = Column(DECIMAL(6, 1), default=0.0, comment="높이/두께(mm)")
    price = Column(Integer, default=0, comment="정가")
    sale = Column(Integer, default=0, comment="판매가")
    purchase = Column(Integer, default=0, comment="제작단가")
    stock_quantity = Column(Integer, default=0, comment="제작 수량")
    is_active = Column(Boolean, nullable=False, default=True, comment="판매 여부")
    external_product_code_cafe24 = Column(String(50), nullable=True, comment="Cafe24 코드")
    external_product_code_gpmall = Column(String(50), nullable=True, comment="갓피플Mall 코드")
    subscribe_start_issue = Column(String(10), nullable=True, comment="구독 시작 호")
    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
