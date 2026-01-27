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
    SubscriptionUpdate
)
from app.schemas.common import ResponseModel
from app.services import order_service, order_item_service, activity_log_service

router = APIRouter(tags=["주문 품목"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("/orders/{order_id}/items", response_model=ResponseModel[List[OrderItemDetailResponse]])
def get_order_items(
    order_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문별 품목 목록 (휴지 정보 포함)"""
    order = order_service.get_order_by_id(db, order_id)
    
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문을 찾을 수 없습니다."
        )
    
    items = order_item_service.get_order_items_with_pauses(db, order_id)
    
    return ResponseModel(data=[OrderItemDetailResponse(**item) for item in items])


@router.get("/order-items/{order_item_id}", response_model=ResponseModel[OrderItemDetailResponse])
def get_order_item(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """품목 상세 조회 (휴지 정보 포함)"""
    item_data = order_item_service.get_order_item_with_pauses(db, order_item_id)
    
    if item_data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다."
        )
    
    return ResponseModel(data=OrderItemDetailResponse(**item_data))


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
    
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문을 찾을 수 없습니다."
        )
    
    try:
        item = order_item_service.create_order_item(db, order, item_in)
        order_service.recalculate_totals(db, order)
        
        activity_log_service.create_log(
            db=db,
            action="CREATE",
            target_type="ORDER_ITEM",
            target_id=item.order_item_id,
            target_name=item.product_name,
            details={
                "order_id": order_id,
                "product_code": item.product_code,
                "price": item.price,
                "order_num": item.order_num
            },
            admin=current_admin,
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
    item = order_item_service.get_order_item_by_id(db, order_item_id)
    
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다."
        )
    
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
        action="UPDATE",
        target_type="ORDER_ITEM",
        target_id=item.order_item_id,
        target_name=item.product_name,
        details={"before": old_data, "after": item_in.model_dump(exclude_unset=True)},
        admin=current_admin,
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
    item = order_item_service.get_order_item_by_id(db, order_item_id)
    
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다."
        )
    
    if item.cancelled_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 품목입니다."
        )
    
    product_name = item.product_name
    order_id = item.order_id
    item = order_item_service.cancel_order_item(db, item)
    
    order = order_service.get_order_by_id(db, order_id)
    order_service.recalculate_totals(db, order)
    
    activity_log_service.create_log(
        db=db,
        action="CANCEL",
        target_type="ORDER_ITEM",
        target_id=order_item_id,
        target_name=product_name,
        details={"order_id": order_id},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="주문 품목이 취소되었습니다.",
        data=OrderItemResponse.model_validate(item)
    )


@router.patch("/order-items/{order_item_id}/subscription", response_model=ResponseModel[OrderItemResponse])
def update_subscription(
    order_item_id: int,
    sub_in: SubscriptionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """구독 정보 수정"""
    item = order_item_service.get_order_item_by_id(db, order_item_id)
    
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다."
        )
    
    if item.product_kind not in ["YEARLY", "MONTHLY"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="구독 상품만 구독 정보를 수정할 수 있습니다."
        )
    
    old_data = {
        "subscribe_start_issue": item.subscribe_start_issue,
        "subscribe_end_issue": item.subscribe_end_issue
    }
    
    item = order_item_service.update_subscription(
        db, item, sub_in.subscribe_start_issue, sub_in.subscribe_end_issue
    )
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE_SUBSCRIPTION",
        target_type="ORDER_ITEM",
        target_id=item.order_item_id,
        target_name=item.product_name,
        details={
            "before": old_data,
            "after": {
                "subscribe_start_issue": sub_in.subscribe_start_issue,
                "subscribe_end_issue": sub_in.subscribe_end_issue
            }
        },
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="구독 정보가 수정되었습니다.",
        data=OrderItemResponse.model_validate(item)
    )
