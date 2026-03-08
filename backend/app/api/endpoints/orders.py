from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.order import (
    OrderListQuery, OrderCreate, OrderUpdate, OrderResponse,
    OrderListResponse, OrderStatusUpdate
)
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import order_service, customer_service, activity_log_service

router = APIRouter(prefix="/orders", tags=["주문"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])

def build_order_detail_response(order) -> OrderResponse:
    return OrderResponse(
        order_id=order.order_id,
        customer_id=order.customer_id,
        external_order_id=order.external_order_id,
        order_channel=order.order_channel,
        order_status=order.order_status,
        total_amount=order.total_amount,
        discount_amount=order.discount_amount,
        refund_amount=order.refund_amount,
        send_fee=order.send_fee,
        payment_amount=order.payment_amount,
        payment_method=order.payment_method,
        address_id=order.address_id,
        request_memo=order.request_memo,
        admin_memo=order.admin_memo,
        order_at=order.order_at,
        payment_at=order.payment_at,
        cancelled_at=order.cancelled_at,
        created_at=order.created_at,
        updated_at=order.updated_at
    )


@router.get("", response_model=PaginatedResponse[OrderListResponse])
def get_orders(
    query: OrderListQuery = Depends(OrderListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문 목록 조회"""
    items, total = order_service.get_orders(
        db, query.page, query.limit, query.search, query.channel, query.order_status, query.start_date, query.end_date
    )
    
    return PaginatedResponse(
        message="주문 목록을 조회했습니다.",
        data=[OrderListResponse(**item) for item in items],
        pagination=PaginationMeta(
            total=total,
            page=query.page,
            limit=query.limit,
            total_pages=math.ceil(total / query.limit) if total > 0 else 0
        )
    )


@router.get("/external/{external_order_id}", response_model=ResponseModel[OrderResponse])
def get_order_by_external_id(
    external_order_id: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """외부 주문번호로 주문 조회"""
    order = order_service.get_order_by_external_id(db, external_order_id)
    
    return ResponseModel(
        message="주문 정보를 조회했습니다.",
        data=build_order_detail_response(order)
    )


@router.get("/{order_id}", response_model=ResponseModel[OrderResponse])
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문 상세 조회"""
    order = order_service.get_order_by_id(db, order_id)
    
    return ResponseModel(
        message="주문 정보를 조회했습니다.",
        data=build_order_detail_response(order)
    )


@router.post("", response_model=ResponseModel[OrderResponse], status_code=status.HTTP_201_CREATED)
def create_order(
    order_in: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문 등록"""
    # customer_id가 있으면 고객 존재 확인
    if order_in.customer_id:
        customer = customer_service.get_customer_by_id(db, order_in.customer_id)
        if customer is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="고객을 찾을 수 없습니다."
            )
    elif not order_in.customer:
        # customer_id도 없고 customer 정보도 없으면 에러
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="고객 정보가 필요합니다. customer_id 또는 customer 정보를 입력해주세요."
        )
    
    if not order_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="주문 상품을 추가해주세요."
        )
    
    try:
        order = order_service.create_order(db, order_in)
        items = list(order.items)
        
        # 고객 정보 조회 (activity_log용)
        customer = customer_service.get_customer_by_id(db, order.customer_id)
        
        activity_log_service.create_log(
            db=db,
            admin=current_admin,
            action=ActivityAction.CREATE,
            target_type=ActivityTargetType.ORDER,
            target_id=order.order_id,
            details={
                "reason": "주문 등록 성공",
                "customer_id": order.customer_id,
                "customer_name": customer.customer_name if customer else None,
                "channel": order.order_channel,
                "total_amount": order.total_amount,
                "item_count": len(items)
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return ResponseModel(
            message="주문이 등록되었습니다.",
            data=build_order_detail_response(order)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/{order_id}", response_model=ResponseModel[OrderResponse])
def update_order(
    order_id: int,
    order_in: OrderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문 수정"""
    order = order_service.get_order_by_id(db, order_id)
    
    old_data = {
        "order_status": order.order_status,
        "discount_amount": order.discount_amount,
        "send_fee": order.send_fee
    }
    
    order = order_service.update_order(db, order, order_in)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER,
        target_id=order_id,
        details={"reason": "주문 수정 성공", "before": old_data, "after": order_in.model_dump(exclude_unset=True)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="주문 정보가 수정되었습니다.",
        data=OrderResponse.model_validate(order)
    )


@router.patch("/{order_id}/status", response_model=ResponseModel[OrderResponse])
def update_order_status(
    order_id: int,
    status_in: OrderStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문 상태 변경"""
    order = order_service.get_order_by_id(db, order_id)
    old_status = order.order_status
    order = order_service.update_order_status(db, order, status_in.status)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER,
        target_id=order_id,
        details={"reason": "주문 상태 변경 성공", "before": old_status, "after": status_in.status},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="주문 상태가 변경되었습니다.",
        data=OrderResponse.model_validate(order)
    )


@router.patch("/{order_id}/cancel", response_model=ResponseModel[OrderResponse])
def cancel_order(
    order_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문 취소"""
    order = order_service.get_order_by_id(db, order_id)
    
    if order.order_status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 주문입니다."
        )
    
    old_status = order.order_status
    order = order_service.cancel_order(db, order)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.CANCEL,
        target_type=ActivityTargetType.ORDER,
        target_id=order_id,
        details={"reason": "주문 취소 성공", "before": old_status, "after": order.order_status},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="주문이 취소되었습니다.",
        data=OrderResponse.model_validate(order)
    )


@router.get("/customer/{customer_id}", response_model=ResponseModel[List[OrderResponse]])
def get_orders_by_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객별 주문 이력 조회"""
    _ = customer_service.get_customer_by_id(db, customer_id)  # 고객 존재 여부 검증용
    orders = order_service.get_orders_by_customer(db, customer_id)
    return ResponseModel(
        message="고객별 주문 이력을 조회했습니다.",
        data=[OrderResponse.model_validate(order) for order in orders]
    )