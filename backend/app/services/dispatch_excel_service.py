"""기출유/우체국 발송 엑셀 생성 서비스

엑셀 3종 (모두 1 SendItem = 1행. DB 변경 없음):
- 단품 엑셀 (`기출유_단품_YYYYMMDD.xlsx`) — 같은 Send 8컬럼(날짜/이름/연락처/우편번호/주소/박스수/안전봉투/송장번호) 셀 병합, CJ대한통운
- 정기구독 엑셀 A (`기출유_정기구독_YYYYMM.xlsx`) — W0/WB 2시트, 같은 배송지(우편번호+주소) 연속 정렬, 기출유우편 (셀 병합 없음)
- 정기구독 엑셀 B (`우체국_정기구독_YYYYMM.xlsx`) — HN/CL/CH/JN 1시트, 같은 배송지(우편번호+주소) 연속 정렬, 일반우편 (셀 병합 없음)

상세 사양: `SHIPPING_REFACTOR_PLAN.md` §5
"""

# 표준 라이브러리
import io
import re
from typing import Dict, List, Optional, Tuple

# 서드파티 라이브러리
import openpyxl
from fastapi import HTTPException, status
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy.orm import Session, aliased

# 로컬 애플리케이션
from app.core import vip_slots
from app.models.address import Address
from app.models.order_item import OrderItem
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.dispatch_excel import (
    ExcelDownloadSkip,
    MonthlyExcelCandidate,
    MonthlyExcelCandidateItem,
    VipExcelCandidate,
    VipExcelCandidateItem,
    YearlyExcelCandidate,
)
from app.services.dispatch_grouping_service import active_vip_slot_numbers, exclude_active_vip


# ── 상수 ──────────────────────────────────────────────────────────────────────

# 단품·정기구독 공통 상품명 매핑 (prefix → 상품명 셀 값) — SHIPPING_REFACTOR_PLAN.md §5.0
PREFIX_TO_PRODUCT_NAME: Dict[str, str] = {
    "W0": "기본판",
    "WB": "큰글자",
    "HN": "꿀땅",
    "CL": "저학년",
    "CH": "고학년",
    "JN": "청소년",
}

# 엑셀 A (기출유 정기구독, 말씀함께)
GICHULYU_YEARLY_PREFIXES: Tuple[str, ...] = ("W0", "WB")

# 엑셀 B (우체국 정기구독, 청소년이하)
POSTOFFICE_YEARLY_PREFIXES: Tuple[str, ...] = ("HN", "CL", "CH", "JN")

# 허용 전체
ALLOWED_PREFIXES: Tuple[str, ...] = tuple(PREFIX_TO_PRODUCT_NAME.keys())


# ── 유틸 ──────────────────────────────────────────────────────────────────────

def extract_prefix(product_code: str) -> str:
    """SendItem.product_code 앞 2글자 prefix 추출 (예: 'W0-202604' → 'W0')"""
    return (product_code or "")[:2]


def format_issue_ko_long(issue: str) -> str:
    """'202604' → '2026년 04월'"""
    return f"{issue[:4]}년 {issue[4:6]}월"


def format_issue_ko_short(issue: str) -> str:
    """'202604' → '26년 04월호'"""
    return f"{issue[2:4]}년 {issue[4:6]}월호"


def format_subscribe_period_label(start_issue: str, end_issue: str) -> str:
    """('202504', '202604') → '25년 04월호~26년 04월호'"""
    return f"{format_issue_ko_short(start_issue)}~{format_issue_ko_short(end_issue)}"


def format_send_date_label(send_date_yyyymmdd: str) -> str:
    """'20260422' → '2026-04-22' (엑셀 날짜 컬럼 표시용)"""
    if len(send_date_yyyymmdd) != 8 or not send_date_yyyymmdd.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="발송날짜는 YYYYMMDD 형식이어야 합니다.",
        )
    y, m, d = send_date_yyyymmdd[:4], send_date_yyyymmdd[4:6], send_date_yyyymmdd[6:8]
    return f"{y}-{m}-{d}"


# ── 공통 쿼리 필터 ────────────────────────────────────────────────────────────

def _base_filter():
    """엑셀 대상 공통 필터 (호 무관). 정기구독 호출처는 `SendItem.issue == issue` 별도 추가."""
    return (
        SendItem.cancelled_at.is_(None),
        Send.cancelled_at.is_(None),
        Send.send_status == "PREPARING",
        Send.country_code == "KR",
        OrderItem.cancelled_at.is_(None),
    )


