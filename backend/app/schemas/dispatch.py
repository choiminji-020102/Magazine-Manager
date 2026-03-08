from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class DispatchTarget(BaseModel):
    order_item_id: int
    order_id: int
    customer_id: int
    order_channel: str
    product_code: str
    send_product_code: str
    product_kind: str
    product_name: str
    customer_name: str
    customer_phone: str
    address_id: Optional[int] = None
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    postal_code: Optional[str] = None
    address: Optional[str] = None
    customer_memo: Optional[str] = None


class DispatchTargetsResponse(BaseModel):
    issue: str
    product_code: Optional[str] = None
    base_code: Optional[str] = None
    count: int
    targets: List[DispatchTarget]


class DispatchGenerateRequest(BaseModel):
    product_code: Optional[str] = None
    base_code: Optional[str] = None
    send_date: Optional[date] = None


class DispatchCreatedItem(BaseModel):
    send_id: int
    order_item_id: int
    customer_name: str
    send_product_code: str


class DispatchErrorItem(BaseModel):
    order_item_id: int
    customer_name: str
    error: str


class DispatchGenerateResponse(BaseModel):
    issue: str
    total_targets: int
    created_count: int
    error_count: int
    created: List[DispatchCreatedItem]
    errors: List[DispatchErrorItem]


class SubscriptionStats(BaseModel):
    total_subscriptions: int
    yearly_count: int
    monthly_count: int
    sent_count: int


class DispatchSummaryResponse(BaseModel):
    issue: str
    product_code: Optional[str] = None
    base_code: Optional[str] = None
    statistics: SubscriptionStats
    pending_count: int
    
# SINGLE 상품용 스키마
class SingleTarget(BaseModel):
    order_item_id: int
    order_id: int
    customer_id: int
    order_channel: str
    product_code: str
    send_product_code: str
    product_kind: str
    product_name: str
    order_num: int
    customer_name: str
    customer_phone: str
    address_id: Optional[int] = None
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    postal_code: Optional[str] = None
    address: Optional[str] = None
    customer_memo: Optional[str] = None


class SingleTargetsResponse(BaseModel):
    product_code: str
    count: int
    targets: List[SingleTarget]

