# 표준 라이브러리
import re
from typing import Dict, List, Literal, Optional

# 서드파티 라이브러리
from pydantic import BaseModel, Field, field_validator


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
    PAID + 호 범위 + 발송 이력 없는 YEARLY OrderItem 만 박스 추가 생성.
    정기는 1 OrderItem = 1 박스 매핑이라 묶음 재계산 불필요.
    """
    # YYYYMM — month 부분 01~12 강제 (예: 202613 같은 무의미한 값 차단)
    issue: str = Field(pattern=r"^\d{4}(0[1-9]|1[0-2])$", description="YYYYMM (필수)")


class AddToPreparingYearlyResponse(BaseModel):
    issue: str
    created_count: int


class TransitionSendItem(BaseModel):
    """[배송완료 처리] 시 Send 1개에 대한 운송장 입력.

    tracking_no는 입력에서 숫자만 추출해 저장 (공백·하이픈·문자 자동 제거).
    추출 결과가 비면 422 (운영자 실수로 인한 빈 운송장 저장 방지).
    SendTrackingUpdate / SendResendRequest와 동일 정책.
    """
    send_id: int
    tracking_no: str = Field(..., max_length=50, description="운송장 번호 (필수, 숫자만 추출되어 저장)")

    @field_validator("tracking_no", mode="before")
    @classmethod
    def _extract_digits(cls, v):
        if isinstance(v, str):
            digits = re.sub(r"\D", "", v)
            if digits == "":
                raise ValueError("tracking_no에서 숫자를 찾을 수 없습니다. 운송장 번호를 확인해주세요.")
            return digits
        return v


class TransitionToDeliveredRequest(BaseModel):
    """[배송완료 처리] 요청.

    여러 PREPARING Send를 한 번에 DELIVERED로 전환 ("보냈다 = 끝", SHIPPING 단계 없음).
    send_method/courier_company는 모든 Send에 공통 적용.
    tracking_no는 박스(Send)마다 개별 입력 (모두 필수).
    """
    sends: List[TransitionSendItem] = Field(..., min_length=1, description="전환할 Send 배열")
    send_method: Literal["기출유우편", "기출유택배", "일반우편", "찾아가기"] = Field(..., description="발송 방법")
    courier_company: Literal["CJ대한통운", "자체배송"] = Field(..., description="운송사 (send_method로부터 자동 도출되지만 수정 가능)")


class TransitionToDeliveredResponse(BaseModel):
    transitioned_count: int


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
