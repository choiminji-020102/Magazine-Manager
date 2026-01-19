from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import date
import math

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.send import (
    SendCreate, SendUpdate, SendResponse, SendDetailResponse,
    SendListResponse, SendStatusUpdate, SendTrackingUpdate, SendItemResponse
)
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
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
    return ResponseModel(data=result)


@router.get("/{send_id}", response_model=ResponseModel[SendDetailResponse])
def get_send(
    send_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 상세 조회"""
    send = send_service.get_send_by_id(db, send_id)
    if send is None:
        raise HTTPException(status_code=404, detail="발송 정보를 찾을 수 없습니다.")
    
    items = send_service.get_send_items(db, send_id)
    return ResponseModel(data=SendDetailResponse(
        **send.__dict__,
        items=[SendItemResponse.model_validate(i) for i in items],
        item_count=len(items)
    ))


@router.post("", response_model=ResponseModel[SendDetailResponse], status_code=201)
def create_send(
    send_in: SendCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 등록"""
    order = order_service.get_order_by_id(db, send_in.order_id)
    if order is None:
        raise HTTPException(status_code=400, detail="주문을 찾을 수 없습니다.")
    
    if not send_in.items:
        raise HTTPException(status_code=400, detail="발송 상품을 추가해주세요.")
    
    try:
        send = send_service.create_send(db, send_in)
        items = send_service.get_send_items(db, send.send_id)
        
        activity_log_service.create_log(
            db=db,
            action="CREATE",
            target_type="SEND",
            target_id=send.send_id,
            target_name=f"발송#{send.send_id}",
            details={
                "order_id": send.order_id,
                "address_name": send.address_name,
                "item_count": len(items)
            },
            admin=current_admin,
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
    if send is None:
        raise HTTPException(status_code=404, detail="발송 정보를 찾을 수 없습니다.")
    
    old_data = {
        "send_date": str(send.send_date) if send.send_date else None,
        "send_status": send.send_status,
        "courier_company": send.courier_company
    }
    
    send = send_service.update_send(db, send, send_in)
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE",
        target_type="SEND",
        target_id=send.send_id,
        target_name=f"발송#{send.send_id}",
        details={"before": old_data, "after": send_in.model_dump(exclude_unset=True)},
        admin=current_admin,
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
    if send is None:
        raise HTTPException(status_code=404, detail="발송 정보를 찾을 수 없습니다.")
    
    old_status = send.send_status
    send = send_service.update_send_status(db, send, status_in.status)
    
    activity_log_service.create_log(
        db=db,
        action="STATUS_CHANGE",
        target_type="SEND",
        target_id=send.send_id,
        target_name=f"발송#{send.send_id}",
        details={"before": old_status, "after": status_in.status},
        admin=current_admin,
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
    if send is None:
        raise HTTPException(status_code=404, detail="발송 정보를 찾을 수 없습니다.")
    
    send = send_service.update_tracking(db, send, tracking_in.courier_company, tracking_in.tracking_no)
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE_TRACKING",
        target_type="SEND",
        target_id=send.send_id,
        target_name=f"발송#{send.send_id}",
        details={
            "courier_company": tracking_in.courier_company,
            "tracking_no": tracking_in.tracking_no
        },
        admin=current_admin,
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
    if send is None:
        raise HTTPException(status_code=404, detail="발송 정보를 찾을 수 없습니다.")
    
    if send.send_status == "CANCELLED":
        raise HTTPException(status_code=400, detail="이미 취소된 발송입니다.")
    
    old_status = send.send_status
    send = send_service.cancel_send(db, send)
    
    activity_log_service.create_log(
        db=db,
        action="CANCEL",
        target_type="SEND",
        target_id=send.send_id,
        target_name=f"발송#{send.send_id}",
        details={"before_status": old_status},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="발송이 취소되었습니다.", data=SendResponse.model_validate(send))