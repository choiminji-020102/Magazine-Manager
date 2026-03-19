from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AddressCreate(BaseModel):
    customer_id: Optional[int] = None
    recipient_name: str
    recipient_phone: str
    country_code: Optional[str] = "KR"
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None


class AddressUpdate(BaseModel):
    country_code: Optional[str] = None
    postal_code: Optional[str] = None
    customer_memo: Optional[str] = None


class AddressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    address_id: int
    customer_id: Optional[int] = None
    recipient_name: str
    recipient_phone: str
    country_code: Optional[str] = None
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    created_at: datetime
    updated_at: datetime
