# 표준 라이브러리
from datetime import date, datetime
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field, model_validator

# 로컬 애플리케이션
from app.schemas.send_item import SendItemResponse


# ── 생성/수정 스키마 ──────────────────────────────────────────────────────────

class SendItemInput(BaseModel):
    """SendCreate.items 내 품목 입력"""
    order_item_id: int
    issue: str                              # 발송 호 (YYYYMM, 필수)
    send_num: int = 1


class SendAddressInput(BaseModel):
    """신규 배송지 입력 (address_id 없을 때)"""
    recipient_name: str
    recipient_phone: str
    country_code: str = "KR"
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None


class SendCreate(BaseModel):
    order_id: int
    # 배송지: address_id(기존) 또는 address(신규) 중 하나 필수
    address_id: Optional[int] = None
    address: Optional[SendAddressInput] = None
    # 발송 정보
    official_send_date: Optional[date] = None   # 공식 발송 예정일 (YEARLY, 생성 시 1회 설정)
    admin_memo: Optional[str] = None
    # 발송 품목
    items: List[SendItemInput]                  # 필수, 최소 1개


class SendUpdate(BaseModel):
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    country_code: Optional[str] = None
    postal_code: Optional[str] = None
    recipient_address: Optional[str] = None
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    # ※ official_send_date 수정 불가 (생성 시 1회 설정)


class SendStatusUpdate(BaseModel):
    send_status: str                            # SHIPPING | DELIVERED | CANCELLED
    tracking_no: Optional[str] = None          # SHIPPING 변경 시 필수 (MONTHLY)
    courier_company: Optional[str] = None


class SendBatchStatusRequest(BaseModel):
    """일괄 상태 전환 요청"""
    send_ids: List[int]


class SendBatchStatusResult(BaseModel):
    """일괄 상태 전환 단건 결과"""
    send_id: int
    success: bool
    message: Optional[str] = None


class SendBatchStatusResponse(BaseModel):
    """일괄 상태 전환 응답"""
    total: int
    success_count: int
    fail_count: int
    results: List[SendBatchStatusResult]


class SendTrackingUpdate(BaseModel):
    """SHIPPING/DELIVERED Send의 운송장/배송업체/배송방법 수정 (PATCH).

    셋 다 Optional — 들어온 필드만 갱신.
    빈 문자열/공백 문자열은 None으로 취급(안전망 — 실수로 빈 칸 전송 시 데이터 손상 방지).
    정규화 후 셋 다 None이면 422 거부.
    send_method와 courier_company는 완전 독립 (자동 도출 안 함).
    """
    tracking_no: Optional[str] = None
    send_method: Optional[str] = Field(
        default=None,
        description="기출유우편 | 기출유택배 | 일반우편 | 찾아가기",
    )
    courier_company: Optional[str] = Field(
        default=None,
        description="CJ대한통운 | 자체배송",
    )

    @model_validator(mode="after")
    def _normalize_and_validate(self) -> "SendTrackingUpdate":
        # 1. send_method/courier_company는 strip → 빈 문자열이면 None (옵션 B 안전망)
        if isinstance(self.send_method, str):
            self.send_method = self.send_method.strip() or None
        if isinstance(self.courier_company, str):
            self.courier_company = self.courier_company.strip() or None
        # 2. tracking_no는 strip 후 ① 빈 문자열이면 None ② 그 외엔 숫자만 허용 (공백/하이픈/문자 불가)
        if isinstance(self.tracking_no, str):
            stripped = self.tracking_no.strip()
            if stripped == "":
                self.tracking_no = None
            elif not stripped.isdigit():
                raise ValueError("tracking_no는 숫자만 입력 가능합니다 (공백·하이픈·문자 불가).")
            else:
                self.tracking_no = stripped
        # 3. 정규화 후 셋 다 비어있으면 거부
        if self.tracking_no is None and self.send_method is None and self.courier_company is None:
            raise ValueError("tracking_no, send_method, courier_company 중 최소 1개를 입력해야 합니다.")
        return self


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class SendResponse(BaseModel):
    send_id: int
    order_id: int
    address_id: Optional[int] = None
    send_status: str
    courier_company: Optional[str] = None
    tracking_no: Optional[str] = None
    recipient_name: str
    recipient_phone: str
    country_code: str
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
    official_send_date: Optional[date] = None
    prepared_at: Optional[datetime] = None
    shipped_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SendDetailResponse(SendResponse):
    """상세 조회 (발송 품목 포함)"""
    items: List[SendItemResponse] = []


# ── 목록 쿼리 스키마 ──────────────────────────────────────────────────────────

class SendListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    send_status: Optional[str] = None
    courier_company: Optional[str] = None
    tracking_no: Optional[str] = None
    official_send_date: Optional[str] = None    # YYYY-MM-DD
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    is_cancelled: Optional[bool] = None
    recipient_search: Optional[str] = None      # 수령인 이름/연락처
    postal_code: Optional[str] = None
    issue: Optional[str] = None                 # SendItem.issue 기준 필터 (YYYYMM)
    product_kind: Optional[str] = None          # YEARLY | MONTHLY (SendItem → OrderItem 조인)
    sort_by: str = "created_at"
    sort_order: str = "desc"

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1),
        limit: int = Query(20, ge=1, le=100),
        send_status: Optional[str] = Query(None),
        courier_company: Optional[str] = Query(None),
        tracking_no: Optional[str] = Query(None),
        official_send_date: Optional[str] = Query(None),
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None),
        is_cancelled: Optional[bool] = Query(None),
        recipient_search: Optional[str] = Query(None),
        postal_code: Optional[str] = Query(None),
        issue: Optional[str] = Query(None),
        product_kind: Optional[str] = Query(None),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("desc"),
    ):
        return cls(
            page=page,
            limit=limit,
            send_status=send_status,
            courier_company=courier_company,
            tracking_no=tracking_no,
            official_send_date=official_send_date,
            start_date=start_date,
            end_date=end_date,
            is_cancelled=is_cancelled,
            recipient_search=recipient_search,
            postal_code=postal_code,
            issue=issue,
            product_kind=product_kind,
            sort_by=sort_by,
            sort_order=sort_order,
        )
