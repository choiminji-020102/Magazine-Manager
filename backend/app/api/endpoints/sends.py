# 표준 라이브러리
import io
from datetime import date
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.send import (
    SendBatchStatusRequest,
    SendBatchStatusResponse,
    SendBatchStatusResult,
    SendCreate,
    SendDetailResponse,
    SendListQuery,
    SendResponse,
    SendStatusUpdate,
    SendTrackingUpdate,
    SendUpdate,
)
from app.schemas.send_item import SendItemResponse
from app.crud import send as send_crud
from app.services import activity_log_service, order_service, send_service

router = APIRouter(tags=["발송"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/sends",
    response_model=PaginatedResponse[SendResponse],
)
def list_sends(
    query: SendListQuery = Depends(SendListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """발송 목록 조회"""
    items, total = send_service.list_sends(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=[SendResponse.model_validate(s) for s in items],
    )


@router.get(
    "/sends/postal-code/13113",
    response_model=PaginatedResponse[SendResponse],
)
def list_sends_postal_13113(
    query: SendListQuery = Depends(SendListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """우편번호 13113 발송 목록 (관리자 직접 발송용)"""
    query.postal_code = "13113"
    items, total = send_service.list_sends(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=[SendResponse.model_validate(s) for s in items],
    )


@router.get(
    "/orders/{order_id}/sends",
    response_model=ResponseModel[List[SendResponse]],
)
def get_sends_by_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """주문별 발송 목록"""
    order_service.get_order_by_id(db, order_id)  # 주문 존재 확인
    sends = send_service.get_sends_by_order(db, order_id)

    return ResponseModel(
        message="주문별 발송 목록을 조회했습니다.",
        data=[SendResponse.model_validate(s) for s in sends],
    )


@router.get(
    "/sends/export/excel",
    response_class=StreamingResponse,
)
def export_sends_to_excel(
    official_send_date: Optional[date] = None,
    send_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """발송 데이터 엑셀 다운로드"""
    import openpyxl
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    query = (
        db.query(
            Send.send_id,
            Send.order_id,
            Send.official_send_date,
            Send.courier_company,
            Send.tracking_no,
            Send.send_status,
            Send.recipient_name,
            Send.recipient_phone,
            Send.postal_code,
            Send.recipient_address,
            Send.customer_memo,
            Send.created_at,
            SendItem.send_item_id,
            SendItem.order_item_id,
            SendItem.product_code,
            SendItem.product_name,
            SendItem.issue,
            SendItem.send_num,
            SendItem.cost_price,
        )
        .join(SendItem, Send.send_id == SendItem.send_id)
        .filter(Send.cancelled_at.is_(None), SendItem.cancelled_at.is_(None))
    )

    if official_send_date:
        query = query.filter(Send.official_send_date == official_send_date)
    if send_status:
        query = query.filter(Send.send_status == send_status)

    results = query.order_by(Send.send_id.asc(), SendItem.send_item_id.asc()).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "발송목록"

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style="thin"),
        right=Side(style="thin"),
        top=Side(style="thin"),
        bottom=Side(style="thin"),
    )

    headers = [
        "발송ID", "주문ID", "공식발송일", "택배사", "운송장번호", "발송상태",
        "수령인", "연락처", "우편번호", "주소", "배송메모",
        "발송품목ID", "주문품목ID", "상품코드", "상품명", "발송호", "수량", "제작단가", "생성일시",
    ]

    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    for row_idx, row in enumerate(results, 2):
        data = [
            row.send_id,
            row.order_id,
            str(row.official_send_date) if row.official_send_date else "",
            row.courier_company or "",
            row.tracking_no or "",
            row.send_status,
            row.recipient_name,
            row.recipient_phone,
            row.postal_code,
            row.recipient_address,
            row.customer_memo or "",
            row.send_item_id,
            row.order_item_id,
            row.product_code,
            row.product_name,
            row.issue,
            row.send_num,
            row.cost_price,
            row.created_at.strftime("%Y-%m-%d %H:%M:%S") if row.created_at else "",
        ]

        for col_idx, value in enumerate(data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border

    column_widths = [10, 10, 12, 12, 18, 12, 12, 15, 10, 40, 20, 12, 12, 18, 30, 10, 8, 10, 20]
    for col_idx, width in enumerate(column_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"sends_{date.today().strftime('%Y%m%d')}.xlsx"
    if official_send_date:
        filename = f"sends_{official_send_date.strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get(
    "/sends/{send_id}",
    response_model=ResponseModel[SendDetailResponse],
)
def get_send(
    send_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """발송 상세 조회 (품목 포함)"""
    send = send_service.get_send_by_id(db, send_id)
    items = send_service.get_send_items(db, send_id)

    response = SendDetailResponse.model_validate(send)
    response.items = [SendItemResponse.model_validate(i) for i in items]

    return ResponseModel(
        message="발송 정보를 조회했습니다.",
        data=response,
    )


# ── 생성 ──────────────────────────────────────────────────────────────────────

@router.post(
    "/sends",
    response_model=ResponseModel[SendDetailResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_send(
    send_in: SendCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """발송 등록"""
    send = send_service.create_send(db, send_in)
    items = send_service.get_send_items(db, send.send_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send.send_id,
        target_name=send.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "order_id": send.order_id,
            "item_count": len(items),
        },
    )

    response = SendDetailResponse.model_validate(send)
    response.items = [SendItemResponse.model_validate(i) for i in items]

    return ResponseModel(
        message="발송이 등록되었습니다.",
        data=response,
    )


# ── 수정 ──────────────────────────────────────────────────────────────────────

@router.put(
    "/sends/{send_id}",
    response_model=ResponseModel[SendDetailResponse],
)
def update_send(
    send_id: int,
    send_in: SendUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """발송 수정"""
    send = send_service.get_send_by_id(db, send_id)
    before = {
        "recipient_name": send.recipient_name,
        "recipient_phone": send.recipient_phone,
        "postal_code": send.postal_code,
        "recipient_address": send.recipient_address,
        "admin_memo": send.admin_memo,
    }

    updated = send_service.update_send(db, send, send_in)
    items = send_service.get_send_items(db, updated.send_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_id,
        target_name=send.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"before": before, "after": send_in.model_dump(exclude_unset=True)},
    )

    response = SendDetailResponse.model_validate(updated)
    response.items = [SendItemResponse.model_validate(i) for i in items]

    return ResponseModel(
        message="발송 정보가 수정되었습니다.",
        data=response,
    )


@router.patch(
    "/sends/{send_id}/status",
    response_model=ResponseModel[SendResponse],
)
def update_send_status(
    send_id: int,
    status_in: SendStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """발송 상태 변경"""
    send = send_service.get_send_by_id(db, send_id)
    old_status = send.send_status

    updated = send_service.update_send_status(db, send, status_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_id,
        target_name=send.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"before": {"send_status": old_status}, "after": {"send_status": status_in.send_status}},
    )

    return ResponseModel(
        message="발송 상태가 변경되었습니다.",
        data=SendResponse.model_validate(updated),
    )


@router.patch(
    "/sends/{send_id}/tracking",
    response_model=ResponseModel[SendResponse],
)
def update_tracking(
    send_id: int,
    tracking_in: SendTrackingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """운송장 번호 등록 → SHIPPING 전환"""
    send = send_service.get_send_by_id(db, send_id)

    updated = send_service.update_tracking(
        db, send, tracking_in.tracking_no, tracking_in.courier_company
    )

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_id,
        target_name=send.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "courier_company": tracking_in.courier_company,
            "tracking_no": tracking_in.tracking_no,
        },
    )

    return ResponseModel(
        message="운송장 정보가 등록되었습니다.",
        data=SendResponse.model_validate(updated),
    )


# ── 취소 ──────────────────────────────────────────────────────────────────────

@router.post(
    "/sends/{send_id}/cancel",
    response_model=ResponseModel[SendResponse],
)
def cancel_send(
    send_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """발송 취소 (연관 SendItem도 취소)"""
    send = send_service.get_send_by_id(db, send_id)
    old_status = send.send_status

    cancelled = send_service.cancel_send(db, send)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CANCEL,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_id,
        target_name=send.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"before": {"send_status": old_status}, "after": {"send_status": "CANCELLED"}},
    )

    return ResponseModel(
        message="발송이 취소되었습니다.",
        data=SendResponse.model_validate(cancelled),
    )


# ── 일괄 상태 전환 ──────────────────────────────────────────────────────────

@router.post(
    "/sends/batch/shipping",
    response_model=ResponseModel[SendBatchStatusResponse],
)
def batch_shipping(
    req: SendBatchStatusRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """PREPARING 상태 발송을 일괄 SHIPPING 전환"""
    results = []
    success_count = 0
    for send_id in req.send_ids:
        try:
            send = send_crud.read_send_by_id(db, send_id)
            if send.send_status != "PREPARING":
                results.append(SendBatchStatusResult(
                    send_id=send_id, success=False,
                    message=f"PREPARING 상태가 아닙니다. 현재: {send.send_status}",
                ))
                continue
            send_crud.update_send_status(db, send, "SHIPPING",
                                         courier_company=send.courier_company,
                                         tracking_no=send.tracking_no)
            results.append(SendBatchStatusResult(send_id=send_id, success=True))
            success_count += 1
        except Exception as e:
            results.append(SendBatchStatusResult(
                send_id=send_id, success=False, message=str(e),
            ))

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"일괄 배송중 전환 ({success_count}건)",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "total": len(req.send_ids),
            "success_count": success_count,
            "fail_count": len(req.send_ids) - success_count,
        },
    )

    return ResponseModel(
        message=f"{success_count}건 배송중으로 전환되었습니다.",
        data=SendBatchStatusResponse(
            total=len(req.send_ids),
            success_count=success_count,
            fail_count=len(req.send_ids) - success_count,
            results=results,
        ),
    )


@router.post(
    "/sends/batch/delivered",
    response_model=ResponseModel[SendBatchStatusResponse],
)
def batch_delivered(
    req: SendBatchStatusRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """SHIPPING 상태 발송을 일괄 DELIVERED 전환"""
    results = []
    success_count = 0
    for send_id in req.send_ids:
        try:
            send = send_crud.read_send_by_id(db, send_id)
            if send.send_status != "SHIPPING":
                results.append(SendBatchStatusResult(
                    send_id=send_id, success=False,
                    message=f"SHIPPING 상태가 아닙니다. 현재: {send.send_status}",
                ))
                continue
            send_crud.update_send_status(db, send, "DELIVERED")
            results.append(SendBatchStatusResult(send_id=send_id, success=True))
            success_count += 1
        except Exception as e:
            results.append(SendBatchStatusResult(
                send_id=send_id, success=False, message=str(e),
            ))

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=None,
        target_name=f"일괄 배송완료 전환 ({success_count}건)",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "total": len(req.send_ids),
            "success_count": success_count,
            "fail_count": len(req.send_ids) - success_count,
        },
    )

    return ResponseModel(
        message=f"{success_count}건 배송완료로 전환되었습니다.",
        data=SendBatchStatusResponse(
            total=len(req.send_ids),
            success_count=success_count,
            fail_count=len(req.send_ids) - success_count,
            results=results,
        ),
    )

