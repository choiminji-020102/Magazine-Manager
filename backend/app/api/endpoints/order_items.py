from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.order_item import (
    OrderItemCreate,
    OrderItemUpdate,
    OrderItemResponse,
    OrderItemDetailResponse,
)
from app.schemas.common import ResponseModel
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import order_service, order_item_service, activity_log_service

router = APIRouter(tags=["주문 품목"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("/orders/{order_id}/items", response_model=ResponseModel[List[OrderItemDetailResponse]])
def get_items_by_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문별 품목 목록 (휴지 정보 포함)"""
    order_service.get_order_by_id(db, order_id)  # 주문 존재 여부 검증
    items = order_item_service.get_order_items_with_pauses(db, order_id)
    
    return ResponseModel(
        message="주문별 품목 목록을 조회했습니다.",
        data=[OrderItemDetailResponse(**item) for item in items]
    )


@router.get("/order-items/{order_item_id}", response_model=ResponseModel[OrderItemDetailResponse])
def get_order_item(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """품목 상세 조회 (휴지 정보 포함)"""
    item_data = order_item_service.get_order_item_with_pauses(db, order_item_id)
    
    return ResponseModel(
        message="주문 품목 정보를 조회했습니다.",
        data=OrderItemDetailResponse(**item_data)
    )


@router.post("/orders/{order_id}/items", response_model=ResponseModel[OrderItemResponse], status_code=status.HTTP_201_CREATED)
def create_order_item(
    order_id: int,
    item_in: OrderItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """품목 추가"""
    order = order_service.get_order_by_id(db, order_id)
    
    try:
        item = order_item_service.create_order_item(db, order, item_in)
        order_service.recalculate_totals(db, order)
        
        activity_log_service.create_log(
            db=db,
            admin=current_admin,
            action=ActivityAction.CREATE,
            target_type=ActivityTargetType.ORDER_ITEM,
            target_id=item.order_item_id,
            details={
                "reason": "주문 품목 추가 성공",
                "order_id": order_id,
                "product_code": item.product_code,
                "price": item.price,
                "order_num": item.order_num
            },
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return ResponseModel(
            message="주문 품목이 추가되었습니다.",
            data=OrderItemResponse.model_validate(item)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.put("/order-items/{order_item_id}", response_model=ResponseModel[OrderItemResponse])
def update_order_item(
    order_item_id: int,
    item_in: OrderItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """품목 수정"""
    item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    
    old_data = {
        "price": item.price,
        "sale": item.sale,
        "order_num": item.order_num
    }
    
    item = order_item_service.update_order_item(db, item, item_in)
    
    if item_in.price is not None or item_in.sale is not None or item_in.order_num is not None:
        order = order_service.get_order_by_id(db, item.order_id)
        order_service.recalculate_totals(db, order)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ORDER_ITEM,
        target_id=order_item_id,
        details={
            "reason": "주문 품목 수정 성공", 
            "before": old_data, 
            "after": item_in.model_dump(exclude_unset=True)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="주문 품목이 수정되었습니다.",
        data=OrderItemResponse.model_validate(item)
    )


@router.patch("/order-items/{order_item_id}/cancel", response_model=ResponseModel[OrderItemResponse])
def cancel_order_item(
    order_item_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """품목 취소"""
    item = order_item_service.get_active_order_item_by_id(db, order_item_id)
    order_id = item.order_id
    
    item = order_item_service.cancel_order_item(db, item)
    
    # 주문 총액 재계산
    order = order_service.get_active_order_by_id(db, order_id)
    order_service.recalculate_totals(db, order)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.CANCEL,
        target_type=ActivityTargetType.ORDER_ITEM,
        target_id=order_item_id,
        details={"reason": "주문 품목 취소 성공", "order_id": order_id},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="주문 품목이 취소되었습니다.",
        data=OrderItemResponse.model_validate(item)
    )


# TODO: order_items 도메인 전면 수정 시 /extend, /address, /change-period 엔드포인트 추가
