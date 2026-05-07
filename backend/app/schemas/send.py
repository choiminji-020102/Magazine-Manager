# 표준 라이브러리
import re
from datetime import datetime
from typing import List, Literal, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field, field_validator, model_validator

# 로컬 애플리케이션
from app.schemas.send_item import SendItemResponse


# ── 수정 스키마 ──────────────────────────────────────────────────────────

SendMethodLiteral = Literal["기출유우편", "기출유택배", "일반우편", "찾아가기"]
CourierCompanyLiteral = Literal["CJ대한통운", "자체배송"]


class SendTrackingUpdate(BaseModel):
    """DELIVERED Send의 운송장/배송업체/배송방법 수정 (PATCH).

    셋 다 Optional — 들어온 필드만 갱신.
    send_method/courier_company는 빈/공백 문자열은 None으로 취급, Literal로 enum 강제 (잘못된 값 → 422).
    tracking_no는 입력에서 숫자만 추출해 저장 (공백·하이픈·문자 자동 제거).
      - 추출 결과가 비면 422 (운영자 실수로 인한 빈 운송장 저장 방지)
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

    @field_validator("tracking_no", mode="before")
    @classmethod
    def _extract_digits(cls, v):
        if isinstance(v, str):
            digits = re.sub(r"\D", "", v)
            if digits == "":
                raise ValueError("tracking_no에서 숫자를 찾을 수 없습니다. 운송장 번호를 확인해주세요.")
            return digits
        return v

    @model_validator(mode="after")
    def _validate_at_least_one(self) -> "SendTrackingUpdate":
        if self.tracking_no is None and self.send_method is None and self.courier_company is None:
            raise ValueError("tracking_no, send_method, courier_company 중 최소 1개를 입력해야 합니다.")
        return self


class SendAdminMemoUpdate(BaseModel):
    """Send 관리자 메모 수정 (PATCH /sends/{send_id}/admin-memo).

    상태 무관 (PREPARING/DELIVERED/CANCELLED 모두 허용).
    빈/공백 문자열은 None 으로 저장 (메모 삭제 의도로 처리).
    길이 제한 1000자 (운영 메모는 보통 한 줄~한 단락).
    """
    admin_memo: Optional[str] = Field(default=None, max_length=1000)

    @field_validator("admin_memo", mode="before")
    @classmethod
    def _strip_or_none(cls, v):
        if isinstance(v, str):
            return v.strip() or None
        return v


class SendResendRequest(BaseModel):
    """DELIVERED Send에 대한 재배송 이력 입력 (POST /sends/{send_id}/resend).

    Send 본체 변경 없음 — 활동 로그(action=RESEND) details에만 기록.
    reason/send_method/courier_company/send_item_ids는 필수, tracking_no/memo는 선택.
    send_method ↔ courier_company 자동 도출 안 함 (프론트에서 도출 + 운영자 수정).
    tracking_no는 SendTrackingUpdate와 동일 정규화 — 입력에서 숫자만 추출해 저장.
      - 추출 결과가 비면 422
    send_item_ids는 재발송 대상 SendItem ID 배열 (최소 1개). 박스 통째 재발송 시
    UI가 모든 SendItem ID를 채워서 보냄 (해당 send_id에 속하지 않은 ID 포함 시 422).
    """
    reason: str
    send_method: SendMethodLiteral
    courier_company: CourierCompanyLiteral
    send_item_ids: List[int] = Field(..., min_length=1, description="재발송 대상 SendItem ID 배열")
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

    @field_validator("send_method", "courier_company", mode="before")
    @classmethod
    def _strip_enum(cls, v):
        # 운영자 실수로 앞뒤 공백 들어가도 Literal 매칭되도록 strip (PATCH /tracking과 동일 패턴)
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("memo", mode="before")
    @classmethod
    def _strip_memo_or_none(cls, v):
        if isinstance(v, str):
            return v.strip() or None
        return v

    @field_validator("tracking_no", mode="before")
    @classmethod
    def _extract_digits(cls, v):
        if isinstance(v, str):
            digits = re.sub(r"\D", "", v)
            if digits == "":
                raise ValueError("tracking_no에서 숫자를 찾을 수 없습니다. 운송장 번호를 확인해주세요.")
            return digits
        return v


# ── 응답 스키마 ───────────────────────────────────────────────────────────────

class RelatedOrderInfo(BaseModel):
    """Send 에 묶인 주문 정보 (자기 주문 외 묶인 주문 표시용).

    SendItem → OrderItem → Order → Customer 경유 derived.
    OrderDetailPanel 에서 자기 자신 orderId 는 프론트가 필터링.
    """
    order_id: int
    customer_name: str
    customer_phone: str

    class Config:
        from_attributes = True


class SendResponse(BaseModel):
    send_id: int
    order_ids: List[int] = []                   # SendItem→OrderItem 경유 derived (Send 모델 @property)
    related_orders: List[RelatedOrderInfo] = [] # 묶인 주문 정보 (이름/전화 포함)
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
    vip_slot_number: Optional[int] = Field(     # SendItem→OrderItem→Address.vipN=true 필터
        None, ge=1, le=6,
        description="VIP 슬롯 번호 (1~6) — Address.vipN=true 인 Send 만",
    )
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
        vip_slot_number: Optional[int] = Query(None, ge=1, le=6),
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
            vip_slot_number=vip_slot_number,
            sort_by=sort_by,
            sort_order=sort_order,
        )
