# 표준 라이브러리
from datetime import datetime
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import calculate_subscribe_end_issue, format_phone_number, now_kst
from app.crud import order as order_crud
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.order import (
    OrderCancelRequest, OrderCreate, OrderListQuery, OrderListResponse, OrderPaymentUpdate, OrderUpdate,
)


def get_orders(db: Session, query: OrderListQuery) -> Tuple[List[OrderListResponse], int]:
    return order_crud.list_orders(
        db=db,
        page=query.page,
        limit=query.limit,
        customer_search=query.customer_search,
        recipient_search=query.recipient_search,
        external_order_id=query.external_order_id,
        order_channel=query.order_channel,
        order_status=query.order_status,
        start_date=query.start_date,
        end_date=query.end_date,
        payment_method=query.payment_method,
        admin_memo=query.admin_memo,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


def get_order_by_id(db: Session, order_id: int) -> Order:
    return order_crud.read_order_by_id(db=db, order_id=order_id)


def get_order_by_external_id(db: Session, external_order_id: str) -> Order:
    return order_crud.read_order_by_external_id(db=db, external_order_id=external_order_id)


def get_orders_by_customer(db: Session, customer_id: int, limit: int = 50) -> List[Order]:
    return order_crud.read_orders_by_customer(db=db, customer_id=customer_id, limit=limit)


def create_order(db: Session, order_in: OrderCreate) -> Order:
    """주문 생성 (고객·배송지 자동 처리 + 품목 생성)"""
    from app.schemas.customer import CustomerCreate
    from app.schemas.address import AddressCreate
    from app.services import customer_service, address_service

    # ── 1. 외부 주문번호 중복 검증 ────────────────────────────────────────────
    if order_in.external_order_id:
        order_crud.check_external_order_id_duplicate(db, order_in.external_order_id)

    # ── 2. 고객 처리 ──────────────────────────────────────────────────────────
    # @model_validator에서 customer_id와 customer 중 하나는 반드시 있음
    customer_id = order_in.customer_id

    if not customer_id:
        existing = customer_service.get_customer_by_phone(db, order_in.customer.customer_phone)
        if existing:
            customer_id = existing.customer_id
        else:
            new_customer = customer_service.create_customer(
                db,
                CustomerCreate(
                    customer_name=order_in.customer.customer_name,
                    customer_phone=order_in.customer.customer_phone,
                    customer_email=order_in.customer.customer_email,
                    create_channel=order_in.customer.create_channel or "OFFLINE",
                    admin_memo=order_in.customer.admin_memo,
                ),
            )
            customer_id = new_customer.customer_id

    # ── 3. 배송지 처리 ────────────────────────────────────────────────────────
    # @model_validator에서 address_id와 address 중 하나는 반드시 있음
    address_id = order_in.address_id

    if not address_id:
        addr, _ = address_service.find_or_create_address(
            db,
            AddressCreate(
                customer_id=customer_id,
                recipient_name=order_in.address.recipient_name,
                recipient_phone=order_in.address.recipient_phone,
                country_code=order_in.address.country_code,
                postal_code=order_in.address.postal_code,
                recipient_address=order_in.address.recipient_address,
                customer_memo=order_in.address.customer_memo,
            ),
        )
        address_id = addr.address_id

    # ── 4. 품목 유효성 검증 + 상품 조회 ──────────────────────────────────────
    if not order_in.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="주문 품목을 1개 이상 입력해주세요.",
        )

    product_map: dict[str, Product] = {}
    for item_in in order_in.items:
        if item_in.product_code in product_map:
            continue
        product = db.query(Product).filter(Product.product_code == item_in.product_code).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"상품 코드 '{item_in.product_code}'를 찾을 수 없습니다.",
            )
        if not product.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"비활성화된 상품입니다: {product.product_name}",
            )
        product_map[item_in.product_code] = product

    # ── 5. 금액 계산 ──────────────────────────────────────────────────────────
    # total_amount = Σ(sale_price × order_num)
    total_amount = sum(
        (item_in.sale_price if item_in.sale_price is not None else product_map[item_in.product_code].sale_price)
        * item_in.order_num
        for item_in in order_in.items
    )

    # send_fee: 미입력 시 product_kind 기반 자동 설정 (MONTHLY: 3300, YEARLY: 0)
    if order_in.send_fee is not None:
        send_fee = order_in.send_fee
    else:
        has_monthly = any(
            product_map[item_in.product_code].product_kind == "MONTHLY"
            for item_in in order_in.items
        )
        send_fee = 3300 if has_monthly else 0

    payment_amount = total_amount - order_in.discount_amount + send_fee

    # ── 6. 주문 생성 ──────────────────────────────────────────────────────────
    order = order_crud.create_order(
        db=db,
        customer_id=customer_id,
        address_id=address_id,
        external_order_id=order_in.external_order_id,
        order_channel=order_in.order_channel,
        order_status=order_in.order_status,
        total_amount=total_amount,
        payment_amount=payment_amount,
        discount_amount=order_in.discount_amount,
        send_fee=send_fee,
        payment_method=order_in.payment_method,
        customer_memo=order_in.customer_memo,
        admin_memo=order_in.admin_memo,
        order_at=order_in.order_at,
        payment_at=order_in.payment_at,
    )

    # ── 7. 주문 품목 생성 ─────────────────────────────────────────────────────
    for item_in in order_in.items:
        product = product_map[item_in.product_code]

        sale_price = item_in.sale_price if item_in.sale_price is not None else product.sale_price
        list_price = product.list_price

        # 구독 시작 호: 상품 등록 시 product_code에서 자동 파싱된 값 사용
        subscribe_start_issue = product.subscribe_start_issue
        if not subscribe_start_issue:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"상품 '{product.product_name}'의 구독 시작 호가 설정되지 않았습니다. 상품 코드를 확인해주세요.",
            )

        if product.product_kind == "YEARLY":
            subscribe_period = item_in.subscribe_period or 12
            subscribe_end_issue = calculate_subscribe_end_issue(subscribe_start_issue, subscribe_period)
        else:  # MONTHLY
            subscribe_period = 1
            subscribe_end_issue = subscribe_start_issue  # 단편은 시작 = 종료

        order_item = OrderItem(
            order_id=order.order_id,
            address_id=address_id,
            product_code=product.product_code,
            product_kind=product.product_kind,
            product_name=product.product_name,
            list_price=list_price,
            sale_price=sale_price,
            order_num=item_in.order_num,
            subscribe_start_issue=subscribe_start_issue,
            subscribe_end_issue=subscribe_end_issue,
            final_subscribe_start_issue=subscribe_start_issue,
            final_subscribe_end_issue=subscribe_end_issue,
            paid_subscribe_end_issue=subscribe_end_issue,  # 생성 시 subscribe_end_issue와 동일
            subscribe_period=subscribe_period,
            admin_memo=item_in.admin_memo,
        )
        db.add(order_item)

    # ── 8. 고객 최근 주문일 업데이트 ──────────────────────────────────────────
    from app.models.customer import Customer
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if customer:
        customer.last_order_at = now_kst()

    db.commit()
    db.refresh(order)
    return order


