from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime


class CustomerBase(BaseModel):
    customer_name: str = Field("", max_length=50)
    customer_phone: str = Field(..., max_length=20)
    customer_email: Optional[EmailStr] = None
    create_channel: Literal["CAFE24", "GPMALL", "OFFLINE"] = "OFFLINE"
    admin_memo: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, max_length=50)
    customer_phone: Optional[str] = Field(None, max_length=20)
    customer_email: Optional[EmailStr] = None
    admin_memo: Optional[str] = None


class CustomerResponse(BaseModel):
    customer_id: int
    customer_name: str
    customer_phone: str
    customer_phone_num4: str
    customer_email: Optional[str] = None
    create_channel: str
    admin_memo: Optional[str] = None
    last_order_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
