# 표준 라이브러리
from datetime import datetime
from typing import Optional

# 서드파티 라이브러리
from pydantic import BaseModel, Field


class SendItemCreate(BaseModel):
    order_item_id: int
    # YYYYMM — month 부분 01~12 강제 (예: 202613 같은 무의미한 값 차단)
    issue: str = Field(..., pattern=r"^\d{4}(0[1-9]|1[0-2])$", description="발송 호 (YYYYMM, 필수)")
    # send_num 은 서버에서 OrderItem.order_num 으로 스냅샷 — 클라이언트 입력 차단.


class SendItemUpdate(BaseModel):
    # send_num 은 OrderItem.order_num 에서 생성 시점에 스냅샷되며,
    # 발송 후 부 수 조정은 운영 모델에 없음 — 수정 불가.
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
    cancelled_at: Optional[datetime] = None  # dead — 미구현 (models/send_item.py 의 컬럼 정의 주석 참조)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
