from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, case
from typing import Optional, List
from datetime import datetime

from app.models.order_item import OrderItem
from app.models.order import Order
from app.models.product import Product
from app.models.address import Address
from app.models.pause import Pause
from app.models.customer import Customer
from app.schemas.order_item import OrderItemCreate, OrderItemUpdate
from app.services import address_service


def get_order_item_by_id(db: Session, order_item_id: int) -> Optional[OrderItem]:
    return db.query(OrderItem).filter(OrderItem.order_item_id == order_item_id).first()


def get_order_items_by_order(db: Session, order_id: int) -> List[OrderItem]:
    return db.query(OrderItem).filter(
        OrderItem.order_id == order_id
    ).order_by(OrderItem.order_item_id.asc()).all()


def get_active_order_items_by_order(db: Session, order_id: int) -> List[OrderItem]:
    return db.query(OrderItem).filter(
        OrderItem.order_id == order_id,
        OrderItem.cancelled_at.is_(None)
    ).order_by(OrderItem.order_item_id.asc()).all()


def create_order_item(db: Session, order: Order, item_in: OrderItemCreate) -> OrderItem:
    product = db.query(Product).filter(Product.product_code == item_in.product_code).first()
    if not product:
        raise ValueError(f"상품을 찾을 수 없습니다: {item_in.product_code}")
    
    # Address
    address_id = order.address_id
    if item_in.address:
        address = address_service.find_or_create_address(db, item_in.address)
        address_id = address.address_id
    elif item_in.address_id:
        address_id = item_in.address_id
    
    order_item = OrderItem(
        external_order_item_id=item_in.external_order_item_id,
        order_id=order.order_id,
        product_code=product.product_code,
        product_kind=product.product_kind,
        product_name=product.product_name,
        price=item_in.price if item_in.price is not None else product.price,
        sale=item_in.sale if item_in.sale is not None else product.sale,
        order_num=item_in.order_num or 1,
        subscribe_start_issue=item_in.subscribe_start_issue,
        subscribe_end_issue=item_in.subscribe_end_issue,
        address_id=address_id
    )
    db.add(order_item)
    db.commit()
    db.refresh(order_item)
    return order_item


def update_order_item(db: Session, order_item: OrderItem, item_in: OrderItemUpdate) -> OrderItem:
    update_data = item_in.model_dump(exclude_unset=True)
    
    # 환불액 변경 여부 확인
    refund_changed = "refund" in update_data
    
    # Handle address
    if "address" in update_data and update_data["address"]:
        from app.schemas.address import AddressCreate
        address = address_service.find_or_create_address(db, AddressCreate(**update_data["address"]))
        order_item.address_id = address.address_id
        del update_data["address"]
    
    for field, value in update_data.items():
        if field != "address":
            setattr(order_item, field, value)
    
    db.commit()
    db.refresh(order_item)
    
    # 환불액이 변경되면 주문 총액 재계산
    if refund_changed:
        from app.services import order_service
        order = order_service.get_order_by_id(db, order_item.order_id)
        if order:
            order_service.recalculate_totals(db, order)
    
    return order_item


def cancel_order_item(db: Session, order_item: OrderItem) -> OrderItem:
    order_item.cancelled_at = datetime.now()
    db.commit()
    db.refresh(order_item)
    return order_item


def update_subscription(db: Session, order_item: OrderItem, start_issue: str, end_issue: str) -> OrderItem:
    order_item.subscribe_start_issue = start_issue
    order_item.subscribe_end_issue = end_issue
    db.commit()
    db.refresh(order_item)
    return order_item


def update_last_send_issue(db: Session, order_item: OrderItem, issue: str) -> OrderItem:
    order_item.last_send_issue = issue
    order_item.sended_at = datetime.now()
    db.commit()
    db.refresh(order_item)
    return order_item


