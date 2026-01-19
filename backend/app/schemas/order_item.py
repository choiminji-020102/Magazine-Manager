from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.schemas.address import AddressCreate


class OrderItemCreate(BaseModel):
    product_code: str
    external_order_item_id: Optional[str] = None
    price: Optional[int] = None
    sale: Optional[int] = None
    order_num: int = 1
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None
    address: Optional[AddressCreate] = None
    address_id: Optional[int] = None


class OrderItemUpdate(BaseModel):
    price: Optional[int] = None
    sale: Optional[int] = None
    refund: Optional[int] = None
    order_num: Optional[int] = None
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None
    last_send_issue: Optional[str] = None
    final_subscribe_end_issue: Optional[str] = None
    memo: Optional[str] = None
    address: Optional[AddressCreate] = None
    address_id: Optional[int] = None


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
    order_num: int
    subscribe_start_issue: Optional[str] = None
    subscribe_end_issue: Optional[str] = None
    last_send_issue: Optional[str] = None
    final_subscribe_end_issue: Optional[str] = None
    address_id: int
    created_at: datetime
    sended_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    updated_at: datetime
    
    # Address info (optional join)
    address_name: Optional[str] = None
    phone: Optional[str] = None
    postal_code: Optional[str] = None
    address1: Optional[str] = None
    address2: Optional[str] = None
    
    class Config:
        from_attributes = True
