from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PauseBase(BaseModel):
    pause_issue: str = Field(..., max_length=20)
    reason: Optional[str] = None


class PauseCreate(PauseBase):
    pass


class PauseUpdate(BaseModel):
    pause_issue: Optional[str] = Field(None, max_length=20)
    reason: Optional[str] = None


class PauseResponse(BaseModel):
    pause_id: int
    order_item_id: int
    pause_issue: str
    reason: Optional[str] = None
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PauseByIssueResponse(PauseResponse):
    product_name: Optional[str] = None
    customer_id: Optional[int] = None
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
