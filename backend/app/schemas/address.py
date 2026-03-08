from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AddressCreate(BaseModel):
    customer_id: Optional[int] = None
    recipient_name: str
    recipient_phone: str
    country_code: Optional[str] = "KR"
    postal_code: str
    address: str
    customer_memo: Optional[str] = None


class AddressUpdate(BaseModel):
    country_code: Optional[str] = None
    postal_code: Optional[str] = None
    customer_memo: Optional[str] = None


class AddressResponse(BaseModel):
    address_id: int
    customer_id: Optional[int] = None
    recipient_name: str
    recipient_phone: str
    country_code: Optional[str] = None
    postal_code: str
    address: str
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
