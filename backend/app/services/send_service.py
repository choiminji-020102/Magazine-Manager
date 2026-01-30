from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional, Tuple, List
from datetime import datetime, date
from fastapi import HTTPException, status

from app.models.send import Send
from app.models.send_item import SendItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.address import Address
from app.schemas.send import SendCreate, SendUpdate, SendItemInput


def get_send_by_id(db: Session, send_id: int) -> Optional[Send]:
    send = db.query(Send).filter(
        Send.send_id == send_id
    ).first()
    if send is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="발송 정보를 찾을 수 없습니다."
        )
    return send


def get_sends(
    db: Session,
    page: int = 1,
    limit: int = 20,
    status: Optional[str] = None,
    courier: Optional[str] = None,
    send_date: Optional[str] = None,
    search: Optional[str] = None
) -> Tuple[List[dict], int]:
    # MySQL 호환: FILTER 대신 CASE WHEN 사용
    item_count_expr = func.sum(
        case((SendItem.cancelled_at.is_(None), 1), else_=0)
    ).label("item_count")
    
    query = db.query(
        Send,
        item_count_expr
    ).outerjoin(SendItem, Send.send_id == SendItem.send_id)\
     .filter(Send.cancelled_at.is_(None))\
     .group_by(Send.send_id)
    
    if status:
        query = query.filter(Send.send_status == status)
    
    if courier:
        query = query.filter(Send.courier_company == courier)
    
    if send_date:
        query = query.filter(Send.send_date == send_date)
    
    if search:
        query = query.filter(
            (Send.tracking_no.like(f"%{search}%")) |
            (Send.address_name.like(f"%{search}%")) |
            (Send.phone.like(f"%{search}%"))
        )
    
    total = query.count()
    
    offset = (page - 1) * limit
    results = query.order_by(Send.created_at.desc()).offset(offset).limit(limit).all()
    
    items = []
    for send, item_count in results:
        send_dict = {**send.__dict__, "item_count": item_count or 0}
        items.append(send_dict)
    
    return items, total


def get_sends_by_order(db: Session, order_id: int) -> List[Send]:
    return db.query(Send).filter(
        Send.order_id == order_id
    ).order_by(Send.created_at.desc()).all()


def get_sends_by_date(db: Session, send_date: date) -> List[Send]:
    return db.query(Send).filter(
        Send.send_date == send_date,
        Send.cancelled_at.is_(None)
    ).order_by(Send.created_at.asc()).all()


def create_send(db: Session, send_in: SendCreate) -> Send:
    # Get address info
    address = None
    if send_in.address_id:
        address = db.query(Address).filter(Address.address_id == send_in.address_id).first()
    
    # Use provided address or from address_id
    address_name = send_in.address.address_name if send_in.address else (address.address_name if address else "")
    phone = send_in.address.phone if send_in.address else (address.phone if address else "")
    nation = send_in.address.nation if send_in.address else (address.nation if address else "대한민국")
    postal_code = send_in.address.postal_code if send_in.address else (address.postal_code if address else "")
    
    if send_in.address:
        address = send_in.address.address
        address_memo = send_in.address.address_memo
    elif address:
        address = address
        address_memo = address.address_memo
    else:
        address = ""
        address_memo = None
    
    send = Send(
        order_id=send_in.order_id,
        address_id=send_in.address_id,
        send_date=send_in.send_date,
        courier_company=send_in.courier_company,
        tracking_no=send_in.tracking_no,
        send_status=send_in.send_status or "PREPARING",
        send_memo=send_in.send_memo,
        address_name=address_name,
        phone=phone,
        nation=nation,
        postal_code=postal_code,
        address=address,
        address_memo=address_memo
    )
    db.add(send)
    db.flush()
    
    # Create send items
    for item_in in send_in.items:
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
    db.refresh(send)
    return send


def update_send(db: Session, send: Send, send_in: SendUpdate) -> Send:
    update_data = send_in.model_dump(exclude_unset=True)
    
    # Handle address update
    if "address" in update_data and update_data["address"]:
        addr = update_data["address"]
        send.address_name = addr["address_name"]
        send.phone = addr["phone"]
        send.nation = addr["nation"]
        send.postal_code = addr["postal_code"]
        send.address = addr.addr["address"]
        send.address_memo = addr.addr["address_memo"]
        del update_data["address"]
    
    for field, value in update_data.items():
        setattr(send, field, value)
    
    db.commit()
    db.refresh(send)
    return send


def update_send_status(db: Session, send: Send, status: str) -> Send:
    send.send_status = status
    if status == "CANCELLED":
        send.cancelled_at = datetime.now()
    db.commit()
    db.refresh(send)
    return send


def update_tracking(db: Session, send: Send, courier: str, tracking_no: str) -> Send:
    send.courier_company = courier
    send.tracking_no = tracking_no
    send.send_status = "SHIPPED"
    if not send.send_date:
        send.send_date = date.today()
    db.commit()
    db.refresh(send)
    return send


def cancel_send(db: Session, send: Send) -> Send:
    send.send_status = "CANCELLED"
    send.cancelled_at = datetime.now()
    
    # Cancel all items
    for item in send.items.filter(SendItem.cancelled_at.is_(None)):
        item.cancelled_at = datetime.now()
    
    db.commit()
    db.refresh(send)
    return send


def get_send_items(db: Session, send_id: int) -> List[SendItem]:
    return db.query(SendItem).filter(
        SendItem.send_id == send_id,
        SendItem.cancelled_at.is_(None)
    ).order_by(SendItem.send_item_id.asc()).all()
