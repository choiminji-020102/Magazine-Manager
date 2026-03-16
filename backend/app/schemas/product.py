# 표준 라이브러리
from datetime import datetime
from enum import Enum
from typing import Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field


class ProductKind(str, Enum):
    YEARLY = "YEARLY"    # 정기구독 (연간)
    MONTHLY = "MONTHLY"  # 단편 월간지


class ProductCreate(BaseModel):
    product_code: str                                   # 필수, unique (예: "M1001-202604")
    product_kind: ProductKind                           # 필수 (YEARLY | MONTHLY)
    product_name: str                                   # 필수 (예: "말씀함께 2026년 4월호")
    external_product_code_cafe24: Optional[str] = None  # Cafe24 상품 코드
    external_product_code_gpmall: Optional[str] = None  # 갓피플몰 상품 코드
    list_price: int = 0                                 # 정가 (원)
    sale_price: int = 0                                 # 판매가/할인가 (원)
    cost_price: int = 0                                 # 제작 단가 (원)
    stock_quantity: int = 0                             # 재고 수량
    unit_weight: Optional[float] = None                 # 무게 (g)
    unit_width: Optional[float] = None                  # 가로 (mm)
    unit_length: Optional[float] = None                 # 세로 (mm)
    unit_height: Optional[float] = None                 # 높이/두께 (mm)
    is_active: bool = True                              # 판매 여부
    subscribe_start_issue: Optional[str] = None         # 구독 시작 호 (YYYYMM)


class ProductUpdate(BaseModel):
    # ⚠️ product_code, product_kind 변경 시 리스크 주의:
    # - product_code는 OrderItem·SendItem 등 여러 테이블의 참조 키이므로 변경 시 스냅샷 불일치 위험
    # - product_kind(YEARLY↔MONTHLY) 변경 시 발송 로직·구독 기간 계산 전체가 영향받음
    # → 프론트엔드에서 두 필드 변경 감지 시 경고 모달 + 더블체크(재확인) 후 요청 필수
    product_code: Optional[str] = None
    product_kind: Optional[ProductKind] = None
    product_name: Optional[str] = None
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    list_price: Optional[int] = None
    sale_price: Optional[int] = None
    cost_price: Optional[int] = None
    stock_quantity: Optional[int] = None
    unit_weight: Optional[float] = None
    unit_width: Optional[float] = None
    unit_length: Optional[float] = None
    unit_height: Optional[float] = None
    is_active: Optional[bool] = None
    subscribe_start_issue: Optional[str] = None


class ProductStockUpdate(BaseModel):
    stock_quantity: int  # 필수


class ProductResponse(BaseModel):
    product_id: int
    product_code: str
    product_kind: str
    product_name: str
    external_product_code_cafe24: Optional[str] = None
    external_product_code_gpmall: Optional[str] = None
    list_price: int
    sale_price: int
    cost_price: int
    stock_quantity: int
    unit_weight: Optional[float] = None
    unit_width: Optional[float] = None
    unit_length: Optional[float] = None
    unit_height: Optional[float] = None
    is_active: bool
    subscribe_start_issue: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    product_kind: Optional[ProductKind] = None
    is_active: Optional[bool] = None
    search: Optional[str] = None                    # product_name 또는 product_code
    subscribe_start_issue: Optional[str] = None
    sort_by: str = "created_at"                     # created_at | product_name
    sort_order: str = "desc"                        # asc | desc

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        product_kind: Optional[ProductKind] = Query(None),
        is_active: Optional[bool] = Query(None),
        search: Optional[str] = Query(None),
        subscribe_start_issue: Optional[str] = Query(None),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("desc"),
    ):
        return cls(
            page=page,
            limit=limit,
            product_kind=product_kind,
            is_active=is_active,
            search=search,
            subscribe_start_issue=subscribe_start_issue,
            sort_by=sort_by,
            sort_order=sort_order,
        )
