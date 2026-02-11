# 표준 라이브러리
from typing import Optional, List
from datetime import datetime

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.order import OrderUpdate


def read_order_by_id(order_id: int, db: Session) -> Order:
    """주문 ID로 주문 조회"""
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문을 찾을 수 없습니다."
        )
    return order


def read_active_order_by_id(order_id: int, db: Session) -> Order:
    """활성 주문 ID로 주문 조회 (취소되지 않은 주문)"""
    order = db.query(Order).filter(
        Order.order_id == order_id,
        Order.cancelled_at.is_(None)
    ).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문을 찾을 수 없거나 취소되었습니다."
        )
    return order


def read_order_by_external_id(external_order_id: str, db: Session) -> Order:
    """외부 주문 ID로 주문 조회"""
    order = db.query(Order).filter(
        Order.external_order_id == external_order_id
    ).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문을 찾을 수 없습니다."
        )
    return order


def read_orders_by_customer(customer_id: int, db: Session, limit: int = 50) -> List[Order]:
    """고객 ID로 주문 목록 조회"""
    return db.query(Order).filter(
        Order.customer_id == customer_id
    ).order_by(Order.order_at.desc()).limit(limit).all()


def create_order(
    customer_id: int,
    address_id: Optional[int],
    external_order_id: Optional[str],
    order_channel: str,
    db: Session,
    discount_amount: Optional[int] = None,
    send_fee: Optional[int] = None,
    payment_method: Optional[str] = None,
    request_memo: Optional[str] = None,
    admin_memo: Optional[str] = None
) -> Order:
    """주문 생성"""
    try:
        order = Order(
            customer_id=customer_id,
            address_id=address_id,
            external_order_id=external_order_id,
            order_channel=order_channel,
            discount_amount=discount_amount,
            send_fee=send_fee,
            payment_method=payment_method,
            request_memo=request_memo,
            admin_memo=admin_memo
        )
        db.add(order)
        db.flush()
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"주문 생성 중 오류가 발생했습니다: {str(e)}"
        )


def update_order(order: Order, order_in: OrderUpdate, db: Session) -> Order:
    """주문 수정"""
    update_data = order_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)
    
    try:
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"주문 수정 중 오류가 발생했습니다: {str(e)}"
        )


def update_order_status(order: Order, status: str, db: Session) -> Order:
    """주문 상태 변경"""
    order.order_status = status
    if status == "PAID":
        order.payment_at = datetime.now()
    elif status == "CANCELLED":
        order.cancelled_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"주문 상태 변경 중 오류가 발생했습니다: {str(e)}"
        )


def cancel_order(order: Order, db: Session) -> Order:
    """주문 취소"""
    order.order_status = "CANCELLED"
    order.cancelled_at = datetime.now()
    
    # 주문 품목도 취소
    items = db.query(OrderItem).filter(
        OrderItem.order_id == order.order_id,
        OrderItem.cancelled_at.is_(None)
    ).all()
    for item in items:
        item.cancelled_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"주문 취소 중 오류가 발생했습니다: {str(e)}"
        )


def read_order_items_by_order_id(order_id: int, db: Session, include_cancelled: bool = False) -> List[OrderItem]:
    """주문 ID로 주문 품목 목록 조회"""
    query = db.query(OrderItem).filter(OrderItem.order_id == order_id)
    if not include_cancelled:
        query = query.filter(OrderItem.cancelled_at.is_(None))
    return query.all()
