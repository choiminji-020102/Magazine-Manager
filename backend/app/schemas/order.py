from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from fastapi import Query

from app.schemas.order_item import OrderItemResponse


class OrderListQuery(BaseModel):
    """주문 목록 조회 쿼리 파라미터"""
    page: int = Field(1, ge=1, description="페이지 번호")
    limit: int = Field(20, ge=1, le=100, description="페이지당 항목 수")
    search: Optional[str] = Field(None, description="검색어")
    channel: Optional[str] = Field(None, description="주문 채널 필터 (CAFE24, GPMALL, OFFLINE)")
    order_status: Optional[str] = Field(None, description="주문 상태 필터")
    start_date: Optional[str] = Field(None, description="시작 날짜")
    end_date: Optional[str] = Field(None, description="종료 날짜")

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1, description="페이지 번호"),
        limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
        search: Optional[str] = Query(None, description="검색어"),
        channel: Optional[str] = Query(None, description="주문 채널 필터 (CAFE24, GPMALL, OFFLINE)"),
        order_status: Optional[str] = Query(None, description="주문 상태 필터"),
        start_date: Optional[str] = Query(None, description="시작 날짜"),
        end_date: Optional[str] = Query(None, description="종료 날짜"),
    ):
        """쿼리 파라미터로 사용하기 위한 팩토리 메서드"""
        return cls(
            page=page,
            limit=limit,
            search=search,
            channel=channel,
            order_status=order_status,
            start_date=start_date,
            end_date=end_date
        )


# 주문 생성 시 주문자 정보
class OrderCustomerInput(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    create_channel: Optional[str] = None
    admin_memo: Optional[str] = None


# 주문 생성 시 배송지 정보
class OrderAddressInput(BaseModel):
    recipient_name: str   # 수령인 이름
    recipient_phone: str  # 수령인 연락처
    country_code: str = "KR"
    postal_code: str
    address: str
    customer_memo: Optional[str] = None


class OrderItemCreateInOrder(BaseModel):
    product_code: str
    order_num: Optional[int] = 1
    price: Optional[int] = None
    sale: Optional[int] = None
    subscribe_period: Optional[int] = 12  # 구독 기간 (기본 12개월)
    memo: Optional[str] = None


class OrderCreate(BaseModel):
    customer_id: Optional[int] = None
    address_id: Optional[int] = None
    
    customer: Optional[OrderCustomerInput] = None
    address: Optional[OrderAddressInput] = None
    
    external_order_id: Optional[str] = None
    
    items: List[OrderItemCreateInOrder]
    
    order_channel: str = "OFFLINE"
    order_status: str = "ORDERED"
    
    discount_amount: int = 0
    send_fee: int = 0
    payment_method: Optional[str] = None
    
    request_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    
    payment_at: Optional[datetime] = None


class OrderUpdate(BaseModel):
    address_id: Optional[int] = None
    order_status: Optional[str] = None
    discount_amount: Optional[int] = None
    refund_amount: Optional[int] = None     # 상의 필요함
    send_fee: Optional[int] = None
    payment_method: Optional[str] = None
    request_memo: Optional[str] = None
    admin_memo: Optional[str] = None


class OrderStatusUpdate(BaseModel):
    status: str


class OrderResponse(BaseModel):
    order_id: int
    customer_id: int
    external_order_id: Optional[str] = None
    order_channel: str
    order_status: str
    total_amount: int
    discount_amount: Optional[int] = 0
    refund_amount: Optional[int] = 0
    send_fee: Optional[int] = 0
    payment_amount: int
    payment_method: Optional[str] = None
    address_id: Optional[int] = None
    request_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    order_at: datetime
    payment_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    order_id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    external_order_id: Optional[str] = None
    order_channel: str
    order_status: str
    total_amount: int
    discount_amount: Optional[int] = 0
    refund_amount: Optional[int] = 0
    send_fee: Optional[int] = 0
    payment_amount: int
    order_at: datetime
    item_count: Optional[int] = 0


