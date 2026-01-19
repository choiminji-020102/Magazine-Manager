from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# 주문 생성 시 주문자 정보
class OrderCustomerInput(BaseModel):
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None


# 주문 생성 시 배송지 정보
class OrderAddressInput(BaseModel):
    address_name: str  # 수령인 이름
    phone: str         # 수령인 연락처
    nation: str = "대한민국"
    postal_code: str
    address: str
    address_memo: Optional[str] = None


class OrderItemCreateInOrder(BaseModel):
    product_code: str
    order_num: Optional[int] = 1
    price: Optional[int] = None
    sale: Optional[int] = None
    subscribe_period: Optional[int] = 12  # 구독 기간 (기본 12개월)


class OrderCreate(BaseModel):
    # 기존 고객/주소 ID 사용 시
    customer_id: Optional[int] = None
    address_id: Optional[int] = None
    
    # 새 주문자/배송지 정보 입력 시
    customer: Optional[OrderCustomerInput] = None
    address: Optional[OrderAddressInput] = None
    
    external_order_id: Optional[str] = None
    order_channel: str = "OFFLINE"
    discount_amount: int = 0
    send_fee: int = 0
    payment_method: Optional[str] = None
    request_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    items: List[OrderItemCreateInOrder]


class OrderUpdate(BaseModel):
    address_id: Optional[int] = None
    order_status: Optional[str] = None
    discount_amount: Optional[int] = None
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


class OrderItemResponse(BaseModel):
    order_item_id: int
    order_id: int
    product_code: str
    product_name: str
    product_kind: str
    price: int
    sale: int
    refund: Optional[int] = 0
    order_num: int
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None
    subscribe_period: Optional[int] = None
    last_send_issue: Optional[str] = None
    final_subscribe_end_issue: Optional[str] = None
    memo: Optional[str] = None
    sended_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrderDetailResponse(OrderResponse):
    customer: Optional[dict] = None
    address: Optional[dict] = None
    items: List[OrderItemResponse] = []
