from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class PauseInfo(BaseModel):
    pause_id: int
    pause_issue: str
    reason: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    order_id: int
    product_code: str
    order_num: int = 1
    price: Optional[int] = None
    sale: Optional[int] = None
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None


class OrderItemUpdate(BaseModel):
    price: Optional[int] = None
    sale: Optional[int] = None
    refund: Optional[int] = None
    order_num: Optional[int] = None
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None
    subscribe_period: Optional[int] = None
    final_subscribe_end_issue: Optional[str] = None
    memo: Optional[str] = None
    address: Optional[dict] = None


class SubscriptionUpdate(BaseModel):
    subscribe_start_issue: str
    subscribe_end_issue: str


class OrderItemResponse(BaseModel):
    order_item_id: int
    external_order_item_id: Optional[str] = None
    order_id: int
    product_code: str
    product_kind: str
    product_name: str
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
    created_at: datetime
    sended_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    updated_at: datetime
    
    class Config:
        from_attributes = True


class OrderItemDetailResponse(BaseModel):
    order_item_id: int
    external_order_item_id: Optional[str] = None
    order_id: int
    product_code: str
    product_kind: str
    product_name: str
    price: int
    sale: int
    refund: Optional[int] = 0
    order_num: int
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None
    subscribe_period: Optional[int] = None
    last_send_issue: Optional[str] = None
    final_subscribe_end_issue: Optional[str] = None
    address_id: Optional[int] = None
    memo: Optional[str] = None
    created_at: datetime
    sended_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    updated_at: datetime
    pauses: List[PauseInfo] = []
    
    class Config:
        from_attributes = True
