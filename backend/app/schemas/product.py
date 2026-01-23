from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal


class ProductBase(BaseModel):
    product_code: str = Field(..., max_length=50)
    product_kind: Literal["YEARLY", "MONTHLY", "SINGLE"]
    product_name: str = Field(..., max_length=255)
    unit_weight: Optional[Decimal] = 0
    unit_width: Optional[Decimal] = 0
    unit_length: Optional[Decimal] = 0
    unit_height: Optional[Decimal] = 0
    price: Optional[int] = 0
    sale: Optional[int] = 0
    purchase: Optional[int] = 0
    stock_quantity: Optional[int] = 0
    is_active: bool = True
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    subscribe_start_issue: Optional[str] = None

class ProductCreate(BaseModel):
    product_code: str
    product_kind: str
    product_name: str
    unit_weight: Optional[float] = 0.0
    unit_width: Optional[float] = 0.0
    unit_length: Optional[float] = 0.0
    unit_height: Optional[float] = 0.0
    price: int = 0
    sale: int = 0
    purchase: int = 0
    stock_quantity: int = 0
    is_active: bool = True
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    subscribe_start_issue: Optional[str] = None


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    unit_weight: Optional[float] = None
    unit_width: Optional[float] = None
    unit_length: Optional[float] = None
    unit_height: Optional[float] = None
    price: Optional[int] = None
    sale: Optional[int] = None
    purchase: Optional[int] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    subscribe_start_issue: Optional[str] = None


class ProductResponse(BaseModel):
    product_id: int
    product_code: str
    product_kind: str
    product_name: str
    unit_weight: Optional[float] = 0.0
    unit_width: Optional[float] = 0.0
    unit_length: Optional[float] = 0.0
    unit_height: Optional[float] = 0.0
    price: int
    sale: int
    purchase: int
    stock_quantity: int
    is_active: bool
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    subscribe_start_issue: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
