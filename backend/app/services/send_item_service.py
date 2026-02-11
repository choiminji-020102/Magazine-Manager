# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.send_item import SendItem
from app.models.send import Send
from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.send_item import SendItemCreate, SendItemUpdate
from app.crud import send_item as send_item_crud


def get_send_item_by_id(db: Session, send_item_id: int) -> SendItem:
    """발송 품목 ID로 발송 품목 조회"""
    return send_item_crud.read_send_item_by_id(send_item_id=send_item_id, db=db)


def get_send_items_by_send(db: Session, send_id: int) -> List[SendItem]:
    """발송 ID로 발송 품목 목록 조회"""
    return send_item_crud.read_send_items_by_send_id(send_id=send_id, db=db, include_cancelled=False)


def get_send_items_by_order_item(db: Session, order_item_id: int) -> List[dict]:
    """주문 품목 ID로 발송 품목 목록 조회 (Send 정보 포함)"""
    return send_item_crud.read_send_items_by_order_item_id(order_item_id=order_item_id, db=db)


def create_send_item(db: Session, send: Send, item_in: SendItemCreate) -> SendItem:
    """발송 품목 생성"""
    # 주문 품목 조회
    order_item = db.query(OrderItem).filter(OrderItem.order_item_id == item_in.order_item_id).first()
    if not order_item:
        raise ValueError(f"주문 품목을 찾을 수 없습니다: {item_in.order_item_id}")
    
    # 상품 조회
    product = db.query(Product).filter(Product.product_code == order_item.product_code).first()
    if not product:
        raise ValueError(f"상품을 찾을 수 없습니다: {order_item.product_code}")
    
    # 발송 품목 생성
    send_item = send_item_crud.create_send_item(
        send_id=send.send_id,
        order_item_id=item_in.order_item_id,
        product_code=product.product_code,
        product_name=product.product_name,
        db=db,
        send_num=item_in.send_num or 1,
        purchase=product.purchase or 0,
        unit_weight=float(product.unit_weight or 0),
        unit_width=float(product.unit_width or 0),
        unit_length=float(product.unit_length or 0),
        unit_height=float(product.unit_height or 0)
    )
    
    try:
        db.commit()
        db.refresh(send_item)
        return send_item
    except Exception as e:
        db.rollback()
        raise ValueError(f"발송 품목 생성 중 오류가 발생했습니다: {str(e)}")


def update_send_item(db: Session, send_item: SendItem, item_in: SendItemUpdate) -> SendItem:
    """발송 품목 수정"""
    return send_item_crud.update_send_item(send_item=send_item, item_in=item_in, db=db)


def delete_send_item(db: Session, send_item: SendItem) -> None:
    """발송 품목 소프트 삭제"""
    send_item_crud.delete_send_item(send_item=send_item, db=db)


def create_send_item_from_product(
    db: Session,
    send_id: int,
    order_item_id: int,
    product: Product,
    send_num: int = 1
) -> SendItem:
    """상품 정보로 발송 품목 생성"""
    send_item = send_item_crud.create_send_item(
        send_id=send_id,
        order_item_id=order_item_id,
        product_code=product.product_code,
        product_name=product.product_name,
        db=db,
        send_num=send_num,
        purchase=product.purchase or 0,
        unit_weight=float(product.unit_weight or 0),
        unit_width=float(product.unit_width or 0),
        unit_length=float(product.unit_length or 0),
        unit_height=float(product.unit_height or 0)
    )
    
    try:
        db.commit()
        db.refresh(send_item)
        return send_item
    except Exception as e:
        db.rollback()
        raise ValueError(f"발송 품목 생성 중 오류가 발생했습니다: {str(e)}")
