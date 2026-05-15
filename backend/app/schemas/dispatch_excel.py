# 표준 라이브러리
from typing import List, Literal, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field


# ── 후보 조회 응답 (단품) ──────────────────────────────────────────────────────

class MonthlyExcelCandidateItem(BaseModel):
    """단품 후보 내 SendItem 1건 (1 SendItem = 엑셀 1행, §5.2)"""
    send_item_id: int
    product_code: str
    product_name: str
    prefix: str                     # W0/WB/HN/CL/CH/JN
    display_product_name: str       # 기본판/큰글자/꿀땅/저학년/고학년/청소년 (§5.0 매핑)
    issue: str                      # YYYYMM (엑셀 발행호 컬럼)
    send_num: int


class MonthlyExcelCandidate(BaseModel):
    """단품 엑셀 후보 1건 (Send 단위)"""
    send_id: int
    recipient_name: str
    recipient_phone: str
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    items: List[MonthlyExcelCandidateItem]


class MonthlyExcelCandidatesResponse(BaseModel):
    total: int
    candidates: List[MonthlyExcelCandidate]


# ── 후보 조회 응답 (정기구독 A/B 공용) ────────────────────────────────────────

class YearlyExcelCandidate(BaseModel):
    """정기구독 엑셀 후보 1건 (SendItem 단위)"""
    send_id: int
    send_item_id: int
    order_item_id: int
    recipient_name: str
    recipient_phone: str
    postal_code: str
    recipient_address: str
    product_code: str
    prefix: str                     # W0/WB/HN/CL/CH/JN
    display_product_name: str       # 기본판/큰글자/꿀땅/저학년/고학년/청소년
    issue: str                      # YYYYMM (SendItem.issue, 엑셀 발행호 컬럼)
    send_num: int
    final_subscribe_start_issue: str
    final_subscribe_end_issue: str
    start_label: str                # "2026년 04월"
    period_label: str               # "26년 04월호~27년 03월호"


class YearlyExcelCandidatesResponse(BaseModel):
    issue: str
    total: int
    candidates: List[YearlyExcelCandidate]


# ── 후보 조회 쿼리 ────────────────────────────────────────────────────────────

class MonthlyCandidatesQuery(BaseModel):
    """단품 후보 조회 쿼리 — 호 무관 (§5.1.2)"""
    postal_code: Optional[str] = None

    @classmethod
    def as_query_params(
        cls,
        postal_code: Optional[str] = Query(None, description="우편번호 정확 일치"),
    ):
        return cls(postal_code=postal_code)


class YearlyCandidatesQuery(BaseModel):
    issue: str
    postal_code: Optional[str] = None
    product_codes: Optional[List[str]] = None   # prefix 목록 (예: ["W0","WB"])

    @classmethod
    def as_query_params(
        cls,
        # YYYYMM — month 부분 01~12 강제
        issue: str = Query(..., pattern=r"^\d{4}(0[1-9]|1[0-2])$", description="발송 호 (YYYYMM)"),
        postal_code: Optional[str] = Query(None, description="우편번호 정확 일치"),
        product_codes: Optional[str] = Query(
            None,
            description="상품 prefix 필터 (쉼표 구분, 예: 'W0,WB'). 미지정 시 각 엑셀의 허용 prefix 전체",
        ),
    ):
        parsed = None
        if product_codes:
            parsed = [c.strip() for c in product_codes.split(",") if c.strip()]
        return cls(issue=issue, postal_code=postal_code, product_codes=parsed)


# ── 다운로드 요청 ────────────────────────────────────────────────────────────

class MonthlyExcelDownloadRequest(BaseModel):
    """단품 엑셀 다운로드 요청"""
    send_ids: List[int] = Field(..., min_length=1)
    # YYYYMMDD — month 01~12 + day 01~31 강제 (런타임 format_send_date_label 과 일관)
    send_date: str = Field(
        ...,
        pattern=r"^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$",
        description="YYYYMMDD (관리자 입력 발송날짜)",
    )


class YearlyExcelDownloadRequest(BaseModel):
    """정기구독 엑셀 다운로드 요청 (A/B 공용)"""
    send_ids: List[int] = Field(..., min_length=1)
    # YYYYMM — month 부분 01~12 강제
    issue: str = Field(..., pattern=r"^\d{4}(0[1-9]|1[0-2])$", description="발송 호 (YYYYMM, 파일명용)")


# ── 후보 조회 응답 (VIP) ──────────────────────────────────────────────────────
# VIP 엑셀은 단품 형식 99% 재사용. 차이: country_code 노출 + product_kind 비고 컬럼용

class VipExcelCandidateItem(BaseModel):
    """VIP 후보 내 SendItem 1건 (1 SendItem = 엑셀 1행).

    단품 MonthlyExcelCandidateItem 과 동일 + product_kind 만 추가 (비고 컬럼 표시용).
    order_item_id 는 노출 안 함 (단품과 일관 — 정기에만 있음).
    """
    send_item_id: int
    product_code: str
    product_name: str
    prefix: str
    display_product_name: str
    issue: str
    send_num: int
    product_kind: Literal["YEARLY", "MONTHLY"]   # 비고 컬럼 표시용 ("정기"/"단품")


class VipExcelCandidate(BaseModel):
    """VIP 엑셀 후보 1건 (Send 단위).

    단품 MonthlyExcelCandidate 와 동일 + country_code 추가 (VIP 는 KR 외 가능 — 운영자에게 노출).
    """
    send_id: int
    recipient_name: str
    recipient_phone: str
    country_code: str                           # 단품과 달리 KR 외 가능
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    items: List[VipExcelCandidateItem]


class VipExcelCandidatesResponse(BaseModel):
    slot_number: int
    slot_label: Optional[str] = None
    total: int
    candidates: List[VipExcelCandidate]


# ── 후보 조회 쿼리 (VIP) ──────────────────────────────────────────────────────

class VipCandidatesQuery(BaseModel):
    """VIP 후보 조회 쿼리 — 호 무관 (단품 엑셀과 동일 정책).

    VIP 박스는 (postal_code, recipient_address) 그룹화 결과로 정기·단품이 섞일 수 있고,
    엑셀에는 박스 안 SendItem 을 그대로 출력. 발송 생성 단계에서 이미 정기는 issue 검증을
    거쳐 박스에 들어왔으므로, 엑셀 출력 단계에서 다시 호로 거르지 않는다.
    """
    postal_code: Optional[str] = None

    @classmethod
    def as_query_params(
        cls,
        postal_code: Optional[str] = Query(None, description="우편번호 정확 일치"),
    ):
        return cls(postal_code=postal_code)


# ── 다운로드 요청 (VIP) ───────────────────────────────────────────────────────

class VipExcelDownloadRequest(BaseModel):
    """VIP 엑셀 다운로드 요청 (단품 패턴 일관 — send_ids + send_date)."""
    send_ids: List[int] = Field(..., min_length=1)
    # YYYYMMDD — month 01~12 + day 01~31 강제 (MonthlyExcelDownloadRequest 와 동일)
    send_date: str = Field(
        ...,
        pattern=r"^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$",
        description="YYYYMMDD (관리자 입력 발송날짜)",
    )


# ── 다운로드 후 상태 전환 결과 (활동 로그 details용) ──────────────────────────

class ExcelDownloadSkip(BaseModel):
    send_id: int
    reason: str
