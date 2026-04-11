# 표준 라이브러리
from datetime import datetime
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field, model_validator

# 로컬 애플리케이션
from app.schemas.address import AddressCreate, AddressResponse


# ── 생성/수정 스키마 ──────────────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    """독립 품목 추가 (POST /api/order-items)
    - OrderItemCreateInOrder와의 차이:
      - OrderItemCreateInOrder: 주문 생성과 동시에 items 배열에서 사용, order_id/address_id 불필요
      - OrderItemCreate: 이미 존재하는 주문에 품목을 독립적으로 추가, order_id/address_id 직접 지정 필수
    """
    order_id: int
    address_id: int
    product_code: str
    order_num: int = 1
    sale_price: Optional[int] = None            # 미입력 시 상품 판매가 자동 사용
    subscribe_start_issue: str                  # 필수 (YYYYMM) — 생성 후 절대 수정 불가
    subscribe_period: int = 12                  # 구독 기간 (개월)
    admin_memo: Optional[str] = None
    external_order_item_id: Optional[str] = None


class OrderItemUpdate(BaseModel):
    # ⚠️ subscribe_start_issue, subscribe_end_issue 수정 불가 (불변 필드)
    # 배송지 변경은 PATCH /order-items/{id}/address 사용
    # 구독 기간 조정은 /extend, /change-period, /shorten 엔드포인트 사용
    order_num: Optional[int] = None
    sale_price: Optional[int] = None
    refund_amount: Optional[int] = None
    subscribe_period: Optional[int] = None
    final_subscribe_start_issue: Optional[str] = None
    final_subscribe_end_issue: Optional[str] = None
    admin_memo: Optional[str] = None


class OrderItemAddressUpdate(BaseModel):
    """배송지 수정: address_id(기존) 또는 new_address(신규) 중 하나 필수"""
    address_id: Optional[int] = None
    new_address: Optional[AddressCreate] = None

    @model_validator(mode='after')
    def check_address(self) -> 'OrderItemAddressUpdate':
        if not self.address_id and not self.new_address:
            raise ValueError("address_id 또는 new_address 중 하나가 필요합니다.")
        return self


class OrderItemCancelRequest(BaseModel):
    admin_memo: str                             # 취소 사유, 필수
    refund_amount: Optional[int] = None         # 미입력 시 자동 계산


class OrderItemLastSendIssueUpdate(BaseModel):
    last_send_issue: str                        # 필수 (YYYYMM)


# ── 구독 기간 조정 스키마 ─────────────────────────────────────────────────────

class SubscriptionExtendRequest(BaseModel):
    """구독 기간 연장 - 단건"""
    extend_months: Optional[int] = None         # extend_end_issue와 둘 중 하나 필수
    extend_end_issue: Optional[str] = None      # YYYYMM, extend_months와 둘 중 하나 필수
    is_paid: bool = False                       # True = 유료 연장 (paid_subscribe_end_issue도 갱신), False = 무상 연장
    reason: Optional[str] = None               # 연장 사유

    @model_validator(mode='after')
    def check_extend(self) -> 'SubscriptionExtendRequest':
        if not self.extend_months and not self.extend_end_issue:
            raise ValueError("extend_months 또는 extend_end_issue 중 하나가 필요합니다.")
        return self


class SubscriptionBatchExtendRequest(BaseModel):
    """구독 기간 연장 - 다건 일괄 (휴지 없이, 무상 연장)"""
    order_item_ids: List[int]
    extend_months: int = Field(..., ge=1)
    reason: str                                 # 필수


class SubscriptionBatchExtendResultItem(BaseModel):
    order_item_id: int
    success: bool
    prev_end_issue: Optional[str] = None        # 변경 전 종료 호
    new_end_issue: Optional[str] = None         # 변경 후 종료 호
    error: Optional[str] = None                # 실패 사유


class SubscriptionBatchExtendResponse(BaseModel):
    total_requested: int
    success_count: int
    fail_count: int
    results: List[SubscriptionBatchExtendResultItem]


class SubscriptionChangePeriodRequest(BaseModel):
    """구독 기간 이동 (앞으로 당기기 / 뒤로 밀기)"""
    new_start_issue: str                        # 새 구독 시작 호 (YYYYMM) — final_subscribe_start_issue에 저장


class SubscriptionShortenCalculateRequest(BaseModel):
    """구독 기간 단축 - 환불액 미리 계산 (DB 변경 없음)
    shorten_end_issue 또는 shorten_months 중 하나 필수"""
    shorten_end_issue: Optional[str] = None     # 단축 종료 호 (YYYYMM)
    shorten_months: Optional[int] = None        # 단축 개월 수


class SubscriptionShortenCalculateResponse(BaseModel):
    current_end_issue: str
    shorten_end_issue: str
    shorten_count: int              # 단축 회차 수
    paid_period: int                # 유료 구독 기간 (총 개월)
    unit_price: int                 # 회차당 단가 (sale_price // paid_period)
    sale_price: int                 # 품목 판매가
    order_num: int                  # 수량
    refund_amount: int              # 최종 환불금


class SubscriptionShortenConfirmRequest(BaseModel):
    """구독 기간 단축 - 최종 확인 및 저장"""
    shorten_end_issue: str
    refund_confirmed: bool                      # false면 저장 불가
    refund_bank: Optional[str] = None           # 환불 은행명
    refund_account: Optional[str] = None        # 환불 계좌번호


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class PauseInfo(BaseModel):
    pause_id: int
    pause_issue: str
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class OrderItemAddressUpdateResponse(BaseModel):
    can_change: bool
    changed_address_id: Optional[int] = None
    already_shipped_issues: List[str] = []      # 이미 발송된 호 (변경 불가)
    pending_issues: List[str] = []              # 미발송 예정 호 (변경 적용됨)
    message: str


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
    paid_subscribe_end_issue: str
    subscribe_period: int
    last_send_issue: Optional[str] = None
    admin_memo: Optional[str] = None
    sended_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    address: Optional[AddressResponse] = None   # 품목별 배송지

    class Config:
        from_attributes = True


class OrderItemDetailResponse(OrderItemResponse):
    """품목 상세 (휴지 목록 포함)"""
    pauses: List[PauseInfo] = []


# ── 구독 목록 응답 스키마 ─────────────────────────────────────────────────────

class SubscriptionListItem(OrderItemResponse):
    """구독 목록 조회용 — 고객 정보 + 주문 채널 추가"""
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    order_channel: Optional[str] = None


# ── 목록 쿼리 스키마 ──────────────────────────────────────────────────────────

class OrderItemListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    product_kind: Optional[str] = None
    product_code: Optional[str] = None
    customer_search: Optional[str] = None       # 고객명 or 연락처
    is_cancelled: Optional[bool] = None         # None=전체, True=취소만, False=활성만
    end_issue_from: Optional[str] = None        # final_subscribe_end_issue >=
    end_issue_to: Optional[str] = None          # final_subscribe_end_issue <=
    sort_by: str = "created_at"
    sort_order: str = "desc"

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        product_kind: Optional[str] = Query(None),
        product_code: Optional[str] = Query(None),
        customer_search: Optional[str] = Query(None),
        is_cancelled: Optional[bool] = Query(None),
        end_issue_from: Optional[str] = Query(None),
        end_issue_to: Optional[str] = Query(None),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("desc"),
    ):
        return cls(
            page=page,
            limit=limit,
            product_kind=product_kind,
            product_code=product_code,
            customer_search=customer_search,
            is_cancelled=is_cancelled,
            end_issue_from=end_issue_from,
            end_issue_to=end_issue_to,
            sort_by=sort_by,
            sort_order=sort_order,
        )


class OrderItemPostalCode13113Query(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    product_kind: Optional[str] = None
    is_cancelled: bool = False
    sort_by: str = "created_at"
    sort_order: str = "desc"

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        product_kind: Optional[str] = Query(None),
        is_cancelled: bool = Query(False),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("desc"),
    ):
        return cls(
            page=page,
            limit=limit,
            product_kind=product_kind,
            is_cancelled=is_cancelled,
            sort_by=sort_by,
            sort_order=sort_order,
        )
