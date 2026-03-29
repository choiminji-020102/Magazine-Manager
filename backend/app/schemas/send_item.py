# 표준 라이브러리
from datetime import datetime
from typing import Optional

# 서드파티 라이브러리
from pydantic import BaseModel


class SendItemCreate(BaseModel):
    order_item_id: int
    issue: str                                  # 발송 호 (YYYYMM, 필수)
    send_num: int = 1


class SendItemUpdate(BaseModel):
    send_num: Optional[int] = None
    admin_memo: Optional[str] = None


class SendItemResponse(BaseModel):
    send_item_id: int
    send_id: int
    order_item_id: int
    product_code: str
    product_name: str
    issue: str
    send_num: int
    cost_price: int
    unit_weight: Optional[float] = None
    unit_width: Optional[float] = None
    unit_length: Optional[float] = None
    unit_height: Optional[float] = None
    admin_memo: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
