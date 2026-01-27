from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.models.pause import Pause
from app.models.order_item import OrderItem
from app.schemas.pause import PauseCreate, PauseUpdate


def get_pause_by_id(db: Session, pause_id: int) -> Optional[Pause]:
    return db.query(Pause).filter(
        Pause.pause_id == pause_id,
        Pause.deleted_at == None
    ).first()


def get_pauses_by_order_item(db: Session, order_item_id: int) -> List[Pause]:
    return db.query(Pause).filter(
        Pause.order_item_id == order_item_id,
        Pause.deleted_at == None
    ).order_by(Pause.pause_issue).all()


def exists_for_issue(db: Session, order_item_id: int, pause_issue: str) -> bool:
    """해당 호에 휴지가 이미 존재하는지 확인"""
    return db.query(Pause).filter(
        Pause.order_item_id == order_item_id,
        Pause.pause_issue == pause_issue,
        Pause.deleted_at == None
    ).first() is not None


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
        Pause.deleted_at == None
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
    pause_count = db.query(Pause).filter(
        Pause.order_item_id == order_item.order_item_id,
        Pause.deleted_at == None
    ).count()
    
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


def create_pause(db: Session, order_item_id: int, pause_in: PauseCreate, admin_id: int = None) -> Pause:
    """휴지 생성 + final_subscribe_end_issue 재계산"""
    pause = Pause(
        order_item_id=order_item_id,
        pause_issue=pause_in.pause_issue,
        reason=pause_in.reason,
        admin_id=admin_id
    )
    db.add(pause)
    db.commit()
    db.refresh(pause)
    
    # 해당 order_item의 final_subscribe_end_issue 재계산
    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == order_item_id
    ).first()
    
    if order_item:
        recalculate_final_issue(db, order_item)
    
    return pause


def update_pause(db: Session, pause: Pause, pause_in: PauseUpdate) -> Pause:
    update_data = pause_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(pause, field, value)
    
    db.commit()
    db.refresh(pause)
    return pause


def delete_pause(db: Session, pause: Pause) -> None:
    """소프트 삭제 + final_subscribe_end_issue 재계산"""
    order_item_id = pause.order_item_id
    
    # 소프트 삭제
    pause.deleted_at = datetime.now()
    db.commit()
    
    # 해당 order_item의 final_subscribe_end_issue 재계산
    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == order_item_id
    ).first()
    
    if order_item:
        recalculate_final_issue(db, order_item)
