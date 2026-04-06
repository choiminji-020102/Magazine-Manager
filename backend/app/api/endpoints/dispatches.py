# 표준 라이브러리
import io
from typing import List, Optional

# 서드파티 라이브러리
import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.address import Address
from app.models.order_item import OrderItem
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import ResponseModel
from app.schemas.dispatch import (
    DispatchGenerateRequest,
    DispatchGenerateResponse,
    DispatchGenerateResult,
    DispatchSummaryResponse,
    DispatchTarget,
    DispatchTargetListQuery,
    DispatchTargetsResponse,
    DispatchTrackingUploadResponse,
    DispatchTrackingUploadResult,
)
from app.services import activity_log_service, order_item_service, product_service
from app.crud import send as send_crud
from app.crud import send_item as send_item_crud
from app.crud import order_item as order_item_crud

router = APIRouter(tags=["발송 처리"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/dispatches/yearly/targets",
    response_model=ResponseModel[DispatchTargetsResponse],
)
def get_yearly_targets(
    query: DispatchTargetListQuery = Depends(DispatchTargetListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """YEARLY 정기구독 발송 대상 조회"""
    targets = order_item_service.find_subscription_targets(
        db=db,
        issue=query.issue,
        product_kind="YEARLY",
        product_code=query.product_code,
    )

    # 수령인 검색 필터
    if query.recipient_search:
        term = query.recipient_search.lower()
        targets = [
            t for t in targets
            if (t.recipient_name and term in t.recipient_name.lower())
            or (t.recipient_phone and term in t.recipient_phone)
        ]

    total_count = len(targets)
    total_pages = (total_count + query.limit - 1) // query.limit if total_count > 0 else 1
    start = (query.page - 1) * query.limit
    paged = targets[start: start + query.limit]

    product_summary: dict = {}
    for t in targets:
        product_summary[t.product_code] = product_summary.get(t.product_code, 0) + 1

    return ResponseModel(
        message="YEARLY 발송 대상 목록을 조회했습니다.",
        data=DispatchTargetsResponse(
            issue=query.issue,
            targets=paged,
            total_count=total_count,
            page=query.page,
            limit=query.limit,
            total_pages=total_pages,
            product_summary=product_summary,
        ),
    )


@router.get(
    "/dispatches/monthly/targets",
    response_model=ResponseModel[DispatchTargetsResponse],
)
def get_monthly_targets(
    query: DispatchTargetListQuery = Depends(DispatchTargetListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """MONTHLY 단편 월간지 발송 대상 조회"""
    targets = order_item_service.find_subscription_targets(
        db=db,
        issue=query.issue,
        product_kind="MONTHLY",
        product_code=query.product_code,
    )

    # 수령인 검색 필터
    if query.recipient_search:
        term = query.recipient_search.lower()
        targets = [
            t for t in targets
            if (t.recipient_name and term in t.recipient_name.lower())
            or (t.recipient_phone and term in t.recipient_phone)
        ]

    total_count = len(targets)
    total_pages = (total_count + query.limit - 1) // query.limit if total_count > 0 else 1
    start = (query.page - 1) * query.limit
    paged = targets[start: start + query.limit]

    product_summary: dict = {}
    for t in targets:
        product_summary[t.product_code] = product_summary.get(t.product_code, 0) + 1

    return ResponseModel(
        message="MONTHLY 발송 대상 목록을 조회했습니다.",
        data=DispatchTargetsResponse(
            issue=query.issue,
            targets=paged,
            total_count=total_count,
            page=query.page,
            limit=query.limit,
            total_pages=total_pages,
            product_summary=product_summary,
        ),
    )


@router.get(
    "/dispatches/postal-code/13113/targets",
    response_model=ResponseModel[DispatchTargetsResponse],
)
def get_postal_code_13113_targets(
    query: DispatchTargetListQuery = Depends(DispatchTargetListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """우편번호 13113 발송 대상 조회 (YEARLY+MONTHLY)"""
    targets = order_item_service.find_subscription_targets(
        db=db,
        issue=query.issue,
        product_code=query.product_code,
        postal_code="13113",
    )

    # 수령인 검색 필터
    if query.recipient_search:
        term = query.recipient_search.lower()
        targets = [
            t for t in targets
            if (t.recipient_name and term in t.recipient_name.lower())
            or (t.recipient_phone and term in t.recipient_phone)
        ]

    total_count = len(targets)
    total_pages = (total_count + query.limit - 1) // query.limit if total_count > 0 else 1
    start = (query.page - 1) * query.limit
    paged = targets[start: start + query.limit]

    product_summary: dict = {}
    for t in targets:
        product_summary[t.product_code] = product_summary.get(t.product_code, 0) + 1

    return ResponseModel(
        message="우편번호 13113 발송 대상 목록을 조회했습니다.",
        data=DispatchTargetsResponse(
            issue=query.issue,
            targets=paged,
            total_count=total_count,
            page=query.page,
            limit=query.limit,
            total_pages=total_pages,
            product_summary=product_summary,
        ),
    )


@router.get(
    "/dispatches/summary",
    response_model=ResponseModel[DispatchSummaryResponse],
)
def get_dispatch_summary(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """특정 호(issue)의 발송 현황 요약 조회"""
    # 총 발송 대상: 해당 호 구독 중인 모든 OrderItem (YEARLY+MONTHLY, 취소 제외)
    all_targets = order_item_service.find_subscription_targets(db=db, issue=issue)
    total_target_count = len(all_targets)

    # 이미 발송된 OrderItem: last_send_issue == issue (발송 처리 완료된 것)
    from sqlalchemy import func
    dispatched_ids = set(
        row[0] for row in db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.issue == issue,
            SendItem.cancelled_at.is_(None),
            Send.cancelled_at.is_(None),
        )
        .distinct()
        .all()
    )
    dispatched_count = len(dispatched_ids)
    pending_count = total_target_count - dispatched_count

    # 상품별 현황 집계
    product_map: dict = {}
    for t in all_targets:
        code = t.product_code
        name = t.product_name
        if code not in product_map:
            product_map[code] = {"product_code": code, "product_name": name, "total": 0, "dispatched": 0, "pending": 0}
        product_map[code]["total"] += 1
        if t.order_item_id in dispatched_ids:
            product_map[code]["dispatched"] += 1
        else:
            product_map[code]["pending"] += 1

    # Send 상태별 카운트 (해당 호의 SendItem을 가진 Send)
    status_rows = (
        db.query(Send.send_status, func.count(Send.send_id))
        .join(SendItem, Send.send_id == SendItem.send_id)
        .filter(
            SendItem.issue == issue,
            SendItem.cancelled_at.is_(None),
        )
        .group_by(Send.send_status)
        .all()
    )
    by_status = {row[0]: row[1] for row in status_rows}

    return ResponseModel(
        message="발송 현황 요약을 조회했습니다.",
        data=DispatchSummaryResponse(
            issue=issue,
            total_target_count=total_target_count,
            dispatched_count=dispatched_count,
            pending_count=pending_count,
            by_product=list(product_map.values()),
            by_status=by_status,
        ),
    )


# ── 발송 처리 ──────────────────────────────────────────────────────────────────

def _process_dispatch(
    db: Session,
    req: DispatchGenerateRequest,
    product_kind: str,
) -> List[DispatchGenerateResult]:
    """발송 처리 공통 로직 (YEARLY/MONTHLY 공유)"""
    results: List[DispatchGenerateResult] = []

    for order_item_id in req.order_item_ids:
        try:
            order_item = db.query(OrderItem).filter(
                OrderItem.order_item_id == order_item_id
            ).first()
            if not order_item:
                results.append(DispatchGenerateResult(
                    order_item_id=order_item_id,
                    success=False,
                    message=f"주문 품목을 찾을 수 없습니다: {order_item_id}",
                ))
                continue

            # 종류 검증
            if order_item.product_kind != product_kind:
                results.append(DispatchGenerateResult(
                    order_item_id=order_item_id,
                    success=False,
                    message=f"{product_kind} 품목이 아닙니다. (실제: {order_item.product_kind})",
                ))
                continue

            # 취소 검증
            if order_item.cancelled_at is not None:
                results.append(DispatchGenerateResult(
                    order_item_id=order_item_id,
                    success=False,
                    message="취소된 주문 품목입니다.",
                ))
                continue

            # 중복 발송 방지: 동일 order_item_id + 동일 issue의 SendItem이 이미 존재하면 스킵
            existing = db.query(SendItem).join(
                Send, SendItem.send_id == Send.send_id
            ).filter(
                SendItem.order_item_id == order_item_id,
                SendItem.issue == req.issue,
                SendItem.cancelled_at.is_(None),
                Send.cancelled_at.is_(None),
            ).first()
            if existing:
                results.append(DispatchGenerateResult(
                    order_item_id=order_item_id,
                    success=False,
                    message=f"이미 {req.issue}호 발송이 존재합니다. (send_item_id={existing.send_item_id})",
                ))
                continue

            # 발송용 상품 코드 결정
            # YEARLY: M1001+202601 → M1001-202602 (해당 issue의 MONTHLY 상품으로 변환)
            # MONTHLY: 그대로 사용
            send_product_code = order_item_service.convert_to_send_product_code(
                order_item.product_code, order_item.product_kind, req.issue
            )
            send_product = product_service.get_product_by_code(db, send_product_code)
            if not send_product:
                results.append(DispatchGenerateResult(
                    order_item_id=order_item_id,
                    success=False,
                    message=f"발송 상품을 찾을 수 없습니다: {send_product_code}",
                ))
                continue

            # 배송지 조회 (스냅샷용)
            addr = None
            if order_item.address_id:
                addr = db.query(Address).filter(
                    Address.address_id == order_item.address_id
                ).first()
            if not addr:
                results.append(DispatchGenerateResult(
                    order_item_id=order_item_id,
                    success=False,
                    message="배송지 정보가 없습니다.",
                ))
                continue

            # Send 생성
            send = send_crud.create_send(
                db=db,
                order_id=order_item.order_id,
                address_id=addr.address_id,
                official_send_date=req.official_send_date,
                admin_memo=None,
                recipient_name=addr.recipient_name,
                recipient_phone=addr.recipient_phone,
                country_code=addr.country_code,
                postal_code=addr.postal_code,
                recipient_address=addr.recipient_address,
                customer_memo=addr.customer_memo,
            )

            # 배송사 자동 설정
            if product_kind == "YEARLY":
                send.courier_company = "자체배송"
                send.tracking_no = "자체배송"
            elif product_kind == "MONTHLY":
                send.courier_company = "CJ대한통운"

            # SendItem 생성
            send_item_crud.create_send_item(
                db=db,
                send_id=send.send_id,
                order_item_id=order_item_id,
                product_code=send_product.product_code,
                product_name=send_product.product_name,
                issue=req.issue,
                send_num=order_item.order_num,
                cost_price=send_product.cost_price or 0,
                unit_weight=float(send_product.unit_weight) if send_product.unit_weight is not None else None,
                unit_width=float(send_product.unit_width) if send_product.unit_width is not None else None,
                unit_length=float(send_product.unit_length) if send_product.unit_length is not None else None,
                unit_height=float(send_product.unit_height) if send_product.unit_height is not None else None,
            )

            # OrderItem.last_send_issue 업데이트
            order_item_crud.update_last_send_issue(db=db, order_item=order_item, issue=req.issue)

            results.append(DispatchGenerateResult(
                order_item_id=order_item_id,
                success=True,
                send_id=send.send_id,
            ))

        except Exception as e:
            results.append(DispatchGenerateResult(
                order_item_id=order_item_id,
                success=False,
                message=str(e),
            ))

    return results


@router.post(
    "/dispatches/yearly/generate",
    response_model=ResponseModel[DispatchGenerateResponse],
    status_code=status.HTTP_201_CREATED,
)
def generate_yearly_dispatch(
    req: DispatchGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """YEARLY 정기구독 발송 일괄 처리"""
    if not req.order_item_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="발송 처리할 order_item_ids를 1개 이상 입력해야 합니다.",
        )

    results = _process_dispatch(db=db, req=req, product_kind="YEARLY")
    db.commit()

    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.DISPATCH,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"YEARLY {req.issue}호 일괄 발송",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "issue": req.issue,
            "official_send_date": str(req.official_send_date) if req.official_send_date else None,
            "total_requested": len(req.order_item_ids),
            "success_count": success_count,
            "fail_count": fail_count,
        },
    )

    return ResponseModel(
        message="YEARLY 발송 처리가 완료되었습니다.",
        data=DispatchGenerateResponse(
            issue=req.issue,
            total_requested=len(req.order_item_ids),
            success_count=success_count,
            fail_count=fail_count,
            results=results,
        ),
    )


@router.post(
    "/dispatches/monthly/generate",
    response_model=ResponseModel[DispatchGenerateResponse],
    status_code=status.HTTP_201_CREATED,
)
def generate_monthly_dispatch(
    req: DispatchGenerateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """MONTHLY 단편 월간지 발송 일괄 처리"""
    if not req.order_item_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="발송 처리할 order_item_ids를 1개 이상 입력해야 합니다.",
        )

    results = _process_dispatch(db=db, req=req, product_kind="MONTHLY")
    db.commit()

    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DISPATCH,
        target_type=ActivityTargetType.DISPATCH,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"MONTHLY {req.issue}호 일괄 발송",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "issue": req.issue,
            "official_send_date": str(req.official_send_date) if req.official_send_date else None,
            "total_requested": len(req.order_item_ids),
            "success_count": success_count,
            "fail_count": fail_count,
        },
    )

    return ResponseModel(
        message="MONTHLY 발송 처리가 완료되었습니다.",
        data=DispatchGenerateResponse(
            issue=req.issue,
            total_requested=len(req.order_item_ids),
            success_count=success_count,
            fail_count=fail_count,
            results=results,
        ),
    )


# ── 엑셀 다운로드 / 송장 업로드 ────────────────────────────────────────────────

def _build_dispatch_excel(db: Session, issue: str, product_kind: str) -> io.BytesIO:
    """기출유 제출용 엑셀 파일 생성 (YEARLY 우편 / MONTHLY 택배 공통)"""
    # issue의 해당 product_kind Send + SendItem 조회 (PREPARING, 미취소)
    rows = (
        db.query(Send, SendItem)
        .join(SendItem, Send.send_id == SendItem.send_id)
        .join(OrderItem, SendItem.order_item_id == OrderItem.order_item_id)
        .filter(
            SendItem.issue == issue,
            SendItem.cancelled_at.is_(None),
            Send.cancelled_at.is_(None),
            Send.send_status == "PREPARING",
            OrderItem.product_kind == product_kind,
        )
        .order_by(Send.send_id.asc(), SendItem.send_item_id.asc())
        .all()
    )

    # send_id → (send, {product_name: send_num}) 피벗
    send_map: dict = {}
    product_names: list = []

    for send, send_item in rows:
        if send.send_id not in send_map:
            send_map[send.send_id] = {"send": send, "products": {}}
        pname = send_item.product_name
        send_map[send.send_id]["products"][pname] = (
            send_map[send.send_id]["products"].get(pname, 0) + send_item.send_num
        )
        if pname not in product_names:
            product_names.append(pname)

    # 엑셀 생성
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "발송목록"

    # 스타일 정의
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )
    center_align = Alignment(horizontal="center", vertical="center")

    # 헤더: 날짜 / 이름 / 연락처 / 우편번호 / 주소 / [상품명들] / 합계 / 비고 / 송장번호 / 발송ID
    headers = ["날짜", "이름", "연락처", "우편번호", "주소"] + product_names + ["합계", "비고", "송장번호", "발송ID"]
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    # issue → "2월호" 형식
    month = int(issue[4:6])
    issue_label = f"{month}월호"

    # 데이터 행
    for row_idx, (send_id, data) in enumerate(send_map.items(), 2):
        send = data["send"]
        products = data["products"]

        # 날짜: "02월 13일"
        if send.official_send_date:
            date_str = f"{send.official_send_date.month:02d}월 {send.official_send_date.day:02d}일"
        else:
            date_str = ""

        total = sum(products.values())

        row_data = [
            date_str,
            send.recipient_name,
            send.recipient_phone,
            send.postal_code,
            send.recipient_address,
        ]
        for pname in product_names:
            qty = products.get(pname, "")
            row_data.append(qty if qty else "")
        row_data.append(total)
        row_data.append(issue_label)
        row_data.append("")       # 송장번호 (기출유가 채워 넣음)
        row_data.append(send_id)  # 발송ID (매칭 키)

        for col_idx, value in enumerate(row_data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
            # 수량 컬럼 중앙 정렬
            if col_idx > 5:
                cell.alignment = center_align

    # 열 너비 자동 설정
    fixed_widths = [12, 12, 16, 10, 40]  # 날짜/이름/연락처/우편번호/주소
    product_widths = [12] * len(product_names)
    tail_widths = [8, 10, 14, 10]  # 합계/비고/송장번호/발송ID
    all_widths = fixed_widths + product_widths + tail_widths
    for col_idx, width in enumerate(all_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return output


def _process_tracking_upload(
    db: Session,
    issue: str,
    file_bytes: bytes,
    courier_company: str,
) -> List[DispatchTrackingUploadResult]:
    """송장 엑셀 업로드 처리 공통 로직"""
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일을 읽을 수 없습니다.",
        )

    ws = wb.active
    header_row = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]

    # '발송ID', '송장번호' 컬럼 위치 찾기
    try:
        send_id_col = header_row.index("발송ID") + 1
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일에 '발송ID' 컬럼이 없습니다. 내보내기한 파일을 그대로 사용해 주세요.",
        )
    try:
        tracking_col = header_row.index("송장번호") + 1
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="엑셀 파일에 '송장번호' 컬럼이 없습니다.",
        )

    results: List[DispatchTrackingUploadResult] = []

    for row_idx in range(2, ws.max_row + 1):
        raw_send_id = ws.cell(row=row_idx, column=send_id_col).value
        raw_tracking = ws.cell(row=row_idx, column=tracking_col).value

        # 빈 행 스킵
        if raw_send_id is None:
            continue
        # 송장번호 없으면 스킵 (처리 안 된 행)
        if not raw_tracking or str(raw_tracking).strip() == "":
            continue

        try:
            send_id = int(raw_send_id)
        except (ValueError, TypeError):
            results.append(DispatchTrackingUploadResult(
                send_id=0,
                success=False,
                message=f"행 {row_idx}: 발송ID 형식 오류 ({raw_send_id})",
            ))
            continue

        send = db.query(Send).filter(Send.send_id == send_id).first()
        if not send:
            results.append(DispatchTrackingUploadResult(
                send_id=send_id,
                success=False,
                message="발송 레코드를 찾을 수 없습니다.",
            ))
            continue

        if send.cancelled_at is not None:
            results.append(DispatchTrackingUploadResult(
                send_id=send_id,
                success=False,
                message="취소된 발송입니다.",
            ))
            continue

        if send.send_status in ("SHIPPING", "DELIVERED"):
            results.append(DispatchTrackingUploadResult(
                send_id=send_id,
                success=False,
                message=f"이미 {send.send_status} 상태입니다.",
            ))
            continue

        tracking_no = str(raw_tracking).strip()
        send_crud.update_tracking(db=db, send=send, tracking_no=tracking_no, courier_company=courier_company)

        results.append(DispatchTrackingUploadResult(
            send_id=send_id,
            success=True,
        ))

    db.commit()
    return results


