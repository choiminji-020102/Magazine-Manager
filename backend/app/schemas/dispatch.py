# 표준 라이브러리
import re
from typing import Dict, List, Literal, Optional

# 서드파티 라이브러리
from pydantic import BaseModel, Field, field_validator, model_validator


class DispatchTarget(BaseModel):
    """발송 대상 단건"""
    order_item_id: int
    order_id: int
    product_code: str
    product_name: str
    product_kind: str
    order_num: int
    subscribe_start_issue: str
    final_subscribe_end_issue: Optional[str] = None
    last_send_issue: Optional[str] = None
    # 배송지 정보
    address_id: Optional[int] = None
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    country_code: Optional[str] = None
    postal_code: Optional[str] = None
    recipient_address: Optional[str] = None
    customer_memo: Optional[str] = None

    class Config:
        from_attributes = True


class DispatchSummaryResponse(BaseModel):
    """발송 현황 요약"""
    issue: str
    total_target_count: int                            # 총 발송 대상 수
    dispatched_count: int                              # 이미 발송된 수
    pending_count: int                                 # 미발송 수
    by_product: List[dict]                             # [{product_code, product_name, total, dispatched, pending}]
    by_status: Dict[str, int]                          # Send 상태별 카운트


class RegeneratePreparingSendsRequest(BaseModel):
    """[발송 생성] 요청.

    - scope=monthly: 단품 PREPARING만 재계산. 활성 vipN 슬롯이 모두 false인 OrderItem 대상. issue 무관
    - scope=yearly: 정기구독 PREPARING만 재계산. 활성 vipN 슬롯이 모두 false인 OrderItem 대상. issue 필수
    - scope=vip1~vip6: 해당 슬롯의 PREPARING 재계산. Address.vipN=true 대상. 정기+단품 통합 그룹핑.
      issue 필수 (정기 SendItem 처리용). 슬롯 비활성이면 400.
    """
    scope: Literal["monthly", "yearly", "vip1", "vip2", "vip3", "vip4", "vip5", "vip6"]
    # YYYYMM — month 부분 01~12 강제 (예: 202613 같은 무의미한 값 차단)
    issue: Optional[str] = Field(default=None, pattern=r"^\d{4}(0[1-9]|1[0-2])$", description="YYYYMM (scope=yearly/vipN일 때 필수)")


class RegeneratePreparingSendsResponse(BaseModel):
    scope: str
    issue: Optional[str] = None
    deleted_count: int
    created_count: int


class AddToPreparingYearlyRequest(BaseModel):
    """[정기 신규 결제 추가] — incremental. 기존 PREPARING 박스는 건드리지 않고
    PAID + 호 범위 + 발송 내역 없는 YEARLY OrderItem 만 박스 추가 생성.
    정기는 1 OrderItem = 1 박스 매핑이라 묶음 재계산 불필요.
    """
    # YYYYMM — month 부분 01~12 강제 (예: 202613 같은 무의미한 값 차단)
    issue: str = Field(pattern=r"^\d{4}(0[1-9]|1[0-2])$", description="YYYYMM (필수)")


class AddToPreparingYearlyResponse(BaseModel):
    issue: str
    created_count: int


class TransitionSendItem(BaseModel):
    """[배송완료 처리] 시 Send 1개에 대한 운송장 입력.

    tracking_no는 필수. 숫자가 포함된 문자열은 숫자만 추출해 저장 (공백·하이픈 자동 제거).
    숫자가 없는 문자열("자체배송" 등)은 그대로 저장.
    기출유택배는 TransitionToDeliveredRequest 에서 숫자 운송장 번호 필수 추가 검증.
    """
    send_id: int
    tracking_no: str = Field(
        ...,
        max_length=50,
        description="운송장 번호 (필수. 기출유택배는 실제 운송장 번호, 나머지는 '자체배송' 등)",
    )

    @field_validator("tracking_no", mode="before")
    @classmethod
    def _normalize_tracking_no(cls, v):
        if v is None or (isinstance(v, str) and v.strip() == ""):
            raise ValueError("운송장 번호를 입력해주세요.")
        if isinstance(v, str):
            stripped = v.strip()
            if any(c.isdigit() for c in stripped):
                return re.sub(r"\D", "", stripped)
            return stripped  # "자체배송" 등 비숫자 문자열은 그대로
        return v


