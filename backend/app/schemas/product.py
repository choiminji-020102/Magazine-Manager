from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal
from fastapi import Query


class ProductListQuery(BaseModel):
    """상품 목록 조회 쿼리 파라미터"""
    page: int = Field(1, ge=1, description="페이지 번호")
    limit: int = Field(20, ge=1, le=100, description="페이지당 항목 수")
    search: Optional[str] = Field(None, description="검색어 (상품명, 상품코드)")
    kind: Optional[str] = Field(None, description="상품 종류 필터 (YEARLY, MONTHLY, SINGLE)")
    is_active: Optional[bool] = Field(None, description="활성화 여부 필터")

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1, description="페이지 번호"),
        limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
        search: Optional[str] = Query(None, description="검색어 (상품명, 상품코드)"),
        kind: Optional[str] = Query(None, description="상품 종류 필터 (YEARLY, MONTHLY, SINGLE)"),
        is_active: Optional[bool] = Query(None, description="활성화 여부 필터"),
    ):
        """쿼리 파라미터로 사용하기 위한 팩토리 메서드"""
        return cls(
            page=page,
            limit=limit,
            search=search,
            kind=kind,
            is_active=is_active
        )


class ProductBase(BaseModel):
    product_code: str = Field(..., max_length=50)
    product_kind: Literal["YEARLY", "MONTHLY", "SINGLE"]
    product_name: str = Field(default="", max_length=255)
    unit_weight: Optional[Decimal] = Decimal("0.0")
    unit_width: Optional[Decimal] = Decimal("0.0")
    unit_length: Optional[Decimal] = Decimal("0.0")
    unit_height: Optional[Decimal] = Decimal("0.0")
    price: int = 0
    sale: int = 0
    purchase: int = 0
    stock_quantity: int = 0
    is_active: bool = True
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    subscribe_start_issue: Optional[str] = None


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    unit_weight: Optional[Decimal] = None
    unit_width: Optional[Decimal] = None
    unit_length: Optional[Decimal] = None
    unit_height: Optional[Decimal] = None
    price: Optional[int] = None
    sale: Optional[int] = None
    purchase: Optional[int] = None
    stock_quantity: Optional[int] = None
    is_active: Optional[bool] = None
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    subscribe_start_issue: Optional[str] = None


class ProductResponse(ProductBase):
    product_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
