# 표준 라이브러리
from typing import List, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.address import AddressCreate
from app.schemas.send import SendCreate, SendListQuery, SendStatusUpdate, SendUpdate
from app.crud import send as send_crud
from app.services import send_item_service
from app.services import address_service


# ── 조회 ──────────────────────────────────────────────────────────────────────

def get_send_by_id(db: Session, send_id: int) -> Send:
    return send_crud.read_send_by_id(db=db, send_id=send_id)


def list_sends(db: Session, query: SendListQuery) -> Tuple[List[Send], int]:
    return send_crud.list_sends(db=db, query=query)


def get_sends_by_order(db: Session, order_id: int) -> List[Send]:
    return send_crud.read_sends_by_order_id(db=db, order_id=order_id)


def get_send_items(db: Session, send_id: int) -> List[SendItem]:
    return send_item_service.get_send_items_by_send(db=db, send_id=send_id)


# ── 생성 ──────────────────────────────────────────────────────────────────────

def create_send(db: Session, send_in: SendCreate) -> Send:
    """발송 생성 (배송지 처리 + SendItem 생성)"""
    if not send_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="발송 품목을 최소 1개 입력해야 합니다.",
        )

    # 배송지 처리: address_id(기존) 또는 address(신규) 중 하나 필수
    if send_in.address_id:
        addr = db.query(Address).filter(Address.address_id == send_in.address_id).first()
        if not addr:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"배송지를 찾을 수 없습니다: {send_in.address_id}",
            )
        address_id = addr.address_id
        recipient_name = addr.recipient_name
        recipient_phone = addr.recipient_phone
        country_code = addr.country_code
        postal_code = addr.postal_code
        recipient_address = addr.recipient_address
        customer_memo = addr.customer_memo

    elif send_in.address:
        # 신규 배송지: order → customer_id 자동 파생
        order = db.query(Order).filter(Order.order_id == send_in.order_id).first()
        if not order:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"주문을 찾을 수 없습니다: {send_in.order_id}",
            )
        new_address_data = AddressCreate(
            customer_id=order.customer_id,
            recipient_name=send_in.address.recipient_name,
            recipient_phone=send_in.address.recipient_phone,
            country_code=send_in.address.country_code,
            postal_code=send_in.address.postal_code,
            recipient_address=send_in.address.recipient_address,
            customer_memo=send_in.address.customer_memo,
        )
        addr, _ = address_service.find_or_create_address(db, new_address_data)
        address_id = addr.address_id
        recipient_name = addr.recipient_name
        recipient_phone = addr.recipient_phone
        country_code = addr.country_code
        postal_code = addr.postal_code
        recipient_address = addr.recipient_address
        customer_memo = addr.customer_memo

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="address_id 또는 address 중 하나를 입력해야 합니다.",
        )

    # 발송 레코드 생성
    send = send_crud.create_send(
        db=db,
        order_id=send_in.order_id,
        address_id=address_id,
        official_send_date=send_in.official_send_date,
        admin_memo=send_in.admin_memo,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        country_code=country_code,
        postal_code=postal_code,
        recipient_address=recipient_address,
        customer_memo=customer_memo,
    )

    # 발송 품목 생성
    for item_in in send_in.items:
        order_item = db.query(OrderItem).filter(
            OrderItem.order_item_id == item_in.order_item_id
        ).first()
        if not order_item:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"주문 품목을 찾을 수 없습니다: {item_in.order_item_id}",
            )
        if order_item.order_id != send_in.order_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"주문 품목({item_in.order_item_id})이 해당 주문({send_in.order_id})에 속하지 않습니다.",
            )

        product = db.query(Product).filter(
            Product.product_code == order_item.product_code
        ).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"상품을 찾을 수 없습니다: {order_item.product_code}",
            )

        send_item_service.create_send_item_from_product(
            db=db,
            send_id=send.send_id,
            order_item_id=item_in.order_item_id,
            issue=item_in.issue,
            product=product,
            send_num=item_in.send_num,
        )

    db.commit()
    db.refresh(send)
    return send


# ── 수정 ──────────────────────────────────────────────────────────────────────

def update_send(db: Session, send: Send, send_in: SendUpdate) -> Send:
    return send_crud.update_send(db=db, send=send, send_in=send_in)


def update_send_status(db: Session, send: Send, status_in: SendStatusUpdate) -> Send:
    """발송 상태 변경 (취소는 cancel_send 사용)"""
    if send.send_status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 발송입니다.",
        )
    if status_in.send_status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="발송 취소는 /sends/{id}/cancel 엔드포인트를 사용해주세요.",
        )
    return send_crud.update_send_status(
        db=db,
        send=send,
        send_status=status_in.send_status,
        tracking_no=status_in.tracking_no,
        courier_company=status_in.courier_company,
    )


def update_tracking(db: Session, send: Send, tracking_no: str, courier_company: str) -> Send:
    """운송장 정보 등록 → SHIPPING 전환"""
    return send_crud.update_tracking(
        db=db,
        send=send,
        tracking_no=tracking_no,
        courier_company=courier_company,
    )


def cancel_send(db: Session, send: Send) -> Send:
    """발송 취소 (PREPARING 상태에서만 가능, 연관 SendItem도 취소)"""
    if send.send_status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 발송입니다.",
        )
    if send.send_status != "PREPARING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"발송 전(PREPARING) 상태에서만 취소할 수 있습니다. 현재 상태: {send.send_status}",
        )
    return send_crud.cancel_send(db=db, send=send)
