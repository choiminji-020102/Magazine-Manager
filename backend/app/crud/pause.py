# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import now_kst
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.pause import Pause
from app.schemas.pause import PauseUpdate


def read_pause_by_id(db: Session, pause_id: int) -> Pause:
    """휴지 조회 (삭제된 것 포함 — is_deleted 상태 확인은 service에서)"""
    pause = db.query(Pause).filter(Pause.pause_id == pause_id).first()
    if not pause:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="휴지를 찾을 수 없습니다.",
        )
    return pause


def read_pauses_by_order_item_id(db: Session, order_item_id: int) -> List[Pause]:
    return (
        db.query(Pause)
        .filter(
            Pause.order_item_id == order_item_id,
            Pause.deleted_at.is_(None),
        )
        .order_by(Pause.pause_issue)
        .all()
    )


def list_pauses(
    db: Session,
    page: int = 1,
    limit: int = 20,
    order_item_id: Optional[int] = None,
    pause_issue: Optional[str] = None,
    admin_id: Optional[int] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[dict], int]:
    query = (
        db.query(
            Pause,
            OrderItem.product_name,
            Customer.customer_name,
            Customer.customer_phone,
            Order.order_channel,
        )
        .join(OrderItem, Pause.order_item_id == OrderItem.order_item_id)
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(Customer, Order.customer_id == Customer.customer_id)
        .filter(Pause.deleted_at.is_(None))
    )

    if order_item_id is not None:
        query = query.filter(Pause.order_item_id == order_item_id)
    if pause_issue:
        query = query.filter(Pause.pause_issue == pause_issue)
    if admin_id is not None:
        query = query.filter(Pause.admin_id == admin_id)

    allowed_sort = {"created_at", "updated_at", "pause_issue"}
    sort_col = getattr(Pause, sort_by if sort_by in allowed_sort else "created_at")
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    total = query.count()
    rows = query.offset((page - 1) * limit).limit(limit).all()

    items = [
        {
            "pause_id": p.pause_id,
            "order_item_id": p.order_item_id,
            "pause_issue": p.pause_issue,
            "reason": p.reason,
            "admin_id": p.admin_id,
            "is_deleted": p.is_deleted,
            "created_at": p.created_at,
            "updated_at": p.updated_at,
            "deleted_at": p.deleted_at,
            "product_name": product_name,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "order_channel": order_channel,
        }
        for p, product_name, customer_name, customer_phone, order_channel in rows
    ]
    return items, total


def check_duplicate_pause(db: Session, order_item_id: int, pause_issue: str) -> bool:
    """동일 품목의 동일 호에 활성 휴지가 이미 있는지 확인"""
    return (
        db.query(Pause)
        .filter(
            Pause.order_item_id == order_item_id,
            Pause.pause_issue == pause_issue,
            Pause.deleted_at.is_(None),
        )
        .first() is not None
    )


def create_pause(
    db: Session,
    order_item_id: int,
    pause_issue: str,
    admin_id: int,
    reason: Optional[str] = None,
) -> Pause:
    pause = Pause(
        order_item_id=order_item_id,
        pause_issue=pause_issue,
        reason=reason,
        admin_id=admin_id,
    )
    db.add(pause)
    db.flush()
    return pause


def update_pause(db: Session, pause: Pause, pause_in: PauseUpdate) -> Pause:
    for field, value in pause_in.model_dump(exclude_unset=True).items():
        setattr(pause, field, value)
    db.commit()
    db.refresh(pause)
    return pause


def soft_delete_pause(db: Session, pause: Pause) -> Pause:
    pause.is_deleted = True
    pause.deleted_at = now_kst()
    db.commit()
    db.refresh(pause)
    return pause