@router.get(
    "/dispatches/yearly/export",
    response_class=StreamingResponse,
)
def export_yearly_dispatch(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """YEARLY 기출유 우편 발송 엑셀 다운로드"""
    output = _build_dispatch_excel(db=db, issue=issue, product_kind="YEARLY")
    filename = f"yearly_dispatch_{issue}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/dispatches/monthly/export",
    response_class=StreamingResponse,
)
def export_monthly_dispatch(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """MONTHLY 기출유 택배 발송 엑셀 다운로드"""
    output = _build_dispatch_excel(db=db, issue=issue, product_kind="MONTHLY")
    filename = f"monthly_dispatch_{issue}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post(
    "/dispatches/yearly/upload-tracking",
    response_model=ResponseModel[DispatchTrackingUploadResponse],
)
def upload_yearly_tracking(
    issue: str,
    request: Request,
    file: UploadFile = File(..., description="기출유에서 송장번호 입력 후 반환한 엑셀 파일"),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """YEARLY 기출유 우편 송장 업로드 → SHIPPING 전환 (자체배송)"""
    file_bytes = file.file.read()
    results = _process_tracking_upload(
        db=db,
        issue=issue,
        file_bytes=file_bytes,
        courier_company="자체배송",
    )

    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"YEARLY {issue}호 송장 업로드",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"issue": issue, "success_count": success_count, "fail_count": fail_count},
    )

    return ResponseModel(
        message=f"송장 업로드 완료: 성공 {success_count}건, 실패 {fail_count}건",
        data=DispatchTrackingUploadResponse(
            issue=issue,
            total=len(results),
            success_count=success_count,
            fail_count=fail_count,
            results=results,
        ),
    )


@router.post(
    "/dispatches/monthly/upload-tracking",
    response_model=ResponseModel[DispatchTrackingUploadResponse],
)
def upload_monthly_tracking(
    issue: str,
    request: Request,
    file: UploadFile = File(..., description="기출유에서 송장번호 입력 후 반환한 엑셀 파일"),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """MONTHLY 기출유 택배 송장 업로드 → SHIPPING 전환 (CJ대한통운)"""
    file_bytes = file.file.read()
    results = _process_tracking_upload(
        db=db,
        issue=issue,
        file_bytes=file_bytes,
        courier_company="CJ대한통운",
    )

    success_count = sum(1 for r in results if r.success)
    fail_count = len(results) - success_count

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"MONTHLY {issue}호 송장 업로드",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"issue": issue, "success_count": success_count, "fail_count": fail_count},
    )

    return ResponseModel(
        message=f"송장 업로드 완료: 성공 {success_count}건, 실패 {fail_count}건",
        data=DispatchTrackingUploadResponse(
            issue=issue,
            total=len(results),
            success_count=success_count,
            fail_count=fail_count,
            results=results,
        ),
    )
