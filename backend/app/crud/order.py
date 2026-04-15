# 표준 라이브러리
from datetime import datetime
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import now_kst
from app.models.address import Address
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.schemas.order import OrderListResponse, OrderUpdate


def list_orders(
    db: Session,
    page: int = 1,
    limit: int = 20,
    customer_search: Optional[str] = None,
    recipient_search: Optional[str] = None,
    external_order_id: Optional[str] = None,
    order_channel: Optional[str] = None,
    order_status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    payment_method: Optional[str] = None,
    admin_memo: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[OrderListResponse], int]:
    """주문 목록 조회 (고객·배송지 정보 JOIN 포함)"""
    from app.core.utils import format_phone_number

    query = (
        db.query(Order, Customer.customer_name, Customer.customer_phone)
        .join(Customer, Order.customer_id == Customer.customer_id)
        .outerjoin(Address, Order.address_id == Address.address_id)
    )

    # ── 주문자 검색 (이름 또는 연락처 뒤 4자리) ─────────────────────────────────
    if customer_search:
        q = customer_search.strip()
        if q.isdigit():
            query = query.filter(Customer.customer_phone.like(f"%{q}%"))
        else:
            query = query.filter(Customer.customer_name.like(f"%{q}%"))

    # ── 수령인 검색 (이름 또는 연락처 뒤 4자리) ─────────────────────────────────
    if recipient_search:
        q = recipient_search.strip()
        if q.isdigit():
            query = query.filter(Address.recipient_phone.like(f"%{q}%"))
        else:
            query = query.filter(Address.recipient_name.like(f"%{q}%"))

    # ── 기타 필터 ─────────────────────────────────────────────────────────────
    if external_order_id:
        query = query.filter(Order.external_order_id.like(f"%{external_order_id}%"))
    if order_channel:
        query = query.filter(Order.order_channel == order_channel)
    if order_status:
        query = query.filter(Order.order_status == order_status)
    if start_date:
        query = query.filter(Order.order_at >= start_date)
    if end_date:
        query = query.filter(Order.order_at <= f"{end_date} 23:59:59")
    if payment_method:
        query = query.filter(Order.payment_method == payment_method)
    if admin_memo:
        query = query.filter(Order.admin_memo.like(f"%{admin_memo}%"))

    # ── 정렬: 허용된 컬럼만 사용 (SQL 인젝션 방지) ────────────────────────────
    allowed_sort = {"order_at", "created_at", "payment_at", "updated_at"}
    sort_col = getattr(Order, sort_by if sort_by in allowed_sort else "created_at")
    query = query.order_by(sort_col.asc() if sort_order == "asc" else sort_col.desc())

    total = query.count()
    offset = (page - 1) * limit
    results = query.offset(offset).limit(limit).all()

    items = []
    for order, customer_name, customer_phone in results:
        item_count = db.query(OrderItem).filter(
            OrderItem.order_id == order.order_id,
            OrderItem.cancelled_at.is_(None),
        ).count()
        items.append(OrderListResponse(
            order_id=order.order_id,
            customer_id=order.customer_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            external_order_id=order.external_order_id,
            address_id=order.address_id,
            order_channel=order.order_channel,
            order_status=order.order_status,
            total_amount=order.total_amount,
            discount_amount=order.discount_amount,
            refund_amount=order.refund_amount,
            send_fee=order.send_fee,
            payment_amount=order.payment_amount,
            payment_method=order.payment_method,
            order_at=order.order_at,
            payment_at=order.payment_at,
            cancelled_at=order.cancelled_at,
            item_count=item_count,
        ))
    return items, total


def read_order_by_id(db: Session, order_id: int) -> Order:
    order = db.query(Order).filter(Order.order_id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문을 찾을 수 없습니다.",
        )
    return order


def read_order_by_external_id(db: Session, external_order_id: str) -> Order:
    order = db.query(Order).filter(Order.external_order_id == external_order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 외부 주문번호의 주문을 찾을 수 없습니다.",
        )
    return order


def read_orders_by_customer(db: Session, customer_id: int, limit: int = 50) -> List[Order]:
    return (
        db.query(Order)
        .filter(Order.customer_id == customer_id)
        .order_by(Order.order_at.desc())
        .limit(limit)
        .all()
    )


def read_order_items_by_order_id(
    db: Session, order_id: int, include_cancelled: bool = False
) -> List[OrderItem]:
    query = db.query(OrderItem).filter(OrderItem.order_id == order_id)
    if not include_cancelled:
        query = query.filter(OrderItem.cancelled_at.is_(None))
    return query.all()


def check_external_order_id_duplicate(
    db: Session, external_order_id: str, exclude_order_id: Optional[int] = None
) -> None:
    """외부 주문번호 중복 검증 — 중복이면 400 에러"""
    query = db.query(Order).filter(Order.external_order_id == external_order_id)
    if exclude_order_id:
        query = query.filter(Order.order_id != exclude_order_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"외부 주문번호 '{external_order_id}'이(가) 이미 존재합니다.",
        )


def create_order(
    db: Session,
    customer_id: int,
    address_id: int,
    order_channel: str,
    order_status: str,
    total_amount: int,
    payment_amount: int,
    external_order_id: Optional[str] = None,
    discount_amount: int = 0,
    send_fee: int = 0,
    payment_method: Optional[str] = None,
    customer_memo: Optional[str] = None,
    admin_memo: Optional[str] = None,
    order_at: Optional[datetime] = None,
    payment_at: Optional[datetime] = None,
) -> Order:
    order = Order(
        customer_id=customer_id,
        address_id=address_id,
        external_order_id=external_order_id,
        order_channel=order_channel,
        order_status=order_status,
        total_amount=total_amount,
        payment_amount=payment_amount,
        discount_amount=discount_amount,
        send_fee=send_fee,
        payment_method=payment_method,
        customer_memo=customer_memo,
        admin_memo=admin_memo,
        payment_at=payment_at,
    )
    if order_at:
        order.order_at = order_at
    db.add(order)
    db.flush()   # order_id 확보 (commit 전)
    return order


def update_order(db: Session, order: Order, order_in: OrderUpdate) -> Order:
    for field, value in order_in.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


def bulk_update_items_address(db: Session, order_id: int, address_id: int) -> None:
    """주문 내 모든 미취소 품목의 배송지를 일괄 변경"""
    db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.cancelled_at.is_(None),
    ).update({"address_id": address_id}, synchronize_session=False)


def set_order_status(
    db: Session,
    order: Order,
    order_status: str,
    payment_at: Optional[datetime] = None,
    cancelled_at: Optional[datetime] = None,
    refund_amount: Optional[int] = None,
) -> Order:
    """주문 상태 변경 + 관련 타임스탬프/금액 설정"""
    order.order_status = order_status
    if payment_at is not None:
        order.payment_at = payment_at
    if cancelled_at is not None:
        order.cancelled_at = cancelled_at
    if refund_amount is not None:
        order.refund_amount = refund_amount
    db.commit()
    db.refresh(order)
    return order

