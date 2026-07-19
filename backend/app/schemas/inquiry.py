from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class InquiryCreate(BaseModel):
    customer_id: int
    inquiry_type: str = Field(default="PHONE", description="PHONE, EMAIL, CHAT, VISIT")
    inquiry_category: Optional[str] = Field(None, description="SUBSCRIPTION, DELIVERY, PAYMENT, CANCEL, OTHER")
    title: Optional[str] = None
    content: Optional[str] = None
    order_id: Optional[int] = None
    order_item_id: Optional[int] = None


class InquiryUpdate(BaseModel):
    inquiry_type: Optional[str] = None
    inquiry_category: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    answer: Optional[str] = None
    inquiry_status: Optional[str] = None
    order_id: Optional[int] = None
    order_item_id: Optional[int] = None


class InquiryAnswer(BaseModel):
    answer: str
    inquiry_status: str = Field(default="COMPLETED", description="RECEIVED, COMPLETED, CANCELLED")


class InquiryResponse(BaseModel):
    inquiry_id: int
    customer_id: int
    inquiry_type: str
    inquiry_category: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    answer: Optional[str] = None
    inquiry_status: str
    order_id: Optional[int] = None
    order_item_id: Optional[int] = None
    handled_by: Optional[int] = None
    handled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class InquiryListResponse(BaseModel):
    inquiry_id: int
    customer_id: int
    customer_name: str
    customer_phone: str
    inquiry_type: str
    inquiry_category: Optional[str] = None
    title: Optional[str] = None
    inquiry_status: str
    handled_by: Optional[int] = None
    handler_name: Optional[str] = None
    created_at: datetime


class InquiryDetailResponse(InquiryResponse):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    handler_name: Optional[str] = None


# 전화번호 뒤4자리 검색용
class CustomerQuickSearchResponse(BaseModel):
    customer_id: int
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    create_channel: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class CustomerInquiryHistoryResponse(BaseModel):
    customer: CustomerQuickSearchResponse
    orders_count: int
    inquiries_count: int
    recent_orders: List[dict]
    recent_inquiries: List[InquiryResponse]