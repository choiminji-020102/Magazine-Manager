# 표준 라이브러리
from datetime import datetime
from enum import Enum
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field, model_validator


class OrderChannel(str, Enum):
    CAFE24 = "CAFE24"
    GPMALL = "GPMALL"
    OFFLINE = "OFFLINE"


class OrderStatus(str, Enum):
    ORDERED = "ORDERED"
    PAID = "PAID"
    CANCELLED = "CANCELLED"                  # 결제 후 취소 (환불 처리됨)
    UNPAID_CANCELLED = "UNPAID_CANCELLED"    # 결제 전 취소 (환불 불필요)


class PaymentMethod(str, Enum):
    CASH = "cash"      # 무통장
    CARD = "card"      # 신용카드
    ICASH = "icash"    # 가상계좌
    TCASH = "tcash"    # 계좌이체


# ── 주문 생성용 인라인 입력 ────────────────────────────────────────────────────

class OrderCustomerInput(BaseModel):
    """주문 생성 시 신규 고객 정보 인라인 입력 (customer_id 없을 때 사용)"""
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    create_channel: Optional[str] = None
    admin_memo: Optional[str] = None


class OrderAddressInput(BaseModel):
    """주문 생성 시 신규 배송지 정보 인라인 입력 (address_id 없을 때 사용)"""
    recipient_name: str
    recipient_phone: str
    country_code: str = "KR"
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None


class OrderItemCreateInOrder(BaseModel):
    """주문 생성 시 인라인 품목 입력
    - OrderItemCreate와의 차이: order_id, address_id 불필요 (부모 Order에서 자동 설정)
    - subscribe_start_issue는 선택한 상품(Product)의 product_code에서 자동 결정
    """
    product_code: str
    order_num: int = 1
    sale_price: Optional[int] = None        # 미입력 시 상품 판매가 자동 사용
    subscribe_period: int = 12              # 구독 기간 (개월), YEARLY 전용
    admin_memo: Optional[str] = None
    external_order_item_id: Optional[str] = None  # Cafe24 등 외부몰 품목 식별자 (예: "20260101-0000001-01")


# ── CRUD 스키마 ───────────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    # customer_id(기존) 또는 customer(신규) 중 하나 필수
    customer_id: Optional[int] = None
    customer: Optional[OrderCustomerInput] = None

    # address_id(기존) 또는 address(신규) 중 하나 필수
    address_id: Optional[int] = None
    address: Optional[OrderAddressInput] = None

    items: List[OrderItemCreateInOrder]

    external_order_id: Optional[str] = None
    order_channel: OrderChannel = OrderChannel.OFFLINE
    order_status: OrderStatus = OrderStatus.ORDERED

    send_fee: Optional[int] = None          # 미입력 시 자동 설정 (MONTHLY: 3300, YEARLY: 0)
    payment_method: PaymentMethod           # 필수 — 오프라인 주문 등록 시 결제 방법 지정

    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None

    order_at: Optional[datetime] = None     # 미입력 시 현재 시각 (Cafe24 연동 시 실제 주문 시각)
    payment_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None # Cafe24 연동 시 canceled=T인 주문의 취소 시각

    @model_validator(mode='after')
    def check_customer_and_address(self) -> 'OrderCreate':
        if not self.customer_id and not self.customer:
            raise ValueError("customer_id 또는 customer 정보 중 하나가 필요합니다.")
        if not self.address_id and not self.address:
            raise ValueError("address_id 또는 address 정보 중 하나가 필요합니다.")
        return self


class OrderUpdate(BaseModel):
    # ⚠️ address_id 변경 시 해당 Order의 모든 OrderItem 배송지 일괄 변경됨
    # 프론트엔드에서 반드시 경고 모달 표시 후 진행
    address_id: Optional[int] = None
    order_channel: Optional[OrderChannel] = None
    discount_amount: Optional[int] = None
    refund_amount: Optional[int] = None
    send_fee: Optional[int] = None
    payment_method: Optional[PaymentMethod] = None
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    payment_at: Optional[datetime] = None


class OrderCancelRequest(BaseModel):
    admin_memo: str                         # 취소 사유, 필수
    refund_amount: Optional[int] = None     # 미입력 시 자동 계산
    refund_bank: Optional[str] = None       # 환불 은행명
    refund_account: Optional[str] = None    # 환불 계좌번호


