from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.models.pause import Pause
from app.models.order_item import OrderItem
from app.models.order import Order
from app.models.customer import Customer
from app.schemas.pause import PauseCreate, PauseUpdate


def get_pause_by_id(db: Session, pause_id: int) -> Optional[Pause]:
    return db.query(Pause).filter(
        Pause.pause_id == pause_id,
        Pause.deleted_at.is_(None)
    ).first()


def get_pauses_by_order_item(db: Session, order_item_id: int) -> List[Pause]:
    return db.query(Pause).filter(
        Pause.order_item_id == order_item_id,
        Pause.deleted_at.is_(None)
    ).order_by(Pause.pause_issue.asc()).all()


def get_pauses_by_issue(db: Session, issue: str) -> List[dict]:
    results = db.query(
        Pause,
        OrderItem.product_name,
        Order.customer_id,
        Customer.customer_name,
        Customer.customer_phone
    ).join(OrderItem, Pause.order_item_id == OrderItem.order_item_id)\
     .join(Order, OrderItem.order_id == Order.order_id)\
     .join(Customer, Order.customer_id == Customer.customer_id)\
     .filter(
        Pause.pause_issue == issue,
        Pause.deleted_at.is_(None)
    ).order_by(Customer.customer_name.asc()).all()
    
    pauses = []
    for pause, product_name, customer_id, customer_name, customer_phone in results:
        pause_dict = {
            **pause.__dict__,
            "product_name": product_name,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone
        }
        pauses.append(pause_dict)
    
    return pauses


def exists_for_issue(db: Session, order_item_id: int, issue: str) -> bool:
    return db.query(Pause).filter(
        Pause.order_item_id == order_item_id,
        Pause.pause_issue == issue,
        Pause.deleted_at.is_(None)
    ).count() > 0


def create_pause(db: Session, order_item_id: int, pause_in: PauseCreate, admin_id: Optional[int] = None) -> Pause:
    pause = Pause(
        order_item_id=order_item_id,
        pause_issue=pause_in.pause_issue,
        reason=pause_in.reason,
        admin_id=admin_id
    )
    db.add(pause)
    db.commit()
    db.refresh(pause)
    return pause


def update_pause(db: Session, pause: Pause, pause_in: PauseUpdate) -> Pause:
    update_data = pause_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(pause, field, value)
    
    db.commit()
    db.refresh(pause)
    return pause


def delete_pause(db: Session, pause: Pause) -> None:
    pause.deleted_at = datetime.now()
    db.commit()
