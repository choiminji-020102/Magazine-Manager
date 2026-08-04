# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import calculate_subscribe_end_issue, count_issue_diff, format_phone_number, now_kst
from app.crud import order as order_crud
from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.order import (
    OrderCancelCalculateResponse, OrderCancelItemDetail, OrderCancelRequest,
    OrderCreate, OrderListQuery, OrderListResponse, OrderPaymentUpdate, OrderUpdate,
)
from app.services import order_item_service, send_service


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
        existing = customer_service.get_customer_by_phone_and_name(db, order_in.customer.customer_phone, order_in.customer.customer_name)
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

    payment_amount = total_amount + send_fee

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
        discount_amount=0,
        send_fee=send_fee,
        payment_method=order_in.payment_method,
        customer_memo=order_in.customer_memo,
        admin_memo=order_in.admin_memo,
        order_at=order_in.order_at,
        payment_at=order_in.payment_at,
        cancelled_at=order_in.cancelled_at,
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
            external_order_item_id=item_in.external_order_item_id,
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


def change_order_address(db: Session, order: Order, new_address_id: int) -> None:
    """주문 단위 배송지 일괄 변경 — 모든 활성 OrderItem 의 배송지 + PREPARING Send 스냅샷 동기화.

    `order_item_service.update_address` 와 동일한 안전 가드를 각 OrderItem 에 적용:
    - 발송이 모두 끝난 OrderItem 은 옛 주소 유지 (건드리지 않음)
    - PREPARING Send 있는 OrderItem 은 address_id 변경 + Send 스냅샷 필드 동기화
    - YEARLY 이면서 구독 종료 호가 남은 OrderItem 은 지난 호가 모두 DELIVERED 여도
      address_id 변경 (아직 Send 가 없는 다음 호부터 새 배송지로 발송)
    - CANCELLED OrderItem 은 처리 대상에서 제외 (`cancelled_at IS NULL` 필터)

    트랜잭션 commit 은 호출자(update_order) 가 `order_crud.update_order` 호출 시 수행.
    """
    new_address = db.query(Address).filter(Address.address_id == new_address_id).first()
    if not new_address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="배송지를 찾을 수 없습니다.",
        )

    items = db.query(OrderItem).filter(
        OrderItem.order_id == order.order_id,
        OrderItem.cancelled_at.is_(None),
    ).all()

    for item in items:
        order_item_service.apply_address_to_order_item(db, item, new_address)


def update_order(db: Session, order: Order, order_in: OrderUpdate) -> Order:
    """주문 수정 (address_id 변경 시 모든 품목 배송지 일괄 변경 + PREPARING Send 동기화)"""
    if order_in.address_id is not None and order_in.address_id != order.address_id:
        change_order_address(db=db, order=order, new_address_id=order_in.address_id)
    return order_crud.update_order(db=db, order=order, order_in=order_in)


def process_payment(db: Session, order: Order, payment_in: OrderPaymentUpdate) -> Order:
    """결제 완료 처리 (ORDERED → PAID)"""
    if order.order_status in ("CANCELLED", "UNPAID_CANCELLED"):
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


def _validate_cancellable(db: Session, order: Order, active_items: List[OrderItem]) -> None:
    """주문 취소 가능 여부 검증 (취소 상태, 배송 후 차단)"""
    if order.order_status in ("CANCELLED", "UNPAID_CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 주문입니다.",
        )
    for item in active_items:
        delivered = _count_delivered_issues(db, item.order_item_id)
        if delivered > 0:
            if item.product_kind == "YEARLY":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"YEARLY 상품 '{item.product_name}'이(가) 이미 배송된 회차가 있습니다. "
                        "배송 후 정기구독은 주문 취소가 아닌 구독 단축으로 처리해주세요."
                    ),
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"상품 '{item.product_name}'이(가) 배송 중이거나 배송 완료 상태입니다. 배송 후에는 취소할 수 없습니다.",
                )


def _calculate_item_refund(
    db: Session, item: OrderItem, order_status: str,
) -> OrderCancelItemDetail:
    """품목 하나의 환불 내역 계산"""
    if order_status == "ORDERED":
        return OrderCancelItemDetail(
            order_item_id=item.order_item_id,
            product_name=item.product_name,
            product_kind=item.product_kind,
            sale_price=item.sale_price,
            order_num=item.order_num,
            delivered_count=0,
            item_refund=0,
        )

    delivered_count = _count_delivered_issues(db, item.order_item_id)
    remaining = None
    total_period = None
    unit_price = None

    already_refunded = item.refund_amount or 0

    if delivered_count == 0:
        item_refund = item.sale_price * item.order_num - already_refunded
        if item.product_kind == "YEARLY":
            total_period = count_issue_diff(item.subscribe_start_issue, item.final_subscribe_end_issue) + 1
            remaining = total_period
            unit_price = item.sale_price // total_period if total_period > 0 else 0
    elif item.product_kind == "YEARLY":
        total_period = count_issue_diff(item.subscribe_start_issue, item.final_subscribe_end_issue) + 1
        remaining = total_period - delivered_count
        unit_price = item.sale_price // total_period if total_period > 0 else 0
        if remaining > 0:
            item_refund = unit_price * remaining * item.order_num
        else:
            item_refund = 0
            remaining = 0
    else:
        item_refund = 0

    return OrderCancelItemDetail(
        order_item_id=item.order_item_id,
        product_name=item.product_name,
        product_kind=item.product_kind,
        sale_price=item.sale_price,
        order_num=item.order_num,
        delivered_count=delivered_count,
        total_period=total_period,
        remaining_period=remaining,
        unit_price=unit_price,
        item_refund=item_refund,
    )


