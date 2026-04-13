# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import now_kst
from app.models.order import Order
from app.models.customer import Customer
from app.models.order_item import OrderItem
from app.models.address import Address
from app.schemas.order_item import OrderItemUpdate


def read_order_item_by_id(db: Session, order_item_id: int) -> OrderItem:
    order_item = db.query(OrderItem).filter(OrderItem.order_item_id == order_item_id).first()
    if not order_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다.",
        )
    return order_item


def read_active_order_item_by_id(db: Session, order_item_id: int) -> OrderItem:
    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == order_item_id,
        OrderItem.cancelled_at.is_(None),
    ).first()
    if not order_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없거나 취소되었습니다.",
        )
    return order_item


def read_order_items_by_order_id(
    db: Session, order_id: int, include_cancelled: bool = True
) -> List[OrderItem]:
    query = db.query(OrderItem).filter(OrderItem.order_id == order_id)
    if not include_cancelled:
        query = query.filter(OrderItem.cancelled_at.is_(None))
    return query.order_by(OrderItem.order_item_id.asc()).all()


def create_order_item(
    db: Session,
    order_id: int,
    address_id: int,
    product_code: str,
    product_kind: str,
    product_name: str,
    list_price: int,
    sale_price: int,
    subscribe_start_issue: str,
    subscribe_end_issue: str,
    final_subscribe_start_issue: str,
    final_subscribe_end_issue: str,
    subscribe_period: int,
    order_num: int = 1,
    refund_amount: int = 0,
    admin_memo: Optional[str] = None,
    external_order_item_id: Optional[str] = None,
) -> OrderItem:
    order_item = OrderItem(
        order_id=order_id,
        address_id=address_id,
        product_code=product_code,
        product_kind=product_kind,
        product_name=product_name,
        list_price=list_price,
        sale_price=sale_price,
        refund_amount=refund_amount,
        order_num=order_num,
        subscribe_start_issue=subscribe_start_issue,
        subscribe_end_issue=subscribe_end_issue,
        final_subscribe_start_issue=final_subscribe_start_issue,
        final_subscribe_end_issue=final_subscribe_end_issue,
        subscribe_period=subscribe_period,
        admin_memo=admin_memo,
        external_order_item_id=external_order_item_id,
    )
    db.add(order_item)
    db.flush()
    return order_item


def update_order_item(db: Session, order_item: OrderItem, order_item_in: OrderItemUpdate) -> OrderItem:
    for field, value in order_item_in.model_dump(exclude_unset=True).items():
        setattr(order_item, field, value)
    db.commit()
    db.refresh(order_item)
    return order_item


def update_address(db: Session, order_item: OrderItem, address_id: int) -> OrderItem:
    order_item.address_id = address_id
    db.commit()
    db.refresh(order_item)
    return order_item


def extend_subscription(
    db: Session, order_item: OrderItem, new_end_issue: str,
    extend_months: int = 0, update_paid: bool = False,
) -> OrderItem:
    """구독 기간 연장
    - extend_months: subscribe_period에 더할 개월 수
    - update_paid=False: 무상 연장 — final_subscribe_end_issue만 변경
    - update_paid=True:  유료 연장 — final_subscribe_end_issue + subscribe_period 갱신
    """
    order_item.final_subscribe_end_issue = new_end_issue
    if extend_months > 0:
        order_item.subscribe_period += extend_months
    db.commit()
    db.refresh(order_item)
    return order_item


def change_period(
    db: Session, order_item: OrderItem, new_start_issue: str, new_end_issue: str
) -> OrderItem:
    """구독 기간 이동 — final_subscribe_start_issue + final_subscribe_end_issue 재계산"""
    order_item.final_subscribe_start_issue = new_start_issue
    order_item.final_subscribe_end_issue = new_end_issue
    db.commit()
    db.refresh(order_item)
    return order_item


def shorten_subscription(
    db: Session, order_item: OrderItem, shorten_end_issue: str, refund_amount: int
) -> OrderItem:
    """구독 기간 단축 — final_subscribe_end_issue + refund_amount 누적"""
    order_item.final_subscribe_end_issue = shorten_end_issue
    order_item.refund_amount = (order_item.refund_amount or 0) + refund_amount
    db.commit()
    db.refresh(order_item)
    return order_item


def cancel_order_item(db: Session, order_item: OrderItem) -> OrderItem:
    order_item.cancelled_at = now_kst()
    db.commit()
    db.refresh(order_item)
    return order_item


def update_last_send_issue(db: Session, order_item: OrderItem, issue: str) -> OrderItem:
    order_item.last_send_issue = issue
    order_item.sended_at = now_kst()
    db.commit()
    db.refresh(order_item)
    return order_item


def list_order_items(
    db: Session,
    page: int = 1,
    limit: int = 20,
    product_kind: Optional[str] = None,
    product_code: Optional[str] = None,
    customer_search: Optional[str] = None,
    is_cancelled: Optional[bool] = None,
    end_issue_from: Optional[str] = None,
    end_issue_to: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List, int]:
    """구독 목록 조회 — Customer/Order 조인 포함, 결제 완료(PAID)만"""
    query = (
        db.query(OrderItem, Customer.customer_name, Customer.customer_phone, Order.order_channel)
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(Customer, Order.customer_id == Customer.customer_id)
        .filter(Order.order_status == "PAID")
    )

    if product_kind:
        query = query.filter(OrderItem.product_kind == product_kind)
    if product_code:
        query = query.filter(OrderItem.product_code == product_code)
    if customer_search:
        query = query.filter(
            or_(
                Customer.customer_name.ilike(f"%{customer_search}%"),
                Customer.customer_phone.ilike(f"%{customer_search}%"),
            )
        )
    if is_cancelled is True:
        query = query.filter(OrderItem.cancelled_at.isnot(None))
    elif is_cancelled is False:
        query = query.filter(OrderItem.cancelled_at.is_(None))
    # is_cancelled is None → 전체

    if end_issue_from:
        query = query.filter(OrderItem.final_subscribe_end_issue >= end_issue_from)
    if end_issue_to:
        query = query.filter(OrderItem.final_subscribe_end_issue <= end_issue_to)

    allowed_sort = {"created_at", "subscribe_start_issue", "final_subscribe_end_issue", "updated_at"}
    sort_col = getattr(OrderItem, sort_by if sort_by in allowed_sort else "created_at")
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    total = query.count()
    offset = (page - 1) * limit
    rows = query.offset(offset).limit(limit).all()
    return rows, total


def list_by_postal_code_13113(
    db: Session,
    page: int = 1,
    limit: int = 20,
    product_kind: Optional[str] = None,
    is_cancelled: bool = False,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[OrderItem], int]:
    query = (
        db.query(OrderItem)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(Address.postal_code == "13113")
    )
    if product_kind:
        query = query.filter(OrderItem.product_kind == product_kind)
    if is_cancelled:
        query = query.filter(OrderItem.cancelled_at.isnot(None))
    else:
        query = query.filter(OrderItem.cancelled_at.is_(None))

    allowed_sort = {"created_at", "subscribe_start_issue", "updated_at"}
    sort_col = getattr(OrderItem, sort_by if sort_by in allowed_sort else "created_at")
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()
    return items, total