def find_subscription_targets(db: Session, issue: str) -> List[dict]:
    """Find all subscription items that should receive this issue"""
    
    # Subquery for pauses
    pause_subquery = db.query(Pause.order_item_id).filter(
        Pause.pause_issue == issue,
        Pause.deleted_at.is_(None)
    ).subquery()
    
    results = db.query(
        OrderItem,
        Order.customer_id,
        Order.order_channel,
        Customer.customer_name,
        Customer.customer_phone,
        Address.address_name,
        Address.phone,
        Address.postal_code,
        Address.address1,
        Address.address2,
        Address.address_memo
    ).join(Order, OrderItem.order_id == Order.order_id)\
     .join(Customer, Order.customer_id == Customer.customer_id)\
     .outerjoin(Address, OrderItem.address_id == Address.address_id)\
     .filter(
        OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
        OrderItem.cancelled_at.is_(None),
        OrderItem.subscribe_start_issue <= issue,
        or_(
            OrderItem.final_subscribe_end_issue >= issue,
            OrderItem.final_subscribe_end_issue.is_(None)
        ),
        or_(
            OrderItem.last_send_issue.is_(None),
            OrderItem.last_send_issue < issue
        ),
        ~OrderItem.order_item_id.in_(pause_subquery)
    ).order_by(Customer.customer_name.asc()).all()
    
    targets = []
    for row in results:
        item, customer_id, order_channel, customer_name, customer_phone, \
        address_name, phone, postal_code, address1, address2, address_memo = row
        
        targets.append({
            "order_item_id": item.order_item_id,
            "order_id": item.order_id,
            "customer_id": customer_id,
            "order_channel": order_channel,
            "product_code": item.product_code,
            "product_kind": item.product_kind,
            "product_name": item.product_name,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "address_id": item.address_id,
            "address_name": address_name,
            "phone": phone,
            "postal_code": postal_code,
            "address1": address1,
            "address2": address2,
            "address_memo": address_memo
        })
    
    return targets


def get_subscription_stats(db: Session, issue: str) -> dict:
    """Get subscription statistics for an issue"""
    
    result = db.query(
        func.count().label("total_subscriptions"),
        func.sum(case((OrderItem.product_kind == "YEARLY", 1), else_=0)).label("yearly_count"),
        func.sum(case((OrderItem.product_kind == "MONTHLY", 1), else_=0)).label("monthly_count"),
        func.sum(case((OrderItem.last_send_issue == issue, 1), else_=0)).label("sent_count")
    ).filter(
        OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
        OrderItem.cancelled_at.is_(None),
        OrderItem.subscribe_start_issue <= issue,
        or_(
            OrderItem.final_subscribe_end_issue >= issue,
            OrderItem.final_subscribe_end_issue.is_(None)
        )
    ).first()
    
    return {
        "total_subscriptions": result.total_subscriptions or 0,
        "yearly_count": result.yearly_count or 0,
        "monthly_count": result.monthly_count or 0,
        "sent_count": result.sent_count or 0
    }


def get_dispatch_targets(db: Session, issue: str) -> List[dict]:
    """
    특정 호(issue)에 발송해야 할 주문품목 목록 조회
    - 구독 기간 내 (subscribe_start_issue <= issue <= final_subscribe_end_issue)
    - 취소되지 않은 품목
    - 해당 호가 휴지(pause) 설정되지 않은 품목
    - 이미 발송되지 않은 품목 (last_send_issue < issue)
    """
    from app.models.pause import Pause
    from app.models.order import Order
    from app.models.customer import Customer
    from app.models.address import Address
    
    # 휴지 설정된 order_item_id 목록
    paused_item_ids = db.query(Pause.order_item_id).filter(
        Pause.pause_issue == issue,
        Pause.deleted_at == None
    ).subquery()
    
    # 발송 대상 조회
    query = db.query(
        OrderItem,
        Order.customer_id,
        Customer.customer_name,
        Customer.customer_phone,
        Address.address_name,
        Address.phone,
        Address.postal_code,
        Address.address,
        Address.address_memo
    ).join(
        Order, OrderItem.order_id == Order.order_id
    ).join(
        Customer, Order.customer_id == Customer.customer_id
    ).join(
        Address, OrderItem.address_id == Address.address_id
    ).filter(
        OrderItem.cancelled_at == None,
        OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
        OrderItem.subscribe_start_issue <= issue,
        OrderItem.final_subscribe_end_issue >= issue,  # subscribe_end_issue → final_subscribe_end_issue
        ~OrderItem.order_item_id.in_(paused_item_ids),
        or_(
            OrderItem.last_send_issue == None,
            OrderItem.last_send_issue < issue
        )
    )
    
    results = query.all()
    
    items = []
    for item, customer_id, customer_name, customer_phone, address_name, phone, postal_code, address, address_memo in results:
        items.append({
            "order_item_id": item.order_item_id,
            "order_id": item.order_id,
            "customer_id": customer_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "product_code": item.product_code,
            "product_name": item.product_name,
            "product_kind": item.product_kind,
            "order_num": item.order_num,
            "subscribe_start_issue": item.subscribe_start_issue,
            "subscribe_end_issue": item.subscribe_end_issue,
            "final_subscribe_end_issue": item.final_subscribe_end_issue,
            "last_send_issue": item.last_send_issue,
            "next_send_issue": issue,
            "address_id": item.address_id,
            "address_name": address_name,
            "phone": phone,
            "postal_code": postal_code,
            "address": address,
            "address_memo": address_memo
        })
    
    return items