class OrderCancelItemDetail(BaseModel):
    """취소 계산 내역 — 품목별"""
    order_item_id: int
    product_name: str
    product_kind: str                       # MONTHLY / YEARLY
    sale_price: int
    order_num: int
    delivered_count: int                    # 배송 완료 회차 수
    total_period: Optional[int] = None      # 전체 구독 기간 (YEARLY만)
    remaining_period: Optional[int] = None  # 잔여 회차 (YEARLY만)
    unit_price: Optional[int] = None        # 회차당 단가 (YEARLY 부분 환불 시)
    item_refund: int                        # 이 품목의 환불금


class OrderCancelCalculateResponse(BaseModel):
    """취소 환불 계산 미리보기"""
    order_status: str
    items: List[OrderCancelItemDetail]
    subtotal: int                           # 품목 환불 합계
    send_fee: int                           # 배송비 환불
    discount_amount: int                    # 할인금액 차감
    total_refund: int                       # 최종 환불금
    payment_amount: int                     # 결제금 (참고용)


class OrderPaymentUpdate(BaseModel):
    """결제 완료 처리"""
    payment_method: Optional[PaymentMethod] = None
    payment_at: Optional[datetime] = None   # 미입력 시 현재 시각


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class OrderResponse(BaseModel):
    order_id: int
    customer_id: int
    external_order_id: Optional[str] = None
    address_id: int
    order_channel: str
    order_status: str
    total_amount: int
    discount_amount: int = 0
    refund_amount: int = 0
    send_fee: int = 0
    payment_amount: int
    payment_method: Optional[PaymentMethod] = None
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    order_at: datetime
    payment_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    """목록 조회용 경량 응답 (고객·배송지 정보 포함)"""
    order_id: int
    customer_id: int
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    external_order_id: Optional[str] = None
    address_id: int
    # 배송지 스냅샷 (Address LEFT JOIN — 카드 그리드 표시용)
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    country_code: Optional[str] = None
    postal_code: Optional[str] = None
    recipient_address: Optional[str] = None
    order_channel: str
    order_status: str
    total_amount: int
    discount_amount: int = 0
    refund_amount: int = 0
    send_fee: int = 0
    payment_amount: int
    payment_method: Optional[PaymentMethod] = None
    order_at: datetime
    payment_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    item_count: int = 0
    vip1: bool = False
    vip2: bool = False
    vip3: bool = False
    vip4: bool = False
    vip5: bool = False
    vip6: bool = False


# ── 목록 쿼리 스키마 ──────────────────────────────────────────────────────────

class OrderListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    order_channel: Optional[OrderChannel] = None
    order_status: Optional[OrderStatus] = None
    start_date: Optional[str] = None            # order_at 범위 시작 (YYYY-MM-DD)
    end_date: Optional[str] = None              # order_at 범위 종료 (YYYY-MM-DD)
    external_order_id: Optional[str] = None     # 외부 주문 ID 검색
    customer_search: Optional[str] = None       # 주문자 이름/연락처
    recipient_search: Optional[str] = None      # 수령인 이름/연락처
    payment_method: Optional[PaymentMethod] = None
    admin_memo: Optional[str] = None
    sort_by: str = "created_at"                 # created_at | order_at | payment_at | updated_at
    sort_order: str = "desc"                    # asc | desc

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        order_channel: Optional[OrderChannel] = Query(None),
        order_status: Optional[OrderStatus] = Query(None),
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        external_order_id: Optional[str] = Query(None),
        customer_search: Optional[str] = Query(None),
        recipient_search: Optional[str] = Query(None),
        payment_method: Optional[PaymentMethod] = Query(None),
        admin_memo: Optional[str] = Query(None),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("desc"),
    ):
        return cls(
            page=page,
            limit=limit,
            order_channel=order_channel,
            order_status=order_status,
            start_date=start_date,
            end_date=end_date,
            external_order_id=external_order_id,
            customer_search=customer_search,
            recipient_search=recipient_search,
            payment_method=payment_method,
            admin_memo=admin_memo,
            sort_by=sort_by,
            sort_order=sort_order,
        )
