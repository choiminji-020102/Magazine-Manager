# 표준 라이브러리
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import Query
from pydantic import BaseModel, Field


# ── 후보 조회 응답 (단품) ──────────────────────────────────────────────────────

class MonthlyExcelCandidateItem(BaseModel):
    """단품 후보 내 SendItem 1건"""
    send_item_id: int
    product_code: str
    product_name: str
    prefix: str                     # W0/WB/HN/CL/CH/JN
    column_label: str               # 말씀함께/큰글자/꿀땅/저학년/고학년/청소년
    send_num: int


class MonthlyExcelCandidate(BaseModel):
    """단품 엑셀 후보 1건 (Send 단위)"""
    send_id: int
    order_id: int
    recipient_name: str
    recipient_phone: str
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str] = None
    items: List[MonthlyExcelCandidateItem]


class MonthlyExcelCandidatesResponse(BaseModel):
    issue: str
    total: int
    candidates: List[MonthlyExcelCandidate]


# ── 후보 조회 응답 (정기구독 A/B 공용) ────────────────────────────────────────

class YearlyExcelCandidate(BaseModel):
    """정기구독 엑셀 후보 1건 (SendItem 단위)"""
    send_id: int
    send_item_id: int
    order_id: int
    order_item_id: int
    recipient_name: str
    recipient_phone: str
    postal_code: str
    recipient_address: str
    product_code: str
    prefix: str                     # W0/WB/HN/CL/CH/JN
    display_product_name: str       # 기본판/큰글자/꿀땅/저학년/고학년/청소년
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
    issue: str
    postal_code: Optional[str] = None

    @classmethod
    def as_query_params(
        cls,
        issue: str = Query(..., description="발송 호 (YYYYMM)"),
        postal_code: Optional[str] = Query(None, description="우편번호 정확 일치"),
    ):
        return cls(issue=issue, postal_code=postal_code)


class YearlyCandidatesQuery(BaseModel):
    issue: str
    postal_code: Optional[str] = None
    product_codes: Optional[List[str]] = None   # prefix 목록 (예: ["W0","WB"])

    @classmethod
    def as_query_params(
        cls,
        issue: str = Query(..., description="발송 호 (YYYYMM)"),
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
    send_date: str = Field(..., description="YYYYMMDD (관리자 입력 발송날짜)")


class YearlyExcelDownloadRequest(BaseModel):
    """정기구독 엑셀 다운로드 요청 (A/B 공용)"""
    send_ids: List[int] = Field(..., min_length=1)
    issue: str = Field(..., description="발송 호 (YYYYMM, 파일명용)")


# ── 다운로드 후 상태 전환 결과 (활동 로그 details용) ──────────────────────────

class ExcelDownloadSkip(BaseModel):
    send_id: int
    reason: str
