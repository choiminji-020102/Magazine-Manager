from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


class SendItemCreate(BaseModel):
    order_item_id: int
    send_num: int = 1


class SendItemUpdate(BaseModel):
    send_num: Optional[int] = None


class SendItemResponse(BaseModel):
    send_item_id: int
    send_id: int
    order_item_id: int
    product_code: str
    send_num: int
    purchase: int
    product_name: str
    unit_weight: Decimal
    unit_width: Decimal
    unit_length: Decimal
    unit_height: Decimal
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SendItemDetailResponse(SendItemResponse):
    send_date: Optional[date] = None
    courier_company: Optional[str] = None
    tracking_no: Optional[str] = None
    send_status: Optional[str] = None
