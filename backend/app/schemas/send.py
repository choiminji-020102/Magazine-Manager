from pydantic import BaseModel, Field
from typing import Optional, List, Literal
from datetime import datetime, date
from decimal import Decimal

from app.schemas.address import AddressCreate


COURIER_COMPANIES = Literal["CJ대한통운", "로젠택배", "우체국택배", "한진택배", "롯데택배"]
SEND_STATUS = Literal["PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"]


class SendItemInput(BaseModel):
    order_item_id: int
    send_num: int = 1


class SendAddressInput(BaseModel):
    address_name: str
    phone: str
    nation: Optional[str] = "대한민국"
    postal_code: str
    address: str
    address_memo: Optional[str] = None


class SendCreate(BaseModel):
    order_id: int
    address_id: Optional[int] = None
    address: Optional[SendAddressInput] = None
    send_date: Optional[date] = None
    courier_company: Optional[COURIER_COMPANIES] = None
    tracking_no: Optional[str] = None
    send_status: Optional[SEND_STATUS] = "PREPARING"
    send_memo: Optional[str] = None
    items: List[SendItemInput]


class SendUpdate(BaseModel):
    send_date: Optional[date] = None
    courier_company: Optional[COURIER_COMPANIES] = None
    tracking_no: Optional[str] = None
    send_status: Optional[SEND_STATUS] = None
    send_memo: Optional[str] = None
    address: Optional[SendAddressInput] = None


class SendStatusUpdate(BaseModel):
    status: SEND_STATUS


class SendTrackingUpdate(BaseModel):
    courier_company: COURIER_COMPANIES
    tracking_no: str


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


class SendResponse(BaseModel):
    send_id: int
    order_id: int
    address_id: Optional[int] = None
    send_date: Optional[date] = None
    courier_company: Optional[str] = None
    tracking_no: Optional[str] = None
    send_status: str
    send_memo: Optional[str] = None
    address_name: str
    phone: str
    nation: Optional[str] = None
    postal_code: str
    address: str
    address_memo: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SendDetailResponse(SendResponse):
    items: List[SendItemResponse] = []
    item_count: int = 0


class SendListResponse(SendResponse):
    item_count: int = 0
