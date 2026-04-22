"""기출유/우체국 발송 엑셀 생성 서비스

엑셀 3종:
- 단품 엑셀 (`기출유_단품_YYYYMMDD.xlsx`) — 배송지 피벗, CJ대한통운
- 정기구독 엑셀 A (`기출유_정기구독_YYYYMM.xlsx`) — W0/WB 2시트, 기출유우편
- 정기구독 엑셀 B (`우체국_정기구독_YYYYMM.xlsx`) — HN/CL/CH/JN 1시트, 일반우편

상세 사양: `GICHULYU_EXCEL_SPEC.md`
"""

# 표준 라이브러리
import io
from typing import Dict, List, Optional, Tuple

# 서드파티 라이브러리
import openpyxl
from fastapi import HTTPException, status
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import now_kst
from app.models.order_item import OrderItem
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.dispatch_excel import (
    ExcelDownloadSkip,
    MonthlyExcelCandidate,
    MonthlyExcelCandidateItem,
    YearlyExcelCandidate,
)


# ── 상수 ──────────────────────────────────────────────────────────────────────

# 단품 엑셀 상품 컬럼 매핑 (prefix → 컬럼명)
MONTHLY_COLUMN_MAP: Dict[str, str] = {
    "W0": "말씀함께",
    "WB": "큰글자",
    "HN": "꿀땅",
    "CL": "저학년",
    "CH": "고학년",
    "JN": "청소년",
}