def cancel_calculate(db: Session, order: Order) -> OrderCancelCalculateResponse:
    """주문 취소 환불 계산 미리보기 (검증 + 순수 계산, DB 변경 없음)"""
    active_items: List[OrderItem] = db.query(OrderItem).filter(
        OrderItem.order_id == order.order_id,
        OrderItem.cancelled_at.is_(None),
    ).all()

    _validate_cancellable(db, order, active_items)

    item_details = [_calculate_item_refund(db, item, order.order_status) for item in active_items]
    subtotal = sum(d.item_refund for d in item_details)

    send_fee = (order.send_fee or 0) if order.order_status != "ORDERED" else 0
    total_refund = subtotal + send_fee

    return OrderCancelCalculateResponse(
        order_status=order.order_status,
        items=item_details,
        subtotal=subtotal,
        send_fee=send_fee,
        discount_amount=0,
        total_refund=total_refund,
        payment_amount=order.payment_amount,
    )


def cancel_order(db: Session, order: Order, cancel_request: OrderCancelRequest) -> Order:
    """주문 취소 — cancel_calculate로 검증 + 환불액 계산 후 취소 처리"""
    now = now_kst()

    # ── 1. 검증 + 환불액 계산 ─────────────────────────────────────────────────
    calc = cancel_calculate(db=db, order=order)

    if cancel_request.refund_amount is not None:
        total_refund = cancel_request.refund_amount
    else:
        total_refund = calc.total_refund

        # 환불금 검증 (주문 취소는 항상 전액 환불이므로 결제금과 일치해야 함)
        if order.order_status == "PAID" and total_refund != order.payment_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"환불금({total_refund:,}원)이 결제금({order.payment_amount:,}원)과 일치하지 않습니다. 관리자에게 문의하세요.",
            )

    # ── 2. 취소 사유 + 환불 계좌를 admin_memo에 추가 기록 ─────────────────────
    memo_lines = []
    if cancel_request.admin_memo.strip():
        memo_lines.append(f"[취소] {cancel_request.admin_memo.strip()}")
    else:
        memo_lines.append("[취소]")
    if cancel_request.refund_bank and cancel_request.refund_account:
        memo_lines.append(f"[취소 환불계좌] {cancel_request.refund_bank} {cancel_request.refund_account}")
    cancel_note = "\n".join(memo_lines)
    order.admin_memo = f"{order.admin_memo}\n---\n{cancel_note}" if order.admin_memo else cancel_note

    # ── 3. PREPARING Send 수술적 제거 ────────────────────────────────────────
    active_item_ids = [i.order_item_id for i in calc.items]
    send_service.delete_preparing_send_items_for_order_items(db, active_item_ids)

    # ── 4. 품목별 환불금 기록 + 일괄 취소 ───────────────────────────────────────
    for detail in calc.items:
        item = db.query(OrderItem).get(detail.order_item_id)
        already_refunded = item.refund_amount or 0
        item.refund_amount = already_refunded + detail.item_refund
        item.cancelled_at = now
    db.flush()

    # ── 5. 주문 취소 + 환불금 설정 ──────────────────────────────────────────
    # ORDERED(미결제) → UNPAID_CANCELLED, PAID(결제 후) → CANCELLED
    cancelled_status = "UNPAID_CANCELLED" if order.order_status == "ORDERED" else "CANCELLED"
    order_crud.set_order_status(
        db=db,
        order=order,
        order_status=cancelled_status,
        cancelled_at=now,
    )
    order.refund_amount = total_refund
    db.commit()
    db.refresh(order)
    return order


def recalculate_totals(db: Session, order: Order, update_payment: bool = False) -> Order:
    """주문 총액 재계산 (품목 변경 후 호출)
    - refund_amount: 전체 품목(취소 포함) 환불 합계 (항상 갱신)
    - total_amount, payment_amount: update_payment=True일 때만 갱신 (품목 추가/수정 시)
    """
    all_items = order_crud.read_order_items_by_order_id(
        db=db, order_id=order.order_id, include_cancelled=True
    )
    order.refund_amount = sum(item.refund_amount or 0 for item in all_items)
    if update_payment:
        order.total_amount = sum(item.sale_price * item.order_num for item in all_items)
        order.payment_amount = order.total_amount + (order.send_fee or 0)
    db.commit()
    db.refresh(order)
    return order


# ── 내부 헬퍼 ────────────────────────────────────────────────────────────────

def _has_blocking_send(db: Session, order_item_id: int) -> bool:
    """해당 품목에 DELIVERED Send가 존재하는지 확인"""
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
        Send.send_status == "DELIVERED",
    ).first() is not None


def _count_delivered_issues(db: Session, order_item_id: int) -> int:
    """해당 품목의 DELIVERED 상태 발송 건수 반환"""
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
            Send.send_status == "DELIVERED",
        )
        .count()
    )


