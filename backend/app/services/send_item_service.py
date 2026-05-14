# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.send_item import SendItemCreate, SendItemUpdate
from app.crud import send_item as send_item_crud


def get_send_item_by_id(db: Session, send_item_id: int) -> SendItem:
    return send_item_crud.read_send_item_by_id(db=db, send_item_id=send_item_id)


def get_send_items_by_send(db: Session, send_id: int) -> List[SendItem]:
    return send_item_crud.read_send_items_by_send_id(db=db, send_id=send_id, include_cancelled=False)


def create_send_item(db: Session, send: Send, item_in: SendItemCreate) -> SendItem:
    """엔드포인트에서 개별 품목 추가 시 사용"""
    order_item = db.query(OrderItem).filter(
        OrderItem.order_item_id == item_in.order_item_id
    ).first()
    if not order_item:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"주문 품목을 찾을 수 없습니다: {item_in.order_item_id}",
        )

    product = db.query(Product).filter(
        Product.product_code == order_item.product_code
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"상품을 찾을 수 없습니다: {order_item.product_code}",
        )

    item = create_send_item_from_product(
        db=db,
        send_id=send.send_id,
        order_item_id=item_in.order_item_id,
        issue=item_in.issue,
        product=product,
        # send_num 은 OrderItem.order_num 스냅샷 — 일괄 생성 경로
        # (send_service.create_preparing_sends_from_groups) 와 동일 매핑.
        send_num=order_item.order_num,
    )
    db.commit()
    db.refresh(item)
    return item


def update_send_item(db: Session, send_item: SendItem, item_in: SendItemUpdate) -> SendItem:
    return send_item_crud.update_send_item(db=db, send_item=send_item, item_in=item_in)


def create_send_item_from_product(
    db: Session,
    send_id: int,
    order_item_id: int,
    issue: str,
    product: Product,
    send_num: int = 1,
) -> SendItem:
    """상품 스냅샷으로 발송 품목 생성"""
    return send_item_crud.create_send_item(
        db=db,
        send_id=send_id,
        order_item_id=order_item_id,
        product_code=product.product_code,
        product_name=product.product_name,
        issue=issue,
        send_num=send_num,
        cost_price=product.cost_price or 0,
        unit_weight=float(product.unit_weight) if product.unit_weight is not None else None,
        unit_width=float(product.unit_width) if product.unit_width is not None else None,
        unit_length=float(product.unit_length) if product.unit_length is not None else None,
        unit_height=float(product.unit_height) if product.unit_height is not None else None,
    )
