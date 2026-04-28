# 표준 라이브러리
from datetime import datetime
from typing import List, Literal, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field, field_validator, model_validator

# 로컬 애플리케이션
from app.schemas.send_item import SendItemResponse


# ── 수정 스키마 ──────────────────────────────────────────────────────────

class SendUpdate(BaseModel):
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    country_code: Optional[str] = None
    postal_code: Optional[str] = None
    recipient_address: Optional[str] = None
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None


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


SendMethodLiteral = Literal["기출유우편", "기출유택배", "일반우편", "찾아가기"]
CourierCompanyLiteral = Literal["CJ대한통운", "자체배송"]


class SendTrackingUpdate(BaseModel):
    """SHIPPING/DELIVERED Send의 운송장/배송업체/배송방법 수정 (PATCH).

    셋 다 Optional — 들어온 필드만 갱신.
    빈 문자열/공백 문자열은 None으로 취급(안전망 — 실수로 빈 칸 전송 시 데이터 손상 방지).
    send_method/courier_company는 Literal로 enum 강제 (잘못된 값 → 422).
    tracking_no는 strip 후 숫자만 허용 (공백·하이픈·문자 → 422).
    정규화 후 셋 다 None이면 422.
    send_method와 courier_company는 완전 독립 (자동 도출 안 함).
    """
    tracking_no: Optional[str] = None
    send_method: Optional[SendMethodLiteral] = None
    courier_company: Optional[CourierCompanyLiteral] = None

    # send_method/courier_company는 strip → 빈 문자열이면 None (Literal 검증 통과시키기 위함)
    @field_validator("send_method", "courier_company", mode="before")
    @classmethod
    def _strip_or_none(cls, v):
        if isinstance(v, str):
            return v.strip() or None
        return v

    @model_validator(mode="after")
    def _validate_tracking_and_at_least_one(self) -> "SendTrackingUpdate":
        # tracking_no: strip 후 ① 빈 문자열이면 None ② 그 외엔 숫자만 허용
        if isinstance(self.tracking_no, str):
            stripped = self.tracking_no.strip()
            if stripped == "":
                self.tracking_no = None
            elif not stripped.isdigit():
                raise ValueError("tracking_no는 숫자만 입력 가능합니다 (공백·하이픈·문자 불가).")
            else:
                self.tracking_no = stripped
        # 정규화 후 셋 다 비어있으면 거부
        if self.tracking_no is None and self.send_method is None and self.courier_company is None:
            raise ValueError("tracking_no, send_method, courier_company 중 최소 1개를 입력해야 합니다.")
        return self


class SendResendRequest(BaseModel):
    """SHIPPING/DELIVERED Send에 대한 재배송 이력 입력 (POST /sends/{send_id}/resend).

    Send 본체 변경 없음 — 활동 로그(action=RESEND) details에만 기록.
    reason/send_method/courier_company는 필수, tracking_no/memo는 선택.
    send_method ↔ courier_company 자동 도출 안 함 (프론트에서 도출 + 운영자 수정).
    tracking_no는 SendTrackingUpdate와 동일 정규화 (strip 후 숫자만, 빈/공백 → None).
    """
    reason: str
    send_method: SendMethodLiteral
    courier_company: CourierCompanyLiteral
    tracking_no: Optional[str] = None
    memo: Optional[str] = None

    @field_validator("reason", mode="before")
    @classmethod
    def _strip_reason(cls, v):
        if isinstance(v, str):
            stripped = v.strip()
            if stripped == "":
                raise ValueError("reason은 비어있을 수 없습니다.")
            return stripped
        return v

    @field_validator("memo", mode="before")
    @classmethod
    def _strip_memo_or_none(cls, v):
        if isinstance(v, str):
            return v.strip() or None
        return v

    @model_validator(mode="after")
    def _normalize_tracking_no(self) -> "SendResendRequest":
        if isinstance(self.tracking_no, str):
            stripped = self.tracking_no.strip()
            if stripped == "":
                self.tracking_no = None
            elif not stripped.isdigit():
                raise ValueError("tracking_no는 숫자만 입력 가능합니다 (공백·하이픈·문자 불가).")
            else:
                self.tracking_no = stripped
        return self


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class SendResponse(BaseModel):
    send_id: int
    order_ids: List[int] = []                   # SendItem→OrderItem 경유 derived (Send 모델 @property)
    address_id: Optional[int] = None
    send_status: str
    send_method: Optional[str] = None
    courier_company: Optional[str] = None
    tracking_no: Optional[str] = None
    recipient_name: str
    recipient_phone: str
    country_code: str
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    admin_memo: Optional[str] = None
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
