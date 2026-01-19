from pydantic import BaseModel
from typing import Optional, List
from datetime import date


class DispatchTarget(BaseModel):
    order_item_id: int
    order_id: int
    customer_id: int
    order_channel: str
    product_code: str
    product_kind: str
    product_name: str
    customer_name: str
    customer_phone: str
    address_name: Optional[str] = None
    phone: Optional[str] = None
    postal_code: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    address_memo: Optional[str] = None


class DispatchTargetsResponse(BaseModel):
    issue: str
    count: int
    targets: List[DispatchTarget]


class DispatchGenerateRequest(BaseModel):
    product_code: Optional[str] = None
    send_date: Optional[date] = None


class DispatchCreatedItem(BaseModel):
    send_id: int
    order_item_id: int
    customer_name: str


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
    statistics: SubscriptionStats
    pending_count: int


class DispatchTargetItem(BaseModel):
    order_item_id: int
    order_id: int
    customer_id: int
    customer_name: str
    customer_phone: str
    product_code: str
    product_name: str
    product_kind: str
    order_num: int
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None
    final_subscribe_end_issue: Optional[str] = None
    last_send_issue: Optional[str] = None
    next_send_issue: str
    address_id: int
    address_name: str
    phone: str
    postal_code: str
    address: str
    address_memo: Optional[str] = None


class DispatchTargetListResponse(BaseModel):
    issue: str
    total_count: int
    items: List[DispatchTargetItem]