from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.inquiry import (
    InquiryCreate, InquiryUpdate, InquiryAnswer, InquiryResponse,
    InquiryListResponse, InquiryDetailResponse,
    CustomerQuickSearchResponse, CustomerInquiryHistoryResponse
)
from app.schemas.common import ResponseModel, PaginatedResponse
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import inquiry_service, customer_service, activity_log_service

router = APIRouter(prefix="/inquiries", tags=["문의"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


# 전화번호 뒤4자리로 고객 빠른 검색
@router.get("/search/phone4/{phone_num4}", response_model=ResponseModel[List[CustomerQuickSearchResponse]])
def search_by_phone4(
    phone_num4: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """전화번호 뒤4자리로 고객 검색"""
    if len(phone_num4) != 4 or not phone_num4.isdigit():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="전화번호 뒤 4자리를 입력해주세요."
        )
    
    customers = inquiry_service.search_customers_by_phone4(db, phone_num4)
    
    return ResponseModel(
        data=[CustomerQuickSearchResponse.model_validate(c) for c in customers]
    )


# 고객 문의 이력 조회 (주문 + 문의 내역)
@router.get("/customer/{customer_id}/history", response_model=ResponseModel[CustomerInquiryHistoryResponse])
def get_customer_history(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 문의 이력 조회 (주문내역 + 문의내역)"""
    result = inquiry_service.get_customer_inquiry_history(db, customer_id)
    
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다."
        )
    
    return ResponseModel(data=CustomerInquiryHistoryResponse(
        customer=CustomerQuickSearchResponse.model_validate(result["customer"]),
        orders_count=result["orders_count"],
        inquiries_count=result["inquiries_count"],
        recent_orders=result["recent_orders"],
        recent_inquiries=[InquiryResponse.model_validate(i) for i in result["recent_inquiries"]]
    ))


# 문의 목록 조회
@router.get("", response_model=PaginatedResponse[InquiryListResponse])
def get_inquiries(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    customer_id: Optional[int] = None,
    inquiry_type: Optional[str] = None,
    inquiry_status: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """문의 목록 조회"""
    items, total = inquiry_service.get_inquiries(
        db, page, limit, customer_id, inquiry_type, inquiry_status, search, start_date, end_date
    )
    
    return PaginatedResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if total > 0 else 0,
        items=[InquiryListResponse(**item) for item in items],
    )


# 문의 상세 조회
@router.get("/{inquiry_id}", response_model=ResponseModel[InquiryDetailResponse])
def get_inquiry(
    inquiry_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """문의 상세 조회"""
    inquiry = inquiry_service.get_inquiry_by_id(db, inquiry_id)
    
    if inquiry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="문의를 찾을 수 없습니다."
        )
    
    # 고객 정보
    customer = customer_service.get_customer_by_id(db, inquiry.customer_id)
    
    # 담당자 정보
    handler_name = None
    if inquiry.handled_by:
        from app.services import admin_service
        handler = admin_service.get_admin_by_id(db, inquiry.handled_by)
        if handler:
            handler_name = handler.admin_name

    # 연결된 주문 스냅샷 (식별용)
    order_channel = None
    order_status = None
    order_payment_amount = None
    order_at = None
    if inquiry.order_id:
        from app.services import order_service
        order = order_service.get_order_by_id(db, inquiry.order_id)
        if order:
            order_channel = order.order_channel
            order_status = order.order_status
            order_payment_amount = order.payment_amount
            order_at = order.order_at

    # 연결된 주문품목 품목명
    order_item_product_name = None
    if inquiry.order_item_id:
        from app.services import order_item_service
        order_item = order_item_service.get_order_item_by_id(db, inquiry.order_item_id)
        if order_item:
            order_item_product_name = order_item.product_name

    return ResponseModel(data=InquiryDetailResponse(
        **inquiry.__dict__,
        customer_name=customer.customer_name if customer else None,
        customer_phone=customer.customer_phone if customer else None,
        handler_name=handler_name,
        order_channel=order_channel,
        order_status=order_status,
        order_payment_amount=order_payment_amount,
        order_at=order_at,
        order_item_product_name=order_item_product_name
    ))


# 문의 등록
@router.post("", response_model=ResponseModel[InquiryResponse], status_code=status.HTTP_201_CREATED)
def create_inquiry(
    inquiry_in: InquiryCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """문의 등록"""
    customer = customer_service.get_customer_by_id(db, inquiry_in.customer_id)
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="고객을 찾을 수 없습니다."
        )
    
    inquiry = inquiry_service.create_inquiry(db, inquiry_in)
    
    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.INQUIRY,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=inquiry.inquiry_id,
        target_name=customer.customer_name,
        details={
            "customer_id": inquiry.customer_id,
            "inquiry_type": inquiry.inquiry_type,
            "inquiry_category": inquiry.inquiry_category,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return ResponseModel(
        message="문의가 등록되었습니다.",
        data=InquiryResponse.model_validate(inquiry)
    )


# 문의 수정
@router.put("/{inquiry_id}", response_model=ResponseModel[InquiryResponse])
def update_inquiry(
    inquiry_id: int,
    inquiry_in: InquiryUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """문의 수정"""
    inquiry = inquiry_service.get_inquiry_by_id(db, inquiry_id)
    
    if inquiry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="문의를 찾을 수 없습니다."
        )
    
    old_data = {
        "inquiry_type": inquiry.inquiry_type,
        "inquiry_category": inquiry.inquiry_category,
        "inquiry_status": inquiry.inquiry_status
    }
    
    inquiry = inquiry_service.update_inquiry(db, inquiry, inquiry_in, admin_id=current_admin.admin_id)
    
    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.INQUIRY,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=inquiry_id,
        target_name=inquiry.inquiry_category,
        details={"before": old_data, "after": inquiry_in.model_dump(exclude_unset=True)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return ResponseModel(
        message="문의가 수정되었습니다.",
        data=InquiryResponse.model_validate(inquiry)
    )


# 문의 답변
@router.patch("/{inquiry_id}/answer", response_model=ResponseModel[InquiryResponse])
def answer_inquiry(
    inquiry_id: int,
    answer_in: InquiryAnswer,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """문의 답변"""
    inquiry = inquiry_service.get_inquiry_by_id(db, inquiry_id)
    
    if inquiry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="문의를 찾을 수 없습니다."
        )
    
    inquiry = inquiry_service.answer_inquiry(
        db, inquiry, answer_in.answer, answer_in.inquiry_status, current_admin.admin_id
    )
    
    activity_log_service.create_log(
        db=db,
        action=ActivityAction.ANSWER,
        target_type=ActivityTargetType.INQUIRY,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=inquiry_id,
        target_name=inquiry.inquiry_category,
        details={"inquiry_status": answer_in.inquiry_status},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return ResponseModel(
        message="답변이 등록되었습니다.",
        data=InquiryResponse.model_validate(inquiry)
    )


# 문의 삭제
@router.delete("/{inquiry_id}", response_model=ResponseModel)
def delete_inquiry(
    inquiry_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """문의 삭제"""
    inquiry = inquiry_service.get_inquiry_by_id(db, inquiry_id)
    
    if inquiry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="문의를 찾을 수 없습니다."
        )
    
    customer_id = inquiry.customer_id
    inquiry_service.delete_inquiry(db, inquiry)
    
    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.INQUIRY,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=inquiry_id,
        target_name=None,
        details={"customer_id": customer_id},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    
    return ResponseModel(message="문의가 삭제되었습니다.")


# 고객별 문의 목록
@router.get("/customer/{customer_id}", response_model=ResponseModel[List[InquiryResponse]])
def get_customer_inquiries(
    customer_id: int,
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객별 문의 목록"""
    customer = customer_service.get_customer_by_id(db, customer_id, include_deleted=True)
    
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다."
        )
    
    inquiries = inquiry_service.get_inquiries_by_customer(db, customer_id, limit)
    
    return ResponseModel(data=[InquiryResponse.model_validate(i) for i in inquiries])