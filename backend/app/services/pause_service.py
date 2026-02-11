# 표준 라이브러리
from typing import Optional, List
from datetime import datetime

# 서드파티 라이브러리
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.pause import Pause
from app.models.order_item import OrderItem
from app.schemas.pause import PauseCreate, PauseUpdate
from app.crud import pause as pause_crud


def get_pause_by_id(db: Session, pause_id: int) -> Pause:
    """휴지 ID로 휴지 조회"""
    return pause_crud.read_pause_by_id(pause_id=pause_id, db=db)


def get_pauses_by_order_item(db: Session, order_item_id: int) -> List[Pause]:
    """주문 품목 ID로 휴지 목록 조회"""
    pauses = pause_crud.read_pauses_by_order_item_id(order_item_id=order_item_id, db=db)
    if len(pauses) == 0:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="휴지들을 찾을 수 없습니다."
        )
    return pauses


def exists_for_issue(db: Session, order_item_id: int, pause_issue: str) -> bool:
    """해당 호에 휴지가 이미 존재하는지 확인"""
    return pause_crud.check_pause_exists_for_issue(
        order_item_id=order_item_id,
        pause_issue=pause_issue,
        db=db
    )


def get_pauses_by_issue(db: Session, issue: str) -> List[dict]:
    """특정 호의 휴지 목록 (고객 정보 포함)"""
    from app.models.order import Order
    from app.models.customer import Customer
    
    results = db.query(
        Pause,
        OrderItem.product_name,
        Customer.customer_name,
        Customer.customer_phone
    ).join(
        OrderItem, Pause.order_item_id == OrderItem.order_item_id
    ).join(
        Order, OrderItem.order_id == Order.order_id
    ).join(
        Customer, Order.customer_id == Customer.customer_id
    ).filter(
        Pause.pause_issue == issue,
        Pause.deleted_at.is_(None)
    ).all()
    
    return [{
        "pause_id": p.pause_id,
        "order_item_id": p.order_item_id,
        "pause_issue": p.pause_issue,
        "reason": p.reason,
        "product_name": product_name,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "created_at": p.created_at
    } for p, product_name, customer_name, customer_phone in results]


def recalculate_final_issue(db: Session, order_item: OrderItem) -> None:
    """휴지 개수를 기반으로 final_subscribe_end_issue 재계산"""
    from app.core.utils import calculate_subscribe_end_issue
    
    if not order_item.subscribe_start_issue:
        return
    
    if order_item.product_kind not in ["YEARLY", "MONTHLY"]:
        return
    
    # 휴지 개수 조회
    pauses = pause_crud.read_pauses_by_order_item_id(
        order_item_id=order_item.order_item_id,
        db=db
    )
    pause_count = len(pauses)
    
    # 기본 구독 기간 + 휴지 개수
    period = order_item.subscribe_period or 12
    total_period = period + pause_count
    
    # final_subscribe_end_issue 계산
    order_item.final_subscribe_end_issue = calculate_subscribe_end_issue(
        order_item.subscribe_start_issue, 
        total_period
    )
    db.commit()
    db.refresh(order_item)


def create_pause(db: Session, order_item_id: int, pause_in: PauseCreate, admin_id: Optional[int] = None) -> Pause:
    """휴지 생성 + final_subscribe_end_issue 재계산"""
    # 휴지 생성
    pause = pause_crud.create_pause(
        order_item_id=order_item_id,
        pause_issue=pause_in.pause_issue,
        db=db,
        reason=pause_in.reason,
        admin_id=admin_id
    )
    
    try:
        db.commit()
        db.refresh(pause)
        
        # 해당 order_item의 final_subscribe_end_issue 재계산
        order_item = db.query(OrderItem).filter(
            OrderItem.order_item_id == order_item_id
        ).first()
        
        if order_item:
            recalculate_final_issue(db, order_item)
        
        return pause
    except Exception as e:
        db.rollback()
        raise ValueError(f"휴지 생성 중 오류가 발생했습니다: {str(e)}")


def update_pause(db: Session, pause: Pause, pause_in: PauseUpdate) -> Pause:
    """휴지 수정"""
    return pause_crud.update_pause(pause=pause, pause_in=pause_in, db=db)


def delete_pause(db: Session, pause: Pause) -> None:
    """휴지 소프트 삭제 + final_subscribe_end_issue 재계산"""
    order_item_id = pause.order_item_id
    
    # 소프트 삭제
    pause_crud.delete_pause(pause=pause, db=db)
    
    # 해당 order_item의 final_subscribe_end_issue 재계산
    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == order_item_id
    ).first()
    
    if order_item:
        recalculate_final_issue(db, order_item)
