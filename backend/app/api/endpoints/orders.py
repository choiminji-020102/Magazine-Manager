# 표준 라이브러리
import math

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List

# 로컬 애플리케이션
from app.core.deps import require_admin
from app.db.session import get_db
from app.models.activity_log import ActivityAction, ActivityTargetType
from app.models.admin import Admin
from app.schemas import OrderDetailResponse
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.order import (
    OrderCancelRequest, OrderCreate, OrderListQuery, OrderListResponse,
    OrderPaymentUpdate, OrderResponse, OrderStatusUpdate, OrderUpdate,
)
from app.services import activity_log_service, customer_service, order_service

router = APIRouter(prefix="/orders", tags=["주문"])


@router.get("", response_model=PaginatedResponse[OrderListResponse])
def get_orders(
    query: OrderListQuery = Depends(OrderListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """주문 목록 조회"""
    items, total = order_service.get_orders(db, query)
    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=math.ceil(total / query.limit) if total > 0 else 0,
        items=[OrderListResponse(**item) for item in items],
    )


@router.get("/external/{external_order_id}", response_model=ResponseModel[OrderResponse])
def get_order_by_external_id(
    external_order_id: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """외부 주문번호로 주문 조회"""
    order = order_service.get_order_by_external_id(db, external_order_id)
    return ResponseModel(data=OrderResponse.model_validate(order))


@router.get("/customer/{customer_id}", response_model=ResponseModel[List[OrderResponse]])
def get_orders_by_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """고객별 주문 이력 조회"""
    customer_service.get_customer_by_id(db, customer_id)  # 고객 존재 여부 검증
    orders = order_service.get_orders_by_customer(db, customer_id)
    return ResponseModel(data=[OrderResponse.model_validate(o) for o in orders])


@router.get("/{order_id}", response_model=ResponseModel[OrderDetailResponse])
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """주문 상세 조회 (고객, 배송지, 품목, 발송 목록 포함)"""
    order = order_service.get_order_by_id(db, order_id)
    return ResponseModel(data=OrderDetailResponse.model_validate(order))


@router.post("", response_model=ResponseModel[OrderResponse], status_code=status.HTTP_201_CREATED)
def create_order(
    order_in: OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """주문 등록"""
    order = order_service.create_order(db, order_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.ORDER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order.order_id,
        target_name=f"주문 #{order.order_id}",
        details={
            "customer_id": order.customer_id,
            "order_channel": order.order_channel,
            "order_status": order.order_status,
            "total_amount": order.total_amount,
            "payment_amount": order.payment_amount,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="주문이 등록되었습니다.", data=OrderResponse.model_validate(order))


@router.put("/{order_id}", response_model=ResponseModel[OrderResponse])
def update_order(
    order_id: int,
    order_in: OrderUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """주문 수정 (address_id 변경 시 모든 품목 배송지 일괄 변경)"""
    order = order_service.get_order_by_id(db, order_id)
    before = {
        "address_id": order.address_id,
        "order_channel": order.order_channel,
        "discount_amount": order.discount_amount,
        "send_fee": order.send_fee,
        "payment_method": order.payment_method,
        "customer_memo": order.customer_memo,
        "admin_memo": order.admin_memo,
        "payment_at": order.payment_at.isoformat() if order.payment_at else None,
    }

    order = order_service.update_order(db, order, order_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_id,
        target_name=f"주문 #{order_id}",
        details={"before": before, "after": order_in.model_dump(exclude_unset=True, mode="json")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="주문이 수정되었습니다.", data=OrderResponse.model_validate(order))


@router.patch("/{order_id}/status", response_model=ResponseModel[OrderResponse])
def update_order_status(
    order_id: int,
    status_in: OrderStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """주문 상태 변경"""
    order = order_service.get_order_by_id(db, order_id)

    if order.order_status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="취소된 주문의 상태는 변경할 수 없습니다.",
        )
    if status_in.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="취소는 POST /{order_id}/cancel 엔드포인트를 사용해주세요.",
        )

    before_status = order.order_status
    order = order_service.update_order_status(db, order, status_in.status)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_id,
        target_name=f"주문 #{order_id}",
        details={"before": {"order_status": before_status}, "after": {"order_status": order.order_status}},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="주문 상태가 변경되었습니다.", data=OrderResponse.model_validate(order))


@router.post("/{order_id}/payment", response_model=ResponseModel[OrderResponse])
def process_payment(
    order_id: int,
    payment_in: OrderPaymentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """결제 완료 처리 (ORDERED → PAID)"""
    order = order_service.get_order_by_id(db, order_id)
    order = order_service.process_payment(db, order, payment_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_id,
        target_name=f"주문 #{order_id}",
        details={
            "order_status": "PAID",
            "payment_method": order.payment_method,
            "payment_at": order.payment_at.isoformat() if order.payment_at else None,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="결제 완료 처리되었습니다.", data=OrderResponse.model_validate(order))


@router.post("/{order_id}/cancel", response_model=ResponseModel[OrderResponse])
def cancel_order(
    order_id: int,
    cancel_request: OrderCancelRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """
    주문 취소 (관리자 전화 처리)

    - admin_memo: 취소 사유 (필수)
    - refund_amount: 환불 금액 (미입력 시 자동 계산)
    - MONTHLY 상품이 SHIPPING/DELIVERED 상태면 취소 불가
    - PREPARING/WAITING 상태인 Send만 취소 처리
    - YEARLY 배송 후: 잔여 회차 기준 환불액 계산
    """
    order = order_service.get_order_by_id(db, order_id)
    before_status = order.order_status

    order = order_service.cancel_order(db, order, cancel_request)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CANCEL,
        target_type=ActivityTargetType.ORDER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_id,
        target_name=f"주문 #{order_id}",
        details={
            "before": {"order_status": before_status},
            "after": {
                "order_status": "CANCELLED",
                "refund_amount": order.refund_amount,
                "admin_memo": cancel_request.admin_memo,
            },
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="주문이 취소되었습니다.", data=OrderResponse.model_validate(order))