def _exclude_active_vip_from_query(query):
    """엑셀 후보 조회 쿼리에 활성 VIP 격리 적용 — grouping 헬퍼 wrapper.

    VIP 박스는 VIP 엑셀로만 출력되어야 하므로 단품/정기 엑셀에서 격리.
    plain `OrderItem` join 이 query 에 이미 있다는 전제 — 내부 Address alias join 이
    `OrderItem.address_id` 를 직접 참조하므로, 호출처가 `aliased(OrderItem)` 를
    쓰는 형태가 추가되면 이 함수 시그니처에 `order_item_ref` 인자를 받아 명시 전달하도록 변경해야 함.
    핵심 vipN filter 로직은 `dispatch_grouping_service.exclude_active_vip` 에 위임.
    활성 슬롯이 0개면 필터 미적용 (조회 결과 그대로).
    """
    active_slots = active_vip_slot_numbers()
    if not active_slots:
        return query
    addr_alias = aliased(Address)
    query = query.join(addr_alias, addr_alias.address_id == OrderItem.address_id)
    return exclude_active_vip(query, active_slots, address_ref=addr_alias)


# ── 후보 조회 (단품) ──────────────────────────────────────────────────────────

def get_monthly_candidates(
    db: Session,
    postal_code: Optional[str] = None,
) -> List[MonthlyExcelCandidate]:
    """단품 엑셀 후보 조회 (Send 단위, SendItem 집계 포함).

    - 단품은 호 무관 (§5.1.1) — issue 인자 없음.
    - product_code prefix가 6종(W0/WB/HN/CL/CH/JN) 중 하나.
    - 같은 Send의 SendItem들은 items 리스트로 묶어 반환.
    """
    query = (
        db.query(Send, SendItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(*_base_filter())
        .filter(OrderItem.product_kind == "MONTHLY")
    )
    query = _exclude_active_vip_from_query(query)
    if postal_code:
        query = query.filter(Send.postal_code == postal_code.strip())

    rows = query.order_by(Send.postal_code.asc(), Send.send_id.asc(), SendItem.send_item_id.asc()).all()

    # Send 단위 그룹
    by_send: Dict[int, MonthlyExcelCandidate] = {}
    for send, send_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in PREFIX_TO_PRODUCT_NAME:
            continue  # 알 수 없는 prefix는 스킵

        if send.send_id not in by_send:
            by_send[send.send_id] = MonthlyExcelCandidate(
                send_id=send.send_id,
                recipient_name=send.recipient_name or "",
                recipient_phone=send.recipient_phone or "",
                postal_code=send.postal_code or "",
                recipient_address=send.recipient_address or "",
                customer_memo=send.customer_memo,
                items=[],
            )
        by_send[send.send_id].items.append(MonthlyExcelCandidateItem(
            send_item_id=send_item.send_item_id,
            product_code=send_item.product_code,
            product_name=send_item.product_name,
            prefix=prefix,
            display_product_name=PREFIX_TO_PRODUCT_NAME[prefix],
            issue=send_item.issue or "",
            send_num=send_item.send_num,
        ))

    return list(by_send.values())


# ── 후보 조회 (정기구독 공통) ──────────────────────────────────────────────────

def _yearly_candidates_core(
    db: Session,
    issue: str,
    allowed_prefixes: Tuple[str, ...],
    postal_code: Optional[str] = None,
    product_codes: Optional[List[str]] = None,
) -> List[YearlyExcelCandidate]:
    """정기구독 엑셀 후보 조회 (SendItem 단위)

    - allowed_prefixes로 엑셀 A/B 분기
    - product_codes로 세부 prefix 필터 (None이면 allowed_prefixes 전체)
    """
    effective_prefixes = list(allowed_prefixes)
    if product_codes:
        effective_prefixes = [p for p in product_codes if p in allowed_prefixes]
        if not effective_prefixes:
            return []

    # SendItem.product_code는 '{prefix}-{issue}' 형식 → prefix로 LIKE 매칭
    prefix_filters = [SendItem.product_code.like(f"{p}%") for p in effective_prefixes]

    from sqlalchemy import or_

    query = (
        db.query(Send, SendItem, OrderItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(*_base_filter())
        .filter(SendItem.issue == issue)
        .filter(OrderItem.product_kind == "YEARLY")
        .filter(or_(*prefix_filters))
    )
    query = _exclude_active_vip_from_query(query)
    if postal_code:
        query = query.filter(Send.postal_code == postal_code.strip())

    rows = query.order_by(Send.postal_code.asc(), Send.send_id.asc(), SendItem.send_item_id.asc()).all()

    results: List[YearlyExcelCandidate] = []
    for send, send_item, order_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in allowed_prefixes:
            continue

        start = order_item.final_subscribe_start_issue
        end = order_item.final_subscribe_end_issue

        results.append(YearlyExcelCandidate(
            send_id=send.send_id,
            send_item_id=send_item.send_item_id,
            order_item_id=send_item.order_item_id,
            recipient_name=send.recipient_name or "",
            recipient_phone=send.recipient_phone or "",
            postal_code=send.postal_code or "",
            recipient_address=send.recipient_address or "",
            product_code=send_item.product_code,
            prefix=prefix,
            display_product_name=PREFIX_TO_PRODUCT_NAME.get(prefix, send_item.product_name),
            issue=send_item.issue or "",
            send_num=send_item.send_num,
            final_subscribe_start_issue=start,
            final_subscribe_end_issue=end,
            start_label=format_issue_ko_long(start),
            period_label=format_subscribe_period_label(start, end),
        ))
    return results


def get_yearly_gichulyu_candidates(
    db: Session,
    issue: str,
    postal_code: Optional[str] = None,
    product_codes: Optional[List[str]] = None,
) -> List[YearlyExcelCandidate]:
    """정기구독 A (기출유우편, 말씀함께 W0/WB) 후보"""
    return _yearly_candidates_core(
        db=db,
        issue=issue,
        allowed_prefixes=GICHULYU_YEARLY_PREFIXES,
        postal_code=postal_code,
        product_codes=product_codes,
    )


def get_yearly_postoffice_candidates(
    db: Session,
    issue: str,
    postal_code: Optional[str] = None,
    product_codes: Optional[List[str]] = None,
) -> List[YearlyExcelCandidate]:
    """정기구독 B (일반우편, 청소년이하 HN/CL/CH/JN) 후보"""
    return _yearly_candidates_core(
        db=db,
        issue=issue,
        allowed_prefixes=POSTOFFICE_YEARLY_PREFIXES,
        postal_code=postal_code,
        product_codes=product_codes,
    )


# ── 스타일 헬퍼 ────────────────────────────────────────────────────────────────

_HEADER_FONT = Font(bold=True, color="FFFFFF")
_HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
_HEADER_ALIGN = Alignment(horizontal="center", vertical="center")
_THIN_BORDER = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)
_CENTER_ALIGN = Alignment(horizontal="center", vertical="center")
_LEFT_ALIGN = Alignment(horizontal="left", vertical="center")


def _write_header(ws: Worksheet, headers: List[str]) -> None:
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = _HEADER_FONT
        cell.fill = _HEADER_FILL
        cell.alignment = _HEADER_ALIGN
        cell.border = _THIN_BORDER


def _set_column_widths(ws: Worksheet, widths: List[int]) -> None:
    for col_idx, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width


# ── 엑셀 빌더 (단품) ──────────────────────────────────────────────────────────
# 1 SendItem = 1행, 같은 Send 행들의 8컬럼 셀 병합
# (날짜/이름/연락처/우편번호/주소 + 박스수/안전봉투/송장번호)

_MONTHLY_HEADERS = [
    "날짜", "이름", "연락처", "우편번호", "주소",
    "상품명", "발행호", "수량", "비고",
    "박스수", "안전봉투", "송장번호",
]
_MONTHLY_WIDTHS = [12, 12, 16, 10, 40, 10, 14, 8, 14, 8, 10, 16]

# 같은 Send 행들에서 셀 병합 대상 컬럼 인덱스 (1-based)
# 날짜=1, 이름=2, 연락처=3, 우편번호=4, 주소=5, 박스수=10, 안전봉투=11, 송장번호=12
# 상품명/발행호/수량/비고(6~9)는 SendItem 별로 다른 값이라 병합 대상에서 제외.
_MONTHLY_MERGE_COLUMNS: Tuple[int, ...] = (1, 2, 3, 4, 5, 10, 11, 12)
# 가운데 정렬 컬럼: 날짜·우편번호·상품명·발행호·수량·박스수·안전봉투·송장번호
_MONTHLY_CENTER_COLUMNS: Tuple[int, ...] = (1, 4, 6, 7, 8, 10, 11, 12)


def build_monthly_excel(
    db: Session,
    send_ids: List[int],
    send_date_yyyymmdd: str,
) -> Tuple[io.BytesIO, List[int], List[ExcelDownloadSkip]]:
    """단품 엑셀 생성 (1 SendItem = 1행, 같은 Send 8컬럼 셀 병합).

    같은 Send 안 SendItem 이 2건 이상이면 다음 8컬럼이 셀 병합됨:
    - 날짜(1) / 이름(2) / 연락처(3) / 우편번호(4) / 주소(5) — 박스 단위 동일값
    - 박스수(10) / 안전봉투(11) / 송장번호(12) — 박스 단위 입력값

    Returns:
        (BytesIO, 실제 엑셀에 포함된 send_ids, 스킵된 send_ids)
    """
    date_label = format_send_date_label(send_date_yyyymmdd)

    # 대상 Send + SendItem 조회 (호 무관, country_code='KR' + PREPARING + cancelled_at NULL 등 §5.1.1)
    # 활성 VIP 슬롯 주소는 격리 (단품 엑셀에 VIP 박스 포함 방지)
    monthly_query = (
        db.query(Send, SendItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(Send.send_id.in_(send_ids))
        .filter(*_base_filter())
        .filter(OrderItem.product_kind == "MONTHLY")
    )
    rows = _exclude_active_vip_from_query(monthly_query).all()

    # Send 단위 그룹화 (1 Send = 박스 1개)
    sends_by_id: Dict[int, Send] = {}
    items_by_send: Dict[int, List[SendItem]] = {}
    for send, send_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in PREFIX_TO_PRODUCT_NAME:
            continue
        sends_by_id.setdefault(send.send_id, send)
        items_by_send.setdefault(send.send_id, []).append(send_item)

    # 입력 send_id 중 한 건도 조건에 맞는 SendItem이 없으면 skipped 처리
    included_send_ids = set(items_by_send.keys())
    skipped: List[ExcelDownloadSkip] = []
    for sid in send_ids:
        if sid not in included_send_ids:
            skipped.append(ExcelDownloadSkip(
                send_id=sid,
                reason="대상 조건 불일치(상태/취소/해외/상품종류/prefix)",
            ))

    # 정렬 (§5.2.4): Send 간 우편번호 → 주소 → 이름 → send_id
    sorted_sends = sorted(
        sends_by_id.values(),
        key=lambda s: (
            (s.postal_code or "").strip(),
            (s.recipient_address or "").strip(),
            (s.recipient_name or "").strip(),
            s.send_id,
        ),
    )

    # 엑셀 생성
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "단품발송"
    _write_header(ws, _MONTHLY_HEADERS)

    row_idx = 2
    for send in sorted_sends:
        # Send 안 SendItem 정렬: prefix → issue → send_item_id
        items = sorted(
            items_by_send[send.send_id],
            key=lambda si: (extract_prefix(si.product_code), si.issue or "", si.send_item_id),
        )
        start_row = row_idx
        for si in items:
            prefix = extract_prefix(si.product_code)
            row_values = [
                date_label,                                  # 1 날짜 (병합)
                send.recipient_name or "",                   # 2 이름
                send.recipient_phone or "",                  # 3 연락처
                send.postal_code or "",                      # 4 우편번호
                send.recipient_address or "",                # 5 주소
                PREFIX_TO_PRODUCT_NAME[prefix],              # 6 상품명
                format_issue_ko_short(si.issue or ""),       # 7 발행호
                si.send_num,                                 # 8 수량
                "",                                          # 9 비고
                "",                                          # 10 박스수 (병합)
                "",                                          # 11 안전봉투 (병합)
                "",                                          # 12 송장번호 (병합)
            ]
            for col_idx, value in enumerate(row_values, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.border = _THIN_BORDER
                cell.alignment = _CENTER_ALIGN if col_idx in _MONTHLY_CENTER_COLUMNS else _LEFT_ALIGN
            row_idx += 1
        end_row = row_idx - 1
        # 같은 Send 안 SendItem이 2건 이상이면 4컬럼(날짜/박스수/안전봉투/송장번호) 셀 병합
        if end_row > start_row:
            for col_idx in _MONTHLY_MERGE_COLUMNS:
                ws.merge_cells(
                    start_row=start_row, end_row=end_row,
                    start_column=col_idx, end_column=col_idx,
                )

    _set_column_widths(ws, _MONTHLY_WIDTHS)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return output, sorted(included_send_ids), skipped


# ── 엑셀 빌더 (정기구독 공통) ──────────────────────────────────────────────────

_YEARLY_HEADERS = [
    "이름", "연락처", "우편번호", "주소", "시작", "구독기간", "상품명", "발행호", "수량", "비고",
]
_YEARLY_WIDTHS = [12, 16, 10, 40, 12, 24, 10, 14, 8, 14]
# 가운데 정렬 컬럼: 우편번호(3) / 시작(5) / 구독기간(6) / 상품명(7) / 발행호(8) / 수량(9)
_YEARLY_CENTER_COLUMNS: Tuple[int, ...] = (3, 5, 6, 7, 8, 9)


def _write_yearly_sheet(
    ws: Worksheet,
    candidates: List[YearlyExcelCandidate],
) -> None:
    """정기구독 시트에 헤더 + 데이터 쓰기.

    같은 배송지(우편번호+주소 2필드) 행이 연속으로 나오도록 정렬만 수행.
    배경색(zebra) 없음 — §5.3.5/§5.4.4.
    """
    _write_header(ws, _YEARLY_HEADERS)

    # 정렬: 배송지(2필드) → 상품명 → 시작호 → send_item_id
    sorted_cands = sorted(
        candidates,
        key=lambda c: (
            c.postal_code.strip(),
            c.recipient_address.strip(),
            c.display_product_name,
            c.final_subscribe_start_issue,
            c.send_item_id,
        ),
    )

    for row_idx, cand in enumerate(sorted_cands, start=2):
        row_values = [
            cand.recipient_name,                          # 1 이름
            cand.recipient_phone,                         # 2 연락처
            cand.postal_code,                             # 3 우편번호
            cand.recipient_address,                       # 4 주소
            cand.start_label,                             # 5 시작 ("2026년 04월")
            cand.period_label,                            # 6 구독기간 ("25년 04월호~26년 04월호")
            cand.display_product_name,                    # 7 상품명
            format_issue_ko_short(cand.issue or ""),      # 8 발행호 ("26년 04월호", 단품과 동일 포맷)
            cand.send_num,                                # 9 수량
            "",                                           # 10 비고
        ]
        for col_idx, value in enumerate(row_values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = _THIN_BORDER
            cell.alignment = _CENTER_ALIGN if col_idx in _YEARLY_CENTER_COLUMNS else _LEFT_ALIGN

    _set_column_widths(ws, _YEARLY_WIDTHS)


def _fetch_yearly_candidates_by_send_ids(
    db: Session,
    send_ids: List[int],
    allowed_prefixes: Tuple[str, ...],
) -> Tuple[List[YearlyExcelCandidate], List[ExcelDownloadSkip]]:
    """send_ids에 해당하는 정기구독 SendItem들을 YearlyExcelCandidate 형태로 조회

    Returns:
        (후보 목록, 스킵된 send_id 목록)
    """
    # 활성 VIP 슬롯 주소는 격리 (정기 엑셀에 VIP 박스 포함 방지)
    yearly_query = (
        db.query(Send, SendItem, OrderItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(Send.send_id.in_(send_ids))
        .filter(*_base_filter())
        .filter(OrderItem.product_kind == "YEARLY")
    )
    rows = _exclude_active_vip_from_query(yearly_query).all()

    included_send_ids: set = set()
    candidates: List[YearlyExcelCandidate] = []
    for send, send_item, order_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in allowed_prefixes:
            continue
        start = order_item.final_subscribe_start_issue
        end = order_item.final_subscribe_end_issue
        candidates.append(YearlyExcelCandidate(
            send_id=send.send_id,
            send_item_id=send_item.send_item_id,
            order_item_id=send_item.order_item_id,
            recipient_name=send.recipient_name or "",
            recipient_phone=send.recipient_phone or "",
            postal_code=send.postal_code or "",
            recipient_address=send.recipient_address or "",
            product_code=send_item.product_code,
            prefix=prefix,
            display_product_name=PREFIX_TO_PRODUCT_NAME.get(prefix, send_item.product_name),
            issue=send_item.issue or "",
            send_num=send_item.send_num,
            final_subscribe_start_issue=start,
            final_subscribe_end_issue=end,
            start_label=format_issue_ko_long(start),
            period_label=format_subscribe_period_label(start, end),
        ))
        included_send_ids.add(send.send_id)

    skipped: List[ExcelDownloadSkip] = []
    for sid in send_ids:
        if sid not in included_send_ids:
            skipped.append(ExcelDownloadSkip(
                send_id=sid,
                reason="대상 조건 불일치(상태/취소/해외/상품종류/prefix)",
            ))

    return candidates, skipped


# ── 엑셀 빌더 (정기구독 A — 기출유우편, W0/WB) ────────────────────────────────

def build_yearly_gichulyu_excel(
    db: Session,
    send_ids: List[int],
) -> Tuple[io.BytesIO, List[int], List[ExcelDownloadSkip]]:
    """정기구독 엑셀 A 생성 (시트 2개: 기본판 / 큰글자)"""
    candidates, skipped = _fetch_yearly_candidates_by_send_ids(
        db=db,
        send_ids=send_ids,
        allowed_prefixes=GICHULYU_YEARLY_PREFIXES,
    )

    wb = openpyxl.Workbook()
    # 기본 생성된 Sheet 제거
    wb.remove(wb.active)

    # 시트 1: 기본판 (W0)
    ws_basic = wb.create_sheet(title="기본판")
    _write_yearly_sheet(ws_basic, [c for c in candidates if c.prefix == "W0"])

    # 시트 2: 큰글자 (WB)
    ws_large = wb.create_sheet(title="큰글자")
    _write_yearly_sheet(ws_large, [c for c in candidates if c.prefix == "WB"])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    included_send_ids = sorted({c.send_id for c in candidates})
    return output, included_send_ids, skipped


# ── 엑셀 빌더 (정기구독 B — 일반우편, HN/CL/CH/JN) ────────────────────────────

def build_yearly_postoffice_excel(
    db: Session,
    send_ids: List[int],
) -> Tuple[io.BytesIO, List[int], List[ExcelDownloadSkip]]:
    """정기구독 엑셀 B 생성 (시트 1개, 4종 혼합)"""
    candidates, skipped = _fetch_yearly_candidates_by_send_ids(
        db=db,
        send_ids=send_ids,
        allowed_prefixes=POSTOFFICE_YEARLY_PREFIXES,
    )

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "정기구독"
    _write_yearly_sheet(ws, candidates)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    included_send_ids = sorted({c.send_id for c in candidates})
    return output, included_send_ids, skipped


# ── 파일명 생성 ────────────────────────────────────────────────────────────────

def monthly_filename(send_date_yyyymmdd: str) -> str:
    return f"기출유_단품_{send_date_yyyymmdd}.xlsx"


def yearly_gichulyu_filename(issue: str) -> str:
    return f"기출유_정기구독_{issue}.xlsx"


def yearly_postoffice_filename(issue: str) -> str:
    return f"우체국_정기구독_{issue}.xlsx"


# ── VIP 엑셀 — 단품 형식 99% 재사용. 차이: country_code 필터 없음, 비고 컬럼=정기/단품 ──

def _sanitize_label_for_filename(label: Optional[str]) -> str:
    """OS 금지 문자(/ \\ : * ? " < > |) 를 _ 로 치환. 빈/공백 입력 → 빈 문자열."""
    if not label:
        return ""
    cleaned = re.sub(r'[\\/:*?"<>|]', "_", label).strip()
    return cleaned


def vip_filename(slot_number: int, label: Optional[str], send_date_yyyymmdd: str) -> str:
    """VIP 엑셀 파일명.

    - label None / 빈 / 공백 / sanitize 결과 빈 → 'vip{N}_YYYYMMDD.xlsx'
    - 그 외 → 'vip{N}_{sanitized_label}_YYYYMMDD.xlsx'
    이중 underscore 방지.
    """
    sanitized = _sanitize_label_for_filename(label)
    if sanitized:
        return f"vip{slot_number}_{sanitized}_{send_date_yyyymmdd}.xlsx"
    return f"vip{slot_number}_{send_date_yyyymmdd}.xlsx"


def _vip_base_filter():
    """VIP 엑셀 대상 공통 필터 — 단품 _base_filter() 와 통일성 (인자 없음).

    _base_filter() 와 달리 country_code='KR' 강제 없음 (VIP 는 해외 포함).
    SendItem.cancelled_at IS NULL, Send.cancelled_at IS NULL,
    Send.send_status=PREPARING, OrderItem.cancelled_at IS NULL.
    슬롯별 vipN=true 필터는 호출자가 인라인으로 추가.
    """
    return (
        SendItem.cancelled_at.is_(None),
        Send.cancelled_at.is_(None),
        Send.send_status == "PREPARING",
        OrderItem.cancelled_at.is_(None),
    )


def _assert_slot_active(slot_number: int):
    """슬롯 N 활성화 검증 + VipSlot 객체 반환. 비활성 → 400."""
    if slot_number < 1 or slot_number > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"slot_number 는 1..6 범위여야 합니다: {slot_number}",
        )
    slot = next((s for s in vip_slots.list_slots() if s.slot_number == slot_number), None)
    if slot is None or not slot.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"비활성 슬롯입니다: vip{slot_number}",
        )
    return slot


def get_vip_candidates(
    db: Session,
    slot_number: int,
    postal_code: Optional[str] = None,
) -> List[VipExcelCandidate]:
    """VIP 엑셀 후보 조회 (Send 단위, SendItem 집계 포함).

    - 슬롯 N 비활성 → 400
    - 대상: PREPARING + Address.vip{N}=true + cancelled_at NULL + product_kind 무관 (정기+단품 통합)
    - 🚫 country_code 필터 절대 사용 안 함 (VIP 해외 포함)
    - prefix 가 PREFIX_TO_PRODUCT_NAME 6종에 없는 SendItem 은 스킵 (단품과 동일)
    - 호 필터 없음 — 단품 엑셀과 동일 정책. 발송 생성 단계에서 정기는 이미 issue 검증을
      거쳐 박스에 들어왔으므로, 엑셀 출력 단계에서 다시 호로 거르지 않는다.
      박스 안 SendItem 은 모두 출력 (정기 SendItem 의 issue 는 SendItem.issue 그대로 표시).
    """
    _assert_slot_active(slot_number)
    vip_col = getattr(Address, f"vip{slot_number}")

    query = (
        db.query(Send, SendItem, OrderItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .join(Address, Address.address_id == OrderItem.address_id)
        .filter(*_vip_base_filter())
        .filter(vip_col.is_(True))
    )
    if postal_code:
        query = query.filter(Send.postal_code == postal_code.strip())

    rows = query.order_by(
        Send.postal_code.asc(), Send.send_id.asc(), SendItem.send_item_id.asc()
    ).all()

    by_send: Dict[int, VipExcelCandidate] = {}
    for send, send_item, order_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in PREFIX_TO_PRODUCT_NAME:
            continue

        if send.send_id not in by_send:
            by_send[send.send_id] = VipExcelCandidate(
                send_id=send.send_id,
                recipient_name=send.recipient_name or "",
                recipient_phone=send.recipient_phone or "",
                country_code=send.country_code or "",
                postal_code=send.postal_code or "",
                recipient_address=send.recipient_address or "",
                customer_memo=send.customer_memo,
                items=[],
            )
        by_send[send.send_id].items.append(VipExcelCandidateItem(
            send_item_id=send_item.send_item_id,
            product_code=send_item.product_code,
            product_name=send_item.product_name,
            prefix=prefix,
            display_product_name=PREFIX_TO_PRODUCT_NAME[prefix],
            issue=send_item.issue or "",
            send_num=send_item.send_num,
            product_kind=order_item.product_kind,
        ))

    return list(by_send.values())


# 비고 컬럼(9번) 매핑 — VIP 만 채움 (단품/정기는 빈칸 유지)
_VIP_REMARK_BY_KIND: Dict[str, str] = {"YEARLY": "정기", "MONTHLY": "단품"}


def build_vip_excel(
    db: Session,
    send_ids: List[int],
    slot_number: int,
    send_date_yyyymmdd: str,
) -> Tuple[io.BytesIO, List[int], List[ExcelDownloadSkip]]:
    """VIP 엑셀 생성 (단품과 동일한 컬럼/병합/스타일/정렬, 시트 1개).

    - 슬롯 N 비활성 → 400
    - 시트명 항상 f"vip{N}" (Excel 시트명 31자/특수문자 제약 회피, 단순화)
    - 비고 컬럼: SendItem→OrderItem.product_kind 따라 "정기"/"단품" 자동 채움
    - 단품과 달리 country_code='KR' 강제 없음 (해외 포함)
    - 호 필터 없음 — 단품 엑셀과 동일 정책 (후보 조회와 일관). 발송 생성 단계에서 정기는
      이미 issue 검증을 거쳐 박스에 들어왔으므로 엑셀 출력 단계에서 재검증 안 함.
    """
    _assert_slot_active(slot_number)
    date_label = format_send_date_label(send_date_yyyymmdd)
    vip_col = getattr(Address, f"vip{slot_number}")

    # 대상 Send + SendItem + OrderItem(product_kind) 한번에 조회
    rows = (
        db.query(Send, SendItem, OrderItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .join(Address, Address.address_id == OrderItem.address_id)
        .filter(Send.send_id.in_(send_ids))
        .filter(*_vip_base_filter())
        .filter(vip_col.is_(True))
        .all()
    )

    # Send 단위 그룹화 + product_kind 사전 (비고 컬럼 lookup용)
    sends_by_id: Dict[int, Send] = {}
    items_by_send: Dict[int, List[SendItem]] = {}
    pk_by_si_id: Dict[int, str] = {}
    for send, send_item, order_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in PREFIX_TO_PRODUCT_NAME:
            continue
        sends_by_id.setdefault(send.send_id, send)
        items_by_send.setdefault(send.send_id, []).append(send_item)
        pk_by_si_id[send_item.send_item_id] = order_item.product_kind

    included_send_ids = set(items_by_send.keys())
    skipped: List[ExcelDownloadSkip] = []
    for sid in send_ids:
        if sid not in included_send_ids:
            skipped.append(ExcelDownloadSkip(
                send_id=sid,
                reason="대상 조건 불일치(상태/취소/슬롯/prefix)",
            ))

    # 정렬 (단품과 동일): Send 간 우편번호 → 주소 → 이름 → send_id
    sorted_sends = sorted(
        sends_by_id.values(),
        key=lambda s: (
            (s.postal_code or "").strip(),
            (s.recipient_address or "").strip(),
            (s.recipient_name or "").strip(),
            s.send_id,
        ),
    )

    # 엑셀 생성
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"vip{slot_number}"
    _write_header(ws, _MONTHLY_HEADERS)

    row_idx = 2
    for send in sorted_sends:
        # Send 안 SendItem 정렬 (단품과 동일): prefix → issue → send_item_id
        items = sorted(
            items_by_send[send.send_id],
            key=lambda si: (extract_prefix(si.product_code), si.issue or "", si.send_item_id),
        )
        start_row = row_idx
        for si in items:
            prefix = extract_prefix(si.product_code)
            row_values = [
                date_label,                                  # 1 날짜 (병합)
                send.recipient_name or "",                   # 2 이름
                send.recipient_phone or "",                  # 3 연락처
                send.postal_code or "",                      # 4 우편번호
                send.recipient_address or "",                # 5 주소
                PREFIX_TO_PRODUCT_NAME[prefix],              # 6 상품명
                format_issue_ko_short(si.issue or ""),       # 7 발행호
                si.send_num,                                 # 8 수량
                _VIP_REMARK_BY_KIND.get(pk_by_si_id.get(si.send_item_id, ""), ""),  # 9 비고
                "",                                          # 10 박스수 (병합)
                "",                                          # 11 안전봉투 (병합)
                "",                                          # 12 송장번호 (병합)
            ]
            for col_idx, value in enumerate(row_values, start=1):
                cell = ws.cell(row=row_idx, column=col_idx, value=value)
                cell.border = _THIN_BORDER
                cell.alignment = _CENTER_ALIGN if col_idx in _MONTHLY_CENTER_COLUMNS else _LEFT_ALIGN
            row_idx += 1
        end_row = row_idx - 1
        if end_row > start_row:
            for col_idx in _MONTHLY_MERGE_COLUMNS:
                ws.merge_cells(
                    start_row=start_row, end_row=end_row,
                    start_column=col_idx, end_column=col_idx,
                )

    _set_column_widths(ws, _MONTHLY_WIDTHS)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return output, sorted(included_send_ids), skipped
