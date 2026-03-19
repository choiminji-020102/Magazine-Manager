# 표준 라이브러리
from datetime import datetime
from typing import List, Optional

# 서드파티 라이브러리
from pydantic import BaseModel, Field


class PauseInfo(BaseModel):
    pause_id: int
    pause_issue: str
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrderItemCreate(BaseModel):
    """단독 품목 추가 (POST /orders/{id}/items)"""
    order_id: int
    product_code: str
    order_num: int = 1
    list_price: Optional[int] = None    # 미입력 시 상품 정가 사용
    sale_price: Optional[int] = None    # 미입력 시 상품 판매가 사용
    subscribe_period: Optional[int] = None  # YEARLY만 해당, 미입력 시 12개월
    admin_memo: Optional[str] = None


class OrderItemUpdate(BaseModel):
    # ⚠️ subscribe_start_issue, subscribe_end_issue는 불변 필드 — 수정 불가
    # final_subscribe_end_issue는 /extend, /change-period 엔드포인트로만 변경
    order_num: Optional[int] = None
    list_price: Optional[int] = None
    sale_price: Optional[int] = None
    refund_amount: Optional[int] = None
    admin_memo: Optional[str] = None


class OrderItemAddressUpdate(BaseModel):
    """품목 배송지 단독 변경 (PATCH /order-items/{id}/address)"""
    address_id: int


class OrderItemExtend(BaseModel):
    """구독 기간 무상 연장 (PATCH /order-items/{id}/extend)"""
    extend_months: int = Field(1, ge=1)   # 연장 개월 수
    reason: Optional[str] = None


class OrderItemBulkExtend(BaseModel):
    """구독 기간 무상 연장 일괄 (POST /order-items/bulk-extend)"""
    order_item_ids: List[int]
    extend_months: int = Field(1, ge=1)
    reason: Optional[str] = None


class OrderItemResponse(BaseModel):
    order_item_id: int
    external_order_item_id: Optional[str] = None
    order_id: int
    address_id: int
    product_code: str
    product_kind: str
    product_name: str
    list_price: int
    sale_price: int
    refund_amount: int = 0
    order_num: int
    subscribe_start_issue: str
    subscribe_end_issue: str
    final_subscribe_start_issue: str
    final_subscribe_end_issue: str
    subscribe_period: int
    last_send_issue: Optional[str] = None
    admin_memo: Optional[str] = None
    sended_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderItemDetailResponse(OrderItemResponse):
    """품목 상세 (휴지 목록 포함)"""
    pauses: List[PauseInfo] = []

