from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date
import math
import io

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.send import (
    SendCreate, SendUpdate, SendResponse, SendDetailResponse,
    SendListResponse, SendStatusUpdate, SendTrackingUpdate, SendItemResponse
)
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import send_service, order_service, activity_log_service

router = APIRouter(prefix="/sends", tags=["발송"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("", response_model=PaginatedResponse[SendListResponse])
def get_sends(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    send_status: Optional[str] = None,
    courier: Optional[str] = None,
    send_date: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 목록 조회"""
    items, total = send_service.get_sends(db, page, limit, send_status, courier, send_date, search)
    
    return PaginatedResponse(
        message="발송 목록을 조회했습니다.",
        data=[SendListResponse(**item) for item in items],
        pagination=PaginationMeta(
            total=total, page=page, limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    )


@router.get("/date/{send_date}", response_model=ResponseModel[List[SendListResponse]])
def get_sends_by_date(
    send_date: date,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """날짜별 발송 조회"""
    sends = send_service.get_sends_by_date(db, send_date)
    result = []
    for send in sends:
        item_count = send.items.filter_by(cancelled_at=None).count()
        result.append(SendListResponse(**send.__dict__, item_count=item_count))
    return ResponseModel(
        message="날짜별 발송 목록을 조회했습니다.",
        data=result
    )


@router.get("/{send_id}", response_model=ResponseModel[SendDetailResponse])
def get_send(
    send_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 상세 조회"""
    send = send_service.get_send_by_id(db, send_id)
    items = send_service.get_send_items(db, send_id)
    
    return ResponseModel(
        message="발송 정보를 조회했습니다.",
        data=SendDetailResponse(
            **send.__dict__,
            items=[SendItemResponse.model_validate(i) for i in items],
            item_count=len(items)
        )
    )


@router.post("", response_model=ResponseModel[SendDetailResponse], status_code=201)
def create_send(
    send_in: SendCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 등록"""
    order = order_service.get_order_by_id(db, send_in.order_id)
    
    if not send_in.items:
        raise HTTPException(status_code=400, detail="발송 상품을 추가해주세요.")
    
    try:
        send = send_service.create_send(db, send_in)
        items = send_service.get_send_items(db, send.send_id)
        
        activity_log_service.create_log(
            db=db,
            admin=current_admin,
            action=ActivityAction.CREATE,
            target_type=ActivityTargetType.SEND,
            target_id=send.send_id,
            details={
                "reason": "발송 등록 성공",
                "order_id": send.order_id,
                "address_name": send.address_name,
                "item_count": len(items),
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return ResponseModel(
            message="발송이 등록되었습니다.",
            data=SendDetailResponse(**send.__dict__, items=[SendItemResponse.model_validate(i) for i in items], item_count=len(items))
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{send_id}", response_model=ResponseModel[SendResponse])
def update_send(
    send_id: int,
    send_in: SendUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 수정"""
    send = send_service.get_send_by_id(db, send_id)
    
    old_data = {
        "send_date": str(send.send_date) if send.send_date else None,
        "send_status": send.send_status,
        "courier_company": send.courier_company
    }
    
    send = send_service.update_send(db, send, send_in)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        target_id=send_id,
        details={
            "reason": "발송 수정 성공",
            "before": old_data,
            "after": send_in.model_dump(exclude_unset=True)
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="발송 정보가 수정되었습니다.", data=SendResponse.model_validate(send))


@router.patch("/{send_id}/status", response_model=ResponseModel[SendResponse])
def update_send_status(
    send_id: int,
    status_in: SendStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 상태 변경"""
    send = send_service.get_send_by_id(db, send_id)
    
    old_status = send.send_status
    send = send_service.update_send_status(db, send, status_in.status)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        target_id=send_id,
        details={
            "reason": "발송 상태 변경 성공",
            "before": old_status,
            "after": status_in.status
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="발송 상태가 변경되었습니다.", data=SendResponse.model_validate(send))


@router.patch("/{send_id}/tracking", response_model=ResponseModel[SendResponse])
def update_tracking(
    send_id: int,
    tracking_in: SendTrackingUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """운송장 정보 등록"""
    send = send_service.get_send_by_id(db, send_id)
    
    send = send_service.update_tracking(db, send, tracking_in.courier_company, tracking_in.tracking_no)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND,
        target_id=send_id,
        details={
            "reason": "운송장 정보 등록 성공",
            "courier_company": tracking_in.courier_company,
            "tracking_no": tracking_in.tracking_no
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="운송장 정보가 등록되었습니다.", data=SendResponse.model_validate(send))


@router.patch("/{send_id}/cancel", response_model=ResponseModel[SendResponse])
def cancel_send(
    send_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 취소"""
    send = send_service.get_send_by_id(db, send_id)
    
    if send.send_status == "CANCELLED":
        raise HTTPException(status_code=400, detail="이미 취소된 발송입니다.")
    
    old_status = send.send_status
    send = send_service.cancel_send(db, send)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.CANCEL,
        target_type=ActivityTargetType.SEND,
        target_id=send_id,
        details={
            "reason": "발송 취소 성공",
            "before_status": old_status,
            "after_status": send.send_status
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="발송이 취소되었습니다.", data=SendResponse.model_validate(send))


@router.get("/export/excel", response_class=StreamingResponse)
def export_sends_to_excel(
    send_date: Optional[date] = None,
    send_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 데이터 엑셀 다운로드
    
    - send_date: 발송일 필터 (옵션)
    - send_status: 발송 상태 필터 (옵션)
    
    sends와 send_items 데이터를 조인하여 엑셀로 다운로드합니다.
    """
    import openpyxl
    from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
    
    # 쿼리 - sends와 send_items 조인
    query = db.query(
        Send.send_id,
        Send.order_id,
        Send.send_date,
        Send.courier_company,
        Send.tracking_no,
        Send.send_status,
        Send.address_name,
        Send.phone,
        Send.postal_code,
        Send.address,
        Send.address_memo,
        Send.created_at,
        SendItem.send_item_id,
        SendItem.order_item_id,
        SendItem.product_code,
        SendItem.product_name,
        SendItem.send_num,
        SendItem.purchase
    ).join(SendItem, Send.send_id == SendItem.send_id)\
     .filter(Send.cancelled_at.is_(None), SendItem.cancelled_at.is_(None))
    
    if send_date:
        query = query.filter(Send.send_date == send_date)
    
    if send_status:
        query = query.filter(Send.send_status == send_status)
    
    results = query.order_by(Send.send_id.asc(), SendItem.send_item_id.asc()).all()
    
    # 엑셀 생성
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "발송목록"
    
    # 헤더 스타일
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center")
    thin_border = Border(
        left=Side(style='thin'),
        right=Side(style='thin'),
        top=Side(style='thin'),
        bottom=Side(style='thin')
    )
    
    # 헤더
    headers = [
        "발송ID", "주문ID", "발송일", "택배사", "운송장번호", "발송상태",
        "수령인", "연락처", "우편번호", "주소", "배송메모",
        "발송품목ID", "주문품목ID", "상품코드", "상품명", "수량", "제작단가", "생성일시"
    ]
    
    for col, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
    
    # 데이터
    for row_idx, row in enumerate(results, 2):
        data = [
            row.send_id,
            row.order_id,
            str(row.send_date) if row.send_date else "",
            row.courier_company or "",
            row.tracking_no or "",
            row.send_status,
            row.address_name,
            row.phone,
            row.postal_code,
            row.address,
            row.address_memo or "",
            row.send_item_id,
            row.order_item_id,
            row.product_code,
            row.product_name,
            row.send_num,
            row.purchase,
            row.created_at.strftime("%Y-%m-%d %H:%M:%S") if row.created_at else ""
        ]
        
        for col_idx, value in enumerate(data, 1):
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.border = thin_border
    
    # 컬럼 너비 자동 조정
    column_widths = [10, 10, 12, 12, 18, 12, 12, 15, 10, 40, 20, 12, 12, 18, 30, 8, 10, 20]
    for col_idx, width in enumerate(column_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = width
    
    # 파일 저장
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    # 파일명
    filename = f"sends_{date.today().strftime('%Y%m%d')}.xlsx"
    if send_date:
        filename = f"sends_{send_date.strftime('%Y%m%d')}.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
