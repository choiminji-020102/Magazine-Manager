from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.models.send_item import SendItem
from app.models.send import Send
from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.send_item import SendItemCreate, SendItemUpdate


def get_send_item_by_id(db: Session, send_item_id: int) -> Optional[SendItem]:
    return db.query(SendItem).filter(SendItem.send_item_id == send_item_id).first()


def get_send_items_by_send(db: Session, send_id: int) -> List[SendItem]:
    return db.query(SendItem).filter(
        SendItem.send_id == send_id,
        SendItem.cancelled_at.is_(None)
    ).order_by(SendItem.send_item_id.asc()).all()


def get_send_items_by_order_item(db: Session, order_item_id: int) -> List[dict]:
    results = db.query(
        SendItem,
        Send.send_date,
        Send.courier_company,
        Send.tracking_no,
        Send.send_status
    ).join(Send, SendItem.send_id == Send.send_id)\
     .filter(
        SendItem.order_item_id == order_item_id,
        SendItem.cancelled_at.is_(None)
    ).order_by(Send.send_date.desc()).all()
    
    items = []
    for send_item, send_date, courier_company, tracking_no, send_status in results:
        item_dict = {
            **send_item.__dict__,
            "send_date": send_date,
            "courier_company": courier_company,
            "tracking_no": tracking_no,
            "send_status": send_status
        }
        items.append(item_dict)
    
    return items


def create_send_item(db: Session, send: Send, item_in: SendItemCreate) -> SendItem:
    order_item = db.query(OrderItem).filter(OrderItem.order_item_id == item_in.order_item_id).first()
    if not order_item:
        raise ValueError(f"주문 품목을 찾을 수 없습니다: {item_in.order_item_id}")
    
    product = db.query(Product).filter(Product.product_code == order_item.product_code).first()
    if not product:
        raise ValueError(f"상품을 찾을 수 없습니다: {order_item.product_code}")
    
    send_item = SendItem(
        send_id=send.send_id,
        order_item_id=item_in.order_item_id,
        product_code=product.product_code,
        send_num=item_in.send_num or 1,
        purchase=product.purchase or 0,
        product_name=product.product_name,
        unit_weight=product.unit_weight or 0,
        unit_width=product.unit_width or 0,
        unit_length=product.unit_length or 0,
        unit_height=product.unit_height or 0
    )
    db.add(send_item)
    db.commit()
    db.refresh(send_item)
    return send_item


def update_send_item(db: Session, send_item: SendItem, item_in: SendItemUpdate) -> SendItem:
    update_data = item_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(send_item, field, value)
    
    db.commit()
    db.refresh(send_item)
    return send_item


def delete_send_item(db: Session, send_item: SendItem) -> None:
    send_item.cancelled_at = datetime.now()
    db.commit()


def create_send_item_from_product(
    db: Session,
    send_id: int,
    order_item_id: int,
    product: Product,
    send_num: int = 1
) -> SendItem:
    send_item = SendItem(
        send_id=send_id,
        order_item_id=order_item_id,
        product_code=product.product_code,
        send_num=send_num,
        purchase=product.purchase or 0,
        product_name=product.product_name,
        unit_weight=product.unit_weight or 0,
        unit_width=product.unit_width or 0,
        unit_length=product.unit_length or 0,
        unit_height=product.unit_height or 0
    )
    db.add(send_item)
    db.commit()
    db.refresh(send_item)
    return send_item
