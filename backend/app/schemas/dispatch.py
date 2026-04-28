# 표준 라이브러리
from typing import Dict, List, Literal, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field
from datetime import date


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


class DispatchTargetListQuery(BaseModel):
    """발송 대상 목록 조회 쿼리"""
    issue: str                                          # 발송할 호 (YYYYMM, 필수)
    product_code: Optional[str] = None
    recipient_search: Optional[str] = None             # 수령인 이름/연락처 검색
    page: int = Field(1, ge=1)
    limit: int = Field(100, ge=1, le=1000)             # 발송 대상은 일괄 처리용이라 limit 크게
    sort_by: str = "created_at"
    sort_order: str = "asc"

    @classmethod
    def as_query_params(
        cls,
        issue: str = Query(..., description="발송할 호 (YYYYMM 형식)"),
        product_code: Optional[str] = Query(None),
        recipient_search: Optional[str] = Query(None),
        page: int = Query(1, ge=1),
        limit: int = Query(100, ge=1, le=1000),
        sort_by: str = Query("created_at"),
        sort_order: str = Query("asc"),
    ):
        return cls(
            issue=issue,
            product_code=product_code,
            recipient_search=recipient_search,
            page=page,
            limit=limit,
            sort_by=sort_by,
            sort_order=sort_order,
        )


class DispatchTargetsResponse(BaseModel):
    """발송 대상 목록 + 요약"""
    issue: str
    targets: List[DispatchTarget]
    total_count: int
    page: int
    limit: int
    total_pages: int
    product_summary: Dict[str, int]                    # {product_code: count}


class DispatchGenerateRequest(BaseModel):
    """일괄 발송 처리 요청"""
    issue: str                                         # 발송할 호 (YYYYMM)
    official_send_date: Optional[date] = None          # 공식 발송 예정일
    order_item_ids: List[int]                          # 발송 처리할 OrderItem ID 목록


class DispatchGenerateResult(BaseModel):
    """단건 발송 처리 결과"""
    order_item_id: int
    success: bool
    send_id: Optional[int] = None                      # 생성된 Send ID (성공 시)
    message: Optional[str] = None                      # 실패/스킵 사유


class DispatchGenerateResponse(BaseModel):
    """일괄 발송 처리 응답"""
    issue: str
    total_requested: int
    success_count: int
    fail_count: int
    results: List[DispatchGenerateResult]


class DispatchSummaryResponse(BaseModel):
    """발송 현황 요약"""
    issue: str
    total_target_count: int                            # 총 발송 대상 수
    dispatched_count: int                              # 이미 발송된 수
    pending_count: int                                 # 미발송 수
    by_product: List[dict]                             # [{product_code, product_name, total, dispatched, pending}]
    by_status: Dict[str, int]                          # Send 상태별 카운트


class DispatchTrackingUploadResult(BaseModel):
    """송장 업로드 단건 결과"""
    send_id: int
    success: bool
    message: Optional[str] = None


class DispatchTrackingUploadResponse(BaseModel):
    """송장 업로드 결과"""
    issue: str
    total: int
    success_count: int
    fail_count: int
    results: List[DispatchTrackingUploadResult]


class RegeneratePreparingSendsRequest(BaseModel):
    """[발송 생성] 요청.

    - scope=monthly: 단품 PREPARING만 재계산. issue 무관 (없어도 OK)
    - scope=yearly: 정기구독 PREPARING만 재계산. issue 필수
    """
    scope: Literal["monthly", "yearly"]
    issue: Optional[str] = Field(default=None, pattern=r"^\d{6}$", description="YYYYMM (scope=yearly일 때 필수)")


class RegeneratePreparingSendsResponse(BaseModel):
    scope: str
    issue: Optional[str] = None
    deleted_count: int
    created_count: int


class TransitionSendItem(BaseModel):
    """[배송중 전환] 시 Send 1개에 대한 운송장 입력."""
    send_id: int
    tracking_no: str = Field(..., min_length=1, max_length=50, description="운송장 번호 (필수)")


class TransitionToShippingRequest(BaseModel):
    """[배송중 전환] 요청.

    여러 PREPARING Send를 한 번에 SHIPPING으로 전환.
    send_method/courier_company는 모든 Send에 공통 적용.
    tracking_no는 박스(Send)마다 개별 입력 (모두 필수).
    """
    sends: List[TransitionSendItem] = Field(..., min_length=1, description="전환할 Send 배열")
    send_method: Literal["기출유우편", "기출유택배", "일반우편", "찾아가기"] = Field(..., description="발송 방법")
    courier_company: Literal["CJ대한통운", "자체배송"] = Field(..., description="운송사 (send_method로부터 자동 도출되지만 수정 가능)")


class TransitionToShippingResponse(BaseModel):
    transitioned_count: int


class PaidNotPreparedCountResponse(BaseModel):
    """PAID지만 PREPARING에 안 들어간 OrderItem 카운트 (PreparingSendListPage 알림 배너용)."""
    monthly_count: int
    yearly_count: int
    total_count: int