def update_order(db: Session, order: Order, order_in: OrderUpdate) -> Order:
    """주문 수정 (address_id 변경 시 모든 품목 배송지 일괄 변경)"""
    if order_in.address_id is not None and order_in.address_id != order.address_id:
        order_crud.bulk_update_items_address(
            db=db, order_id=order.order_id, address_id=order_in.address_id
        )
    return order_crud.update_order(db=db, order=order, order_in=order_in)


def update_order_status(db: Session, order: Order, order_status: str) -> Order:
    """주문 상태 변경 (PAID → payment_at 자동 설정)"""
    now = now_kst()
    payment_at = now if order_status == "PAID" and not order.payment_at else None
    return order_crud.set_order_status(
        db=db,
        order=order,
        order_status=order_status,
        payment_at=payment_at,
    )


def process_payment(db: Session, order: Order, payment_in: OrderPaymentUpdate) -> Order:
    """결제 완료 처리 (ORDERED → PAID)"""
    if order.order_status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="취소된 주문은 결제 처리할 수 없습니다.",
        )
    if order.order_status == "PAID":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 결제 완료된 주문입니다.",
        )
    now = now_kst()
    # 상태·결제일·결제방법을 한 번에 설정 후 commit
    order.order_status = "PAID"
    order.payment_at = payment_in.payment_at or now
    if payment_in.payment_method:
        order.payment_method = payment_in.payment_method
    db.commit()
    db.refresh(order)
    return order


