from sqlalchemy import Column, BigInteger, String, Integer, Boolean, DateTime, Enum, DECIMAL
from sqlalchemy.sql import func

from app.db.base import Base

class Product(Base):
    __tablename__ = "products"
    
    product_id = Column(BigInteger, primary_key=True, autoincrement=True)
    
    product_code = Column(String(50), unique=True, nullable=False, comment="상품 코드")
    
    product_kind = Column(Enum("YEARLY", "MONTHLY", name="product_kind_enum"), nullable=False, comment="상품종류")
    product_name = Column(String(255), nullable=False, comment="상품명")
    
    external_product_code_cafe24 = Column(String(50), nullable=True, comment="Cafe24 코드")
    external_product_code_gpmall = Column(String(50), nullable=True, comment="갓피플몰 코드")

    list_price = Column(Integer, nullable=False, server_default="0", comment="정가")
    sale_price = Column(Integer, nullable=False, server_default="0", comment="판매가, 할인가")
    cost_price = Column(Integer, nullable=False, server_default="0", comment="제작 단가")
    
    stock_quantity = Column(Integer, nullable=False, server_default="0", comment="제작 수량")

    unit_weight = Column(DECIMAL(8, 2), nullable=True, server_default="0.00", comment="한 권의 무게(g)")
    unit_width = Column(DECIMAL(6, 1), nullable=True, server_default="0.0", comment="가로(mm)")
    unit_length = Column(DECIMAL(6, 1), nullable=True, server_default="0.0", comment="세로(mm)")
    unit_height = Column(DECIMAL(6, 1), nullable=True, server_default="0.0", comment="높이/두께(mm)")

    is_active = Column(Boolean, nullable=False, server_default="1", comment="판매 여부")
    
    subscribe_start_issue = Column(String(10), nullable=True, comment="구독 시작 호")   # 202601

    created_at = Column(DateTime, nullable=False, server_default=func.now(), comment="생성 일시")
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), comment="수정 일시")
