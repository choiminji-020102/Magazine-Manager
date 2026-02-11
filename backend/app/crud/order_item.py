# 표준 라이브러리
from typing import Optional, List
from datetime import datetime

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.order_item import OrderItem
from app.schemas.order_item import OrderItemUpdate


def read_order_item_by_id(order_item_id: int, db: Session) -> OrderItem:
    """주문 품목 ID로 주문 품목 조회 (취소된 것 포함)"""
    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == order_item_id
    ).first()
    if not order_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다."
        )
    return order_item


def read_active_order_item_by_id(order_item_id: int, db: Session) -> OrderItem:
    """활성 주문 품목 ID로 주문 품목 조회 (취소되지 않은 주문 품목)"""
    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == order_item_id,
        OrderItem.cancelled_at.is_(None)
    ).first()
    if not order_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없거나 취소되었습니다."
        )
    return order_item


def read_order_items_by_order_id(order_id: int, db: Session, include_cancelled: bool = True) -> List[OrderItem]:
    """주문 ID로 주문 품목 목록 조회"""
    query = db.query(OrderItem).filter(OrderItem.order_id == order_id)
    if not include_cancelled:
        query = query.filter(OrderItem.cancelled_at.is_(None))
    return query.order_by(OrderItem.order_item_id.asc()).all()


def create_order_item(
    order_id: int,
    product_code: str,
    product_kind: str,
    product_name: str,
    address_id: int,
    db: Session,
    external_order_item_id: Optional[str] = None,
    price: Optional[int] = None,
    sale: Optional[int] = None,
    order_num: int = 1,
    subscribe_start_issue: Optional[str] = None,
    subscribe_end_issue: Optional[str] = None,
    subscribe_period: Optional[int] = None,
    final_subscribe_end_issue: Optional[str] = None,
    memo: Optional[str] = None
) -> OrderItem:
    """주문 품목 생성"""
    try:
        order_item = OrderItem(
            external_order_item_id=external_order_item_id,
            order_id=order_id,
            product_code=product_code,
            product_kind=product_kind,
            product_name=product_name,
            price=price,
            sale=sale,
            order_num=order_num,
            subscribe_start_issue=subscribe_start_issue,
            subscribe_end_issue=subscribe_end_issue,
            subscribe_period=subscribe_period,
            final_subscribe_end_issue=final_subscribe_end_issue,
            address_id=address_id,
            memo=memo
        )
        db.add(order_item)
        db.flush()
        return order_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"주문 품목 생성 중 오류가 발생했습니다: {str(e)}"
        )


def update_order_item(order_item: OrderItem, item_in: OrderItemUpdate, db: Session) -> OrderItem:
    """주문 품목 수정"""
    update_data = item_in.model_dump(exclude_unset=True)
    
    # address는 별도 처리 (service에서 처리)
    if "address" in update_data:
        del update_data["address"]
    
    for field, value in update_data.items():
        setattr(order_item, field, value)
    
    try:
        db.commit()
        db.refresh(order_item)
        return order_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"주문 품목 수정 중 오류가 발생했습니다: {str(e)}"
        )


def cancel_order_item(order_item: OrderItem, db: Session) -> OrderItem:
    """주문 품목 취소"""
    order_item.cancelled_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(order_item)
        return order_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"주문 품목 취소 중 오류가 발생했습니다: {str(e)}"
        )


def update_subscription(
    order_item: OrderItem,
    start_issue: str,
    end_issue: str,
    db: Session
) -> OrderItem:
    """구독 기간 업데이트"""
    order_item.subscribe_start_issue = start_issue
    order_item.subscribe_end_issue = end_issue
    
    try:
        db.commit()
        db.refresh(order_item)
        return order_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"구독 기간 업데이트 중 오류가 발생했습니다: {str(e)}"
        )


def update_last_send_issue(order_item: OrderItem, issue: str, db: Session) -> OrderItem:
    """마지막 발송 호수 업데이트"""
    order_item.last_send_issue = issue
    order_item.sended_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(order_item)
        return order_item
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"마지막 발송 호수 업데이트 중 오류가 발생했습니다: {str(e)}"
        )
