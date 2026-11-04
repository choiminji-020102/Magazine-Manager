# 표준 라이브러리
from datetime import datetime
from typing import List, Optional

# 서드파티 라이브러리
from pydantic import BaseModel, ConfigDict, Field

# 로컬 애플리케이션
from app.models.customer import Channel
from app.schemas.address import AddressResponse
from app.schemas.order import OrderResponse


class CustomerCreate(BaseModel):
    customer_phone: str                         # 필수, (customer_phone, customer_name) 복합 unique
    customer_name: str                          # 필수
    create_channel: Channel = Channel.OFFLINE   # 유입 경로, 기본 OFFLINE
    customer_email: Optional[str] = None
    admin_memo: Optional[str] = None


class CustomerUpdate(BaseModel):
    create_channel: Optional[Channel] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_name: Optional[str] = None
    admin_memo: Optional[str] = None


class CustomerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    customer_id: int
    create_channel: str
    customer_phone: str
    customer_phone_num4: str
    customer_email: Optional[str] = None
    customer_name: str
    is_active: bool
    is_deleted: bool
    admin_memo: Optional[str] = None
    last_order_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class CustomerDetailResponse(CustomerResponse):
    """고객 상세 조회 응답 (주문·배송지 포함)"""
    recent_orders: List[OrderResponse] = []
    addresses: List[AddressResponse] = []


class CustomerListItem(CustomerResponse):
    """고객 목록용 응답 — 배송지 VIP 플래그 집계(OR) 포함"""
    vip1: bool = False
    vip2: bool = False
    vip3: bool = False
    vip4: bool = False
    vip5: bool = False
    vip6: bool = False


class CustomerListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    create_channel: Optional[Channel] = None
    is_active: Optional[bool] = None
    is_deleted: bool = False
    phone_num4: Optional[str] = Field(None, max_length=4)
    search: Optional[str] = None              # 고객명 또는 이메일
    customer_name: Optional[str] = None       # 고객명만 검색
    admin_memo: Optional[str] = None
    sort_by: str = "created_at"               # created_at | updated_at | customer_name | last_order_at
    sort_order: str = "desc"


# 연락처 빠른 검색 응답 (CustomerResponse 재사용)
CustomerQuickSearchResponse = CustomerResponse
