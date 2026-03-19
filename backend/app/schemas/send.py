from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Literal
from datetime import datetime, date

from app.schemas.address import AddressCreate
from app.schemas.send_item import SendItemResponse


COURIER_COMPANIES = Literal["CJ대한통운", "로젠택배", "우체국택배", "한진택배", "롯데택배"]
SEND_STATUS = Literal["PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"]


class SendItemInput(BaseModel):
    order_item_id: int
    send_num: int = 1


class SendAddressInput(BaseModel):
    recipient_name: str
    recipient_phone: str
    country_code: Optional[str] = "KR"
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None


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


class SendResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    send_id: int
    order_id: int
    address_id: Optional[int] = None
    send_date: Optional[date] = None
    courier_company: Optional[str] = None
    tracking_no: Optional[str] = None
    send_status: str
    send_memo: Optional[str] = None
    recipient_name: str
    recipient_phone: str
    country_code: str = "KR"
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    cancelled_at: Optional[datetime] = None


class SendListResponse(SendResponse):
    item_count: int = 0


class SendDetailResponse(SendResponse):
    items: List[SendItemResponse] = []
    item_count: int = 0