# 정기구독 엑셀 상품명 매핑 (prefix → 상품명 셀 값)
YEARLY_DISPLAY_NAME_MAP: Dict[str, str] = {
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
ALLOWED_PREFIXES: Tuple[str, ...] = tuple(MONTHLY_COLUMN_MAP.keys())

# 엑셀 종류별 courier_company 고정값
COURIER_MONTHLY = "CJ대한통운"
COURIER_YEARLY_GICHULYU = "기출유우편"
COURIER_YEARLY_POSTOFFICE = "일반우편"


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


def address_group_key(send: Send) -> Tuple[str, str, str, str]:
    """같은 배송지 판정 키 (수령인 이름 + 연락처 + 우편번호 + 주소)"""
    return (
        (send.recipient_name or "").strip(),
        (send.recipient_phone or "").strip(),
        (send.postal_code or "").strip(),
        (send.recipient_address or "").strip(),
    )


# ── 공통 쿼리 필터 ────────────────────────────────────────────────────────────

def _base_filter(issue: str):
    """엑셀 대상 공통 필터"""
    return (
        SendItem.issue == issue,
        SendItem.cancelled_at.is_(None),
        Send.cancelled_at.is_(None),
        Send.send_status == "PREPARING",
        Send.country_code == "KR",
        OrderItem.cancelled_at.is_(None),
    )


# ── 후보 조회 (단품) ──────────────────────────────────────────────────────────

def get_monthly_candidates(
    db: Session,
    issue: str,
    postal_code: Optional[str] = None,
) -> List[MonthlyExcelCandidate]:
    """단품 엑셀 후보 조회 (Send 단위, SendItem 집계 포함)

    - product_code prefix가 6종(W0/WB/HN/CL/CH/JN) 중 하나
    - 같은 Send의 SendItem들은 items 리스트로 묶어 반환
    """
    query = (
        db.query(Send, SendItem, OrderItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(*_base_filter(issue))
        .filter(OrderItem.product_kind == "MONTHLY")
    )
    if postal_code:
        query = query.filter(Send.postal_code == postal_code.strip())

    rows = query.order_by(Send.postal_code.asc(), Send.send_id.asc(), SendItem.send_item_id.asc()).all()

    # Send 단위 그룹
    by_send: Dict[int, MonthlyExcelCandidate] = {}
    for send, send_item, _order_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in MONTHLY_COLUMN_MAP:
            continue  # 알 수 없는 prefix는 스킵

        if send.send_id not in by_send:
            by_send[send.send_id] = MonthlyExcelCandidate(
                send_id=send.send_id,
                order_id=send.order_id,
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
            column_label=MONTHLY_COLUMN_MAP[prefix],
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
        .filter(*_base_filter(issue))
        .filter(OrderItem.product_kind == "YEARLY")
        .filter(or_(*prefix_filters))
    )
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
            order_id=send.order_id,
            order_item_id=send_item.order_item_id,
            recipient_name=send.recipient_name or "",
            recipient_phone=send.recipient_phone or "",
            postal_code=send.postal_code or "",
            recipient_address=send.recipient_address or "",
            product_code=send_item.product_code,
            prefix=prefix,
            display_product_name=YEARLY_DISPLAY_NAME_MAP.get(prefix, send_item.product_name),
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

# 정기구독 zebra grouping 색
_ZEBRA_WHITE = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
_ZEBRA_GRAY = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")


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

_MONTHLY_HEADERS = [
    "날짜", "이름", "연락처", "우편번호", "주소",
    "말씀함께", "큰글자", "꿀땅", "저학년", "고학년", "청소년",
    "비고", "박스수", "안전봉투", "송장번호",
]
_MONTHLY_WIDTHS = [12, 12, 16, 10, 40, 10, 10, 10, 10, 10, 10, 14, 8, 10, 16]


def build_monthly_excel(
    db: Session,
    send_ids: List[int],
    send_date_yyyymmdd: str,
) -> Tuple[io.BytesIO, List[int], List[ExcelDownloadSkip]]:
    """단품 엑셀 생성

    Returns:
        (BytesIO, 실제 엑셀에 포함된 send_ids, 스킵된 send_ids)
    """
    date_label = format_send_date_label(send_date_yyyymmdd)

    # 대상 Send + SendItem 조회
    rows = (
        db.query(Send, SendItem, OrderItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(Send.send_id.in_(send_ids))
        .filter(
            SendItem.cancelled_at.is_(None),
            Send.cancelled_at.is_(None),
            Send.send_status == "PREPARING",
            Send.country_code == "KR",
            OrderItem.cancelled_at.is_(None),
            OrderItem.product_kind == "MONTHLY",
        )
        .all()
    )

    # 요청된 send_id 중 조건에 맞지 않는 것은 스킵 리스트에
    included_send_ids = set(r[0].send_id for r in rows)
    skipped: List[ExcelDownloadSkip] = []
    for sid in send_ids:
        if sid not in included_send_ids:
            skipped.append(ExcelDownloadSkip(
                send_id=sid,
                reason="대상 조건 불일치(상태/취소/해외/상품종류)",
            ))

    # 배송지 그룹화
    # key: (name, phone, postal_code, address) → {"sends": [Send...], "products": {prefix: sum}}
    groups: Dict[Tuple[str, str, str, str], Dict] = {}
    for send, send_item, _order_item in rows:
        prefix = extract_prefix(send_item.product_code)
        if prefix not in MONTHLY_COLUMN_MAP:
            continue
        key = address_group_key(send)
        if key not in groups:
            groups[key] = {
                "recipient_name": send.recipient_name or "",
                "recipient_phone": send.recipient_phone or "",
                "postal_code": send.postal_code or "",
                "recipient_address": send.recipient_address or "",
                "send_ids": set(),
                "quantities": {p: 0 for p in MONTHLY_COLUMN_MAP.keys()},
            }
        groups[key]["send_ids"].add(send.send_id)
        groups[key]["quantities"][prefix] += send_item.send_num

    # 정렬: 우편번호 → 주소 → 이름
    sorted_keys = sorted(
        groups.keys(),
        key=lambda k: (k[2], k[3], k[0]),
    )

    # 엑셀 생성
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "단품발송"

    _write_header(ws, _MONTHLY_HEADERS)

    for row_idx, key in enumerate(sorted_keys, start=2):
        group = groups[key]
        qty = group["quantities"]
        row_values = [
            date_label,
            group["recipient_name"],
            group["recipient_phone"],
            group["postal_code"],
            group["recipient_address"],
            qty["W0"] or "",
            qty["WB"] or "",
            qty["HN"] or "",
            qty["CL"] or "",
            qty["CH"] or "",
            qty["JN"] or "",
            "",    # 비고
            "",    # 박스수
            "",    # 안전봉투
            "",    # 송장번호
        ]
        for col_idx, value in enumerate(row_values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = _THIN_BORDER
            # 수량 컬럼(6~11)과 고정 컬럼 일부는 가운데 정렬
            if col_idx in (1, 4) or 6 <= col_idx <= 15:
                cell.alignment = _CENTER_ALIGN
            else:
                cell.alignment = _LEFT_ALIGN

    _set_column_widths(ws, _MONTHLY_WIDTHS)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    included_ids_flat: List[int] = sorted(included_send_ids)
    return output, included_ids_flat, skipped


# ── 엑셀 빌더 (정기구독 공통) ──────────────────────────────────────────────────

_YEARLY_HEADERS = [
    "이름", "연락처", "우편번호", "주소", "시작", "상품명", "구독기간", "수량", "비고",
]
_YEARLY_WIDTHS = [12, 16, 10, 40, 12, 10, 24, 8, 14]


def _write_yearly_sheet(
    ws: Worksheet,
    candidates: List[YearlyExcelCandidate],
) -> None:
    """정기구독 시트에 헤더 + 데이터 쓰기 (zebra grouping 적용)"""
    _write_header(ws, _YEARLY_HEADERS)

    # 정렬: 배송지 키 → 상품명 → 시작호
    sorted_cands = sorted(
        candidates,
        key=lambda c: (
            c.postal_code.strip(),
            c.recipient_address.strip(),
            c.recipient_name.strip(),
            c.recipient_phone.strip(),
            c.display_product_name,
            c.final_subscribe_start_issue,
        ),
    )

    prev_addr_key = None
    use_gray = False
    for row_idx, cand in enumerate(sorted_cands, start=2):
        addr_key = (
            cand.recipient_name.strip(),
            cand.recipient_phone.strip(),
            cand.postal_code.strip(),
            cand.recipient_address.strip(),
        )
        if addr_key != prev_addr_key:
            use_gray = not use_gray
            prev_addr_key = addr_key
        fill = _ZEBRA_GRAY if use_gray else _ZEBRA_WHITE

        row_values = [
            cand.recipient_name,
            cand.recipient_phone,
            cand.postal_code,
            cand.recipient_address,
            cand.start_label,
            cand.display_product_name,
            cand.period_label,
            cand.send_num,
            "",    # 비고
        ]
        for col_idx, value in enumerate(row_values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = _THIN_BORDER
            cell.fill = fill
            if col_idx in (3, 5, 6, 7, 8):  # 우편번호/시작/상품명/구독기간/수량 가운데
                cell.alignment = _CENTER_ALIGN
            else:
                cell.alignment = _LEFT_ALIGN

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
    rows = (
        db.query(Send, SendItem, OrderItem)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(Send.send_id.in_(send_ids))
        .filter(
            SendItem.cancelled_at.is_(None),
            Send.cancelled_at.is_(None),
            Send.send_status == "PREPARING",
            Send.country_code == "KR",
            OrderItem.cancelled_at.is_(None),
            OrderItem.product_kind == "YEARLY",
        )
        .all()
    )

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
            order_id=send.order_id,
            order_item_id=send_item.order_item_id,
            recipient_name=send.recipient_name or "",
            recipient_phone=send.recipient_phone or "",
            postal_code=send.postal_code or "",
            recipient_address=send.recipient_address or "",
            product_code=send_item.product_code,
            prefix=prefix,
            display_product_name=YEARLY_DISPLAY_NAME_MAP.get(prefix, send_item.product_name),
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


# ── SHIPPING 일괄 전환 ────────────────────────────────────────────────────────

def mark_sends_as_shipping(
    db: Session,
    send_ids: List[int],
    courier_company: str,
) -> int:
    """엑셀에 포함된 Send들을 PREPARING → SHIPPING 일괄 전환

    - tracking_no는 건드리지 않음 (빈칸 유지; 기출유가 나중에 송장 업로드로 채움)
    - courier_company는 요청받은 값으로 세팅
    - shipped_at = 현재 시각

    Returns:
        실제 업데이트된 건수
    """
    if not send_ids:
        return 0

    now = now_kst()
    updated = (
        db.query(Send)
        .filter(
            Send.send_id.in_(send_ids),
            Send.send_status == "PREPARING",
            Send.cancelled_at.is_(None),
        )
        .update(
            {
                Send.send_status: "SHIPPING",
                Send.courier_company: courier_company,
                Send.shipped_at: now,
            },
            synchronize_session=False,
        )
    )
    db.commit()
    return updated


# ── 파일명 생성 ────────────────────────────────────────────────────────────────

def monthly_filename(send_date_yyyymmdd: str) -> str:
    return f"기출유_단품_{send_date_yyyymmdd}.xlsx"


def yearly_gichulyu_filename(issue: str) -> str:
    return f"기출유_정기구독_{issue}.xlsx"


def yearly_postoffice_filename(issue: str) -> str:
    return f"우체국_정기구독_{issue}.xlsx"