def cancel_order(db: Session, order: Order, cancel_request: OrderCancelRequest) -> Order:
    """
    주문 취소 — 취소 규칙:
    - MONTHLY 상품이 SHIPPING/DELIVERED 상태면 주문 전체 취소 불가
    - PREPARING 상태인 Send만 취소 처리
    - YEARLY 배송 후: 잔여 회차 기준 환불액 계산
    - MONTHLY 배송 전: 전액 환불
    - YEARLY 배송 전: 전액 환불
    """
    if order.order_status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 주문입니다.",
        )

    active_items: List[OrderItem] = db.query(OrderItem).filter(
        OrderItem.order_id == order.order_id,
        OrderItem.cancelled_at.is_(None),
    ).all()

    # ── 1. MONTHLY 상품 배송 후 취소 불가 검증 ────────────────────────────────
    for item in active_items:
        if item.product_kind != "MONTHLY":
            continue
        if _has_blocking_send(db, item.order_item_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"MONTHLY 상품 '{item.product_name}'이(가) 배송 중이거나 배송 완료 상태입니다. "
                    "배송 후 MONTHLY 상품은 취소할 수 없습니다."
                ),
            )

    # ── 2. 환불액 계산 ────────────────────────────────────────────────────────
    now = now_kst()

    if cancel_request.refund_amount is not None:
        # 관리자가 직접 환불액 지정
        total_refund = cancel_request.refund_amount
    else:
        # 자동 계산
        total_refund = 0
        for item in active_items:
            delivered_count = _count_delivered_issues(db, item.order_item_id)

            if delivered_count == 0:
                # 배송 전: 전액 환불
                total_refund += item.sale_price * item.order_num
            elif item.product_kind == "YEARLY" and item.subscribe_period:
                # YEARLY 배송 후: 잔여 회차 환불
                remaining = item.subscribe_period - delivered_count
                if remaining > 0:
                    refund_per_issue = item.sale_price // item.subscribe_period
                    total_refund += refund_per_issue * remaining * item.order_num

        # 배송비 환불 (YEARLY는 0원이므로 실질적으로 MONTHLY 취소 시에만 적용)
        total_refund += order.send_fee or 0

    # ── 3. 취소 사유를 admin_memo에 추가 기록 ────────────────────────────────
    cancel_note = f"[취소] {cancel_request.admin_memo}"
    order.admin_memo = f"{order.admin_memo}\n{cancel_note}" if order.admin_memo else cancel_note

    # ── 4. PREPARING 상태 Send 취소 ──────────────────────────────────────────
    _cancel_pending_sends(db, [item.order_item_id for item in active_items], now)

    # ── 5. 품목 일괄 취소 ─────────────────────────────────────────────────────
    order_crud.cancel_order_items(db=db, order_id=order.order_id)

    # ── 6. 주문 취소 ──────────────────────────────────────────────────────────
    return order_crud.set_order_status(
        db=db,
        order=order,
        order_status="CANCELLED",
        cancelled_at=now,
        refund_amount=total_refund,
    )


def recalculate_totals(db: Session, order: Order) -> Order:
    """주문 총액 재계산 (품목 변경 후 호출)"""
    items = order_crud.read_order_items_by_order_id(
        db=db, order_id=order.order_id, include_cancelled=False
    )
    total_amount = sum(item.sale_price * item.order_num for item in items)
    refund_amount = sum(item.refund_amount or 0 for item in items)

    order.total_amount = total_amount
    order.refund_amount = refund_amount
    order.payment_amount = (
        total_amount - (order.discount_amount or 0) - refund_amount + (order.send_fee or 0)
    )
    db.commit()
    db.refresh(order)
    return order


# ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _has_blocking_send(db: Session, order_item_id: int) -> bool:
    """해당 품목에 SHIPPING/DELIVERED Send가 존재하는지 확인"""
    send_item = (
        db.query(SendItem)
        .filter(
            SendItem.order_item_id == order_item_id,
            SendItem.cancelled_at.is_(None),
        )
        .first()
    )
    if not send_item:
        return False
    return db.query(Send).filter(
        Send.send_id == send_item.send_id,
        Send.send_status.in_(["SHIPPING", "DELIVERED"]),
    ).first() is not None


def _count_delivered_issues(db: Session, order_item_id: int) -> int:
    """해당 품목의 SHIPPING/DELIVERED 상태 발송 건수 반환"""
    send_items = (
        db.query(SendItem)
        .filter(
            SendItem.order_item_id == order_item_id,
            SendItem.cancelled_at.is_(None),
        )
        .all()
    )
    if not send_items:
        return 0
    send_ids = [si.send_id for si in send_items]
    return (
        db.query(Send)
        .filter(
            Send.send_id.in_(send_ids),
            Send.send_status.in_(["SHIPPING", "DELIVERED"]),
        )
        .count()
    )


def _cancel_pending_sends(db: Session, order_item_ids: List[int], now: datetime) -> None:
    """PREPARING 상태 Send 취소 처리"""
    if not order_item_ids:
        return
    send_items = (
        db.query(SendItem)
        .filter(
            SendItem.order_item_id.in_(order_item_ids),
            SendItem.cancelled_at.is_(None),
        )
        .all()
    )
    send_ids = list({si.send_id for si in send_items})
    if not send_ids:
        return
    sends_to_cancel = (
        db.query(Send)
        .filter(
            Send.send_id.in_(send_ids),
            Send.send_status.in_(["PREPARING"]),
        )
        .all()
    )
    cancelled_send_ids = set()
    for send in sends_to_cancel:
        send.send_status = "CANCELLED"
        send.cancelled_at = now
        cancelled_send_ids.add(send.send_id)

    # 취소된 Send에 연결된 SendItem도 함께 취소
    for si in send_items:
        if si.send_id in cancelled_send_ids:
            si.cancelled_at = now
