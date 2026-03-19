# 표준 라이브러리
from typing import Optional, Tuple, List
from datetime import date

# 서드파티 라이브러리
from sqlalchemy.orm import Session
from sqlalchemy import func, case

# 로컬 애플리케이션
from app.models.send import Send
from app.models.send_item import SendItem
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.address import Address
from app.schemas.send import SendCreate, SendUpdate, SendItemInput
from app.crud import send as send_crud
from app.crud import send_item as send_item_crud
from app.services import send_item_service


def get_send_by_id(db: Session, send_id: int) -> Send:
    """발송 ID로 발송 조회"""
    return send_crud.read_send_by_id(send_id=send_id, db=db)


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
            (Send.recipient_name.like(f"%{search}%")) |
            (Send.recipient_phone.like(f"%{search}%"))
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
    """주문 ID로 발송 목록 조회"""
    return send_crud.read_sends_by_order_id(order_id=order_id, db=db)


def get_sends_by_date(db: Session, send_date: date) -> List[Send]:
    """발송일로 발송 목록 조회"""
    return send_crud.read_sends_by_date(send_date=send_date, db=db)


def create_send(db: Session, send_in: SendCreate) -> Send:
    """발송 생성 (배송지 처리 및 발송 품목 생성 포함)"""
    # 배송지 정보 처리
    address = None
    if send_in.address_id:
        address = db.query(Address).filter(Address.address_id == send_in.address_id).first()
    
    # 배송지 정보 결정 (우선순위: send_in.address > address > 기본값)
    if send_in.address:
        recipient_name = send_in.address.recipient_name
        recipient_phone = send_in.address.recipient_phone
        country_code = send_in.address.country_code or "KR"
        postal_code = send_in.address.postal_code
        address_str = send_in.address.recipient_address
        customer_memo = send_in.address.customer_memo
    elif address:
        recipient_name = address.recipient_name
        recipient_phone = address.recipient_phone
        country_code = address.country_code or "KR"
        postal_code = address.postal_code
        address_str = address.recipient_address
        customer_memo = address.customer_memo
    else:
        recipient_name = ""
        recipient_phone = ""
        country_code = "KR"
        postal_code = ""
        address_str = ""
        customer_memo = None

    # 발송 생성
    send = send_crud.create_send(
        order_id=send_in.order_id,
        address_id=send_in.address_id,
        send_date=send_in.send_date,
        db=db,
        courier_company=send_in.courier_company,
        tracking_no=send_in.tracking_no,
        send_status=send_in.send_status or "PREPARING",
        send_memo=send_in.send_memo,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        country_code=country_code,
        postal_code=postal_code,
        recipient_address=address_str,
        customer_memo=customer_memo
    )
    
    # 발송 품목 생성
    for item_in in send_in.items:
        order_item = db.query(OrderItem).filter(OrderItem.order_item_id == item_in.order_item_id).first()
        if not order_item:
            db.rollback()
            raise ValueError(f"주문 품목을 찾을 수 없습니다: {item_in.order_item_id}")
        
        product = db.query(Product).filter(Product.product_code == order_item.product_code).first()
        if not product:
            db.rollback()
            raise ValueError(f"상품을 찾을 수 없습니다: {order_item.product_code}")
        
        send_item_service.create_send_item_from_product(
            db=db,
            send_id=send.send_id,
            order_item_id=item_in.order_item_id,
            product=product,
            send_num=item_in.send_num or 1
        )
    
    try:
        db.commit()
        db.refresh(send)
        return send
    except Exception as e:
        db.rollback()
        raise ValueError(f"발송 생성 중 오류가 발생했습니다: {str(e)}")


def update_send(db: Session, send: Send, send_in: SendUpdate) -> Send:
    """발송 수정"""
    # 배송지 정보 업데이트 처리
    if send_in.address:
        send.recipient_name = send_in.address.recipient_name
        send.recipient_phone = send_in.address.recipient_phone
        send.country_code = send_in.address.country_code or send.country_code
        send.postal_code = send_in.address.postal_code
        send.recipient_address = send_in.address.recipient_address
        send.customer_memo = send_in.address.customer_memo
    
    return send_crud.update_send(send=send, send_in=send_in, db=db)


def update_send_status(db: Session, send: Send, status: str) -> Send:
    """발송 상태 변경"""
    return send_crud.update_send_status(send=send, status=status, db=db)


def update_tracking(db: Session, send: Send, courier: str, tracking_no: str) -> Send:
    """운송장 정보 업데이트"""
    return send_crud.update_tracking(send=send, courier=courier, tracking_no=tracking_no, db=db)


def cancel_send(db: Session, send: Send) -> Send:
    """발송 취소"""
    return send_crud.cancel_send(send=send, db=db)


def get_send_items(db: Session, send_id: int) -> List[SendItem]:
    """발송 ID로 발송 품목 목록 조회"""
    return send_item_crud.read_send_items_by_send_id(send_id=send_id, db=db, include_cancelled=False)