class TransitionToDeliveredRequest(BaseModel):
    """[배송완료 처리] 요청.

    여러 PREPARING Send를 한 번에 DELIVERED로 전환 ("보냈다 = 끝", SHIPPING 단계 없음).
    send_method/courier_company는 모든 Send에 공통 적용.
    tracking_no는 박스(Send)마다 필수 입력. 기출유택배는 숫자 운송장 번호 필수.
    """
    sends: List[TransitionSendItem] = Field(..., min_length=1, description="전환할 Send 배열")
    send_method: Literal["기출유우편", "기출유택배", "일반우편", "찾아가기"] = Field(..., description="발송 방법")
    courier_company: Literal["CJ대한통운", "자체배송"] = Field(..., description="운송사 (send_method로부터 자동 도출되지만 수정 가능)")

    @model_validator(mode="after")
    def _check_courier_tracking_no(self) -> "TransitionToDeliveredRequest":
        if self.send_method == "기출유택배":
            invalid = [s.send_id for s in self.sends if not s.tracking_no.isdigit()]
            if invalid:
                raise ValueError(f"기출유택배는 숫자 운송장 번호가 필요합니다. 누락된 send_id: {invalid}")
        return self


class TransitionFailedItem(BaseModel):
    """[배송완료 처리] 실패 건 — 성공/실패가 한 응답 안에 섞여서 나올 수 있음(부분 성공 허용)."""
    send_id: int
    # validation: 카페24를 시도하기도 전에 걸림(존재 안 함/이미 처리됨) — 카페24도 당연히 반영 안 됨
    # cafe24: 우리 시스템 검증은 통과했으나 카페24 API 호출이 실패함 — 이 경우도 우리 시스템 반영은 함께 취소됨
    category: Literal["validation", "cafe24"]
    recipient_name: str
    recipient_phone: str
    reason: str


class TransitionToDeliveredResponse(BaseModel):
    transitioned_count: int
    # transitioned_count 중 실제로 카페24 API 연동이 성공한 건수.
    # 오프라인/지마켓 채널이거나, YEARLY 재발송(2회차 이후)이면 카페24 연동 대상이 아니라
    # 이 수보다 transitioned_count가 더 클 수 있음 (그 차이는 "카페24 대상 아님"을 뜻함).
    cafe24_synced_count: int
    failed: List[TransitionFailedItem] = []


class PreviewSkippedIssuesRequest(BaseModel):
    """[발송 생성] 사전 미리보기 — 순차 위반(중간 호 누락) 후보 검사 요청.

    scope=monthly 는 호 무관이라 호출 의미 없음 (백엔드 빈 응답 반환).
    yearly / vip1..6 만 의미 있음.
    """
    scope: Literal["monthly", "yearly", "vip1", "vip2", "vip3", "vip4", "vip5", "vip6"]
    issue: str = Field(pattern=r"^\d{4}(0[1-9]|1[0-2])$", description="YYYYMM (필수)")


class SequenceViolationItem(BaseModel):
    """순차 발송 위반 한 건 — 미리보기에 표시할 OrderItem 정보."""
    order_item_id: int
    product_code: str
    recipient_name: str
    missing_issues: List[str]


class PreviewSkippedIssuesResponse(BaseModel):
    """순차 위반 미리보기 결과.

    - violation_count: 위반 OrderItem 총 개수
    - samples: 표시용 샘플 (최대 3건). violation_count 가 0 이면 빈 리스트.
    """
    violation_count: int
    samples: List[SequenceViolationItem]


class PaidNotPreparedCountResponse(BaseModel):
    """PreparingSendListPage 카운트 배너용 — 두 묶음을 한 응답에 담음.

    *_count (8 키 + total_count): "신규 결제" — PAID 지만 PREPARING 에 아직 안 들어간 OrderItem.
        다음 [발송 생성] 시 박스에 들어갈 후보. (PR5)

    *_preparing (8 키 + total_preparing): "박스 처리됨" — 현재 PREPARING Send 의 활성 SendItem 안
        OrderItem 수. 이미 박스에 들어가 있는 것. (PR5.1)

    분해 정책 (두 묶음 동일):
    - monthly/yearly = KR + 활성 vipN 모두 false + 해당 product_kind
    - vipN = Address.vipN=true (country_code 무관, kind 무관). 비활성 슬롯은 0
    - 단일성 제약(V-7) 덕에 8 키 합계 = 묶음별 total

    프론트 카운트 배너: "📦 박스 처리 {*_preparing} / {*_preparing + *_count}건 · 🔔 신규 결제 {*_count}건"
    """
    # 신규 결제 (PAID 미반영)
    monthly_count: int
    yearly_count: int
    vip1_count: int = 0
    vip2_count: int = 0
    vip3_count: int = 0
    vip4_count: int = 0
    vip5_count: int = 0
    vip6_count: int = 0
    total_count: int

    # 박스 처리됨 (현재 PREPARING)
    monthly_preparing: int = 0
    yearly_preparing: int = 0
    vip1_preparing: int = 0
    vip2_preparing: int = 0
    vip3_preparing: int = 0
    vip4_preparing: int = 0
    vip5_preparing: int = 0
    vip6_preparing: int = 0
    total_preparing: int = 0
