from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AddressCreate(BaseModel):
    customer_id: int
    address_name: str
    phone: str
    nation: str = "대한민국"
    postal_code: str
    address: str
    address_memo: Optional[str] = None


class AddressUpdate(BaseModel):
    nation: Optional[str] = None
    postal_code: Optional[str] = None
    address_memo: Optional[str] = None


class AddressResponse(BaseModel):
    address_id: int
    customer_id: int
    address_name: str
    phone: str
    nation: str
    postal_code: str
    address: str
    address_memo: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
