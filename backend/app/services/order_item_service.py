# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import calculate_subscribe_end_issue, count_issue_diff, now_kst
from app.crud import order_item as order_item_crud
from app.models.address import Address
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.pause import Pause
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.order_item import (
    OrderItemAddressUpdate,
    OrderItemAddressUpdateResponse,
    OrderItemCancelRequest,
    OrderItemCreate,
    OrderItemListQuery,
    OrderItemUpdate,
    OrderItemPostalCode13113Query,
    SubscriptionBatchExtendRequest,
    SubscriptionBatchExtendResponse,
    SubscriptionBatchExtendResultItem,
    SubscriptionChangePeriodRequest,
    SubscriptionExtendRequest,
    SubscriptionListItem,
    SubscriptionShortenCalculateRequest,
    SubscriptionShortenCalculateResponse,
    SubscriptionShortenConfirmRequest,
)
from app.schemas.dispatch import DispatchTarget
from app.services import address_service


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────

_count_issue_diff = count_issue_diff  # 기존 내부 호출 호환


def _add_months_to_issue(issue: str, months: int) -> str:
    """호(YYYYMM)에 N개월 추가"""
    return calculate_subscribe_end_issue(issue, months + 1)


def _count_active_pauses(db: Session, order_item_id: int) -> int:
    return db.query(Pause).filter(
        Pause.order_item_id == order_item_id,
        Pause.deleted_at.is_(None),
    ).count()


def _get_active_send_items(db: Session, order_item_id: int) -> List[SendItem]:
    """취소되지 않은 SendItem 목록"""
    return (
        db.query(SendItem)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.order_item_id == order_item_id,
            SendItem.cancelled_at.is_(None),
            Send.cancelled_at.is_(None),
        )
        .all()
    )


# ── 조회 ──────────────────────────────────────────────────────────────────────

def get_order_item_by_id(db: Session, order_item_id: int) -> OrderItem:
    """주문 품목 조회 (취소된 것 포함)"""
    return order_item_crud.read_order_item_by_id(db=db, order_item_id=order_item_id)


def get_active_order_item_by_id(db: Session, order_item_id: int) -> OrderItem:
    """활성 주문 품목 조회 (취소 제외)"""
    return order_item_crud.read_active_order_item_by_id(db=db, order_item_id=order_item_id)


def get_order_items_by_order(db: Session, order_id: int) -> List[OrderItem]:
    """주문별 품목 목록 (취소된 것 포함)"""
    return order_item_crud.read_order_items_by_order_id(db=db, order_id=order_id, include_cancelled=True)


def get_non_deleted_pauses(db: Session, order_item_id: int) -> List[Pause]:
    """품목의 비삭제 휴지 목록"""
    return (
        db.query(Pause)
        .filter(
            Pause.order_item_id == order_item_id,
            Pause.deleted_at.is_(None),
        )
        .order_by(Pause.pause_issue)
        .all()
    )


def list_order_items(
    db: Session, query: OrderItemListQuery
) -> Tuple[List[SubscriptionListItem], int]:
    """구독 목록 조회 (고객 정보 포함)"""
    rows, total = order_item_crud.list_order_items(
        db,
        page=query.page,
        limit=query.limit,
        product_kind=query.product_kind,
        product_code=query.product_code,
        customer_search=query.customer_search,
        is_cancelled=query.is_cancelled,
        end_issue_from=query.end_issue_from,
        end_issue_to=query.end_issue_to,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )
    items = []
    for order_item, customer_name, customer_phone, order_channel in rows:
        item = SubscriptionListItem.model_validate(order_item)
        item.customer_name = customer_name
        item.customer_phone = customer_phone
        item.order_channel = order_channel
        items.append(item)
    return items, total


def list_postal_code_13113(
    db: Session, query: OrderItemPostalCode13113Query
) -> Tuple[List[OrderItem], int]:
    """우편번호 13113 품목 목록"""
    return order_item_crud.list_by_postal_code_13113(
        db=db,
        page=query.page,
        limit=query.limit,
        product_kind=query.product_kind,
        is_cancelled=query.is_cancelled,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


# ── 생성 / 수정 ───────────────────────────────────────────────────────────────

def create_order_item(db: Session, item_in: OrderItemCreate) -> OrderItem:
    """독립 품목 추가 (이미 존재하는 주문에)"""
    product = db.query(Product).filter(Product.product_code == item_in.product_code).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"상품을 찾을 수 없습니다: {item_in.product_code}",
        )

    order = db.query(Order).filter(Order.order_id == item_in.order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"주문을 찾을 수 없습니다: {item_in.order_id}",
        )

    address = db.query(Address).filter(Address.address_id == item_in.address_id).first()
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"배송지를 찾을 수 없습니다: {item_in.address_id}",
        )

    list_price = product.list_price
    sale_price = item_in.sale_price if item_in.sale_price is not None else product.sale_price
    subscribe_period = item_in.subscribe_period

    subscribe_end_issue = calculate_subscribe_end_issue(item_in.subscribe_start_issue, subscribe_period)

    return order_item_crud.create_order_item(
        db=db,
        order_id=item_in.order_id,
        address_id=item_in.address_id,
        product_code=product.product_code,
        product_kind=product.product_kind,
        product_name=product.product_name,
        list_price=list_price,
        sale_price=sale_price,
        subscribe_start_issue=item_in.subscribe_start_issue,
        subscribe_end_issue=subscribe_end_issue,
        final_subscribe_start_issue=item_in.subscribe_start_issue,
        final_subscribe_end_issue=subscribe_end_issue,
        subscribe_period=subscribe_period,
        order_num=item_in.order_num,
        admin_memo=item_in.admin_memo,
        external_order_item_id=item_in.external_order_item_id,
    )


def update_order_item(db: Session, order_item: OrderItem, item_in: OrderItemUpdate) -> OrderItem:
    """품목 수정"""
    return order_item_crud.update_order_item(db=db, order_item=order_item, order_item_in=item_in)


# ── 배송지 변경 ───────────────────────────────────────────────────────────────

def update_address(
    db: Session,
    order_item: OrderItem,
    address_in: OrderItemAddressUpdate,
) -> OrderItemAddressUpdateResponse:
    """배송지 변경 (날짜/배송 상태 기반 제한 포함)"""
    # 새 배송지 결정
    if address_in.address_id:
        new_address = db.query(Address).filter(Address.address_id == address_in.address_id).first()
        if not new_address:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="배송지를 찾을 수 없습니다.",
            )
    else:
        # customer_id를 order에서 자동 주입 (프론트에서 누락 방지)
        order = db.query(Order).filter(Order.order_id == order_item.order_id).first()
        new_address_data = address_in.new_address.model_copy(
            update={"customer_id": order.customer_id}
        )
        new_address, _ = address_service.find_or_create_address(db, new_address_data)

    new_address_id = new_address.address_id

    # 활성 SendItem 조회
    send_items = _get_active_send_items(db, order_item.order_item_id)

    already_shipped_issues: List[str] = []
    pending_issues: List[str] = []
    pending_send_ids: set = set()

    for si in send_items:
        if si.send.send_status in ("SHIPPING", "DELIVERED"):
            already_shipped_issues.append(si.issue)
        else:
            pending_issues.append(si.issue)
            pending_send_ids.add(si.send_id)

    if not pending_issues and already_shipped_issues:
        return OrderItemAddressUpdateResponse(
            can_change=False,
            already_shipped_issues=sorted(set(already_shipped_issues)),
            pending_issues=[],
            message="이미 배송이 시작되었거나 배송 예정일이 지나 배송지를 변경할 수 없습니다.",
        )

    # 품목 배송지 변경
    order_item.address_id = new_address_id

    # PREPARING Send 스냅샷 동기화
    if pending_send_ids:
        sends = db.query(Send).filter(Send.send_id.in_(pending_send_ids)).all()
        for send in sends:
            if send.send_status == "PREPARING":
                send.address_id = new_address_id
                send.recipient_name = new_address.recipient_name
                send.recipient_phone = new_address.recipient_phone
                send.country_code = new_address.country_code or "KR"
                send.postal_code = new_address.postal_code
                send.recipient_address = new_address.recipient_address
                send.customer_memo = new_address.customer_memo

    db.commit()
    db.refresh(order_item)

    return OrderItemAddressUpdateResponse(
        can_change=True,
        changed_address_id=new_address_id,
        already_shipped_issues=sorted(set(already_shipped_issues)),
        pending_issues=sorted(set(pending_issues)),
        message="배송지가 변경되었습니다.",
    )


# ── 구독 기간 조정 ────────────────────────────────────────────────────────────

def extend_subscription(
    db: Session,
    order_item: OrderItem,
    extend_in: SubscriptionExtendRequest,
) -> OrderItem:
    """구독 기간 연장 (단건, YEARLY만 가능)"""
    if order_item.product_kind != "YEARLY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="YEARLY 상품만 구독 기간 연장이 가능합니다.",
        )
    if order_item.cancelled_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="취소된 주문 품목은 연장할 수 없습니다.",
        )

    current_end = order_item.final_subscribe_end_issue

    if extend_in.extend_months:
        extend_months = extend_in.extend_months
        new_end = _add_months_to_issue(current_end, extend_months)
    else:
        new_end = extend_in.extend_end_issue
        if new_end <= current_end:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"연장 종료 호({new_end})는 현재 종료 호({current_end})보다 커야 합니다.",
            )
        extend_months = _count_issue_diff(current_end, new_end)

    return order_item_crud.extend_subscription(
        db=db, order_item=order_item, new_end_issue=new_end,
        extend_months=extend_months, update_paid=extend_in.is_paid,
    )


def batch_extend_subscription(
    db: Session,
    batch_in: SubscriptionBatchExtendRequest,
) -> SubscriptionBatchExtendResponse:
    """구독 기간 연장 (다건 일괄)"""
    results: List[SubscriptionBatchExtendResultItem] = []

    for order_item_id in batch_in.order_item_ids:
        try:
            order_item = order_item_crud.read_active_order_item_by_id(
                db=db, order_item_id=order_item_id
            )
            if order_item.product_kind != "YEARLY":
                raise ValueError("YEARLY 상품만 연장 가능합니다.")

            prev_end = order_item.final_subscribe_end_issue
            new_end = _add_months_to_issue(prev_end, batch_in.extend_months)
            # 일괄 연장은 무상 연장만 지원
            order_item_crud.extend_subscription(
                db=db, order_item=order_item, new_end_issue=new_end,
                extend_months=batch_in.extend_months, update_paid=False,
            )

            results.append(SubscriptionBatchExtendResultItem(
                order_item_id=order_item_id,
                success=True,
                prev_end_issue=prev_end,
                new_end_issue=new_end,
            ))
        except Exception as e:
            results.append(SubscriptionBatchExtendResultItem(
                order_item_id=order_item_id,
                success=False,
                error=str(e),
            ))

    success_count = sum(1 for r in results if r.success)
    return SubscriptionBatchExtendResponse(
        total_requested=len(batch_in.order_item_ids),
        success_count=success_count,
        fail_count=len(results) - success_count,
        results=results,
    )


def change_period(
    db: Session,
    order_item: OrderItem,
    change_in: SubscriptionChangePeriodRequest,
) -> OrderItem:
    """구독 기간 이동 (앞당기기/밀기, YEARLY만)"""
    if order_item.product_kind != "YEARLY":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="YEARLY 상품만 구독 기간 이동이 가능합니다.",
        )

    new_start = change_in.new_start_issue
    base_end = calculate_subscribe_end_issue(new_start, order_item.subscribe_period)

    # 활성 휴지 개수만큼 종료 호 연장
    pause_count = _count_active_pauses(db, order_item.order_item_id)
    new_end = _add_months_to_issue(base_end, pause_count) if pause_count > 0 else base_end

    return order_item_crud.change_period(
        db=db, order_item=order_item, new_start_issue=new_start, new_end_issue=new_end
    )


def _subtract_months_from_issue(issue: str, months: int) -> str:
    """호(YYYYMM)에서 N개월을 뺀 호 반환"""
    y = int(issue[:4])
    m = int(issue[4:6])
    total = y * 12 + m - months
    new_y = (total - 1) // 12
    new_m = ((total - 1) % 12) + 1
    return f"{new_y}{str(new_m).zfill(2)}"


def shorten_calculate(
    order_item: OrderItem,
    shorten_in: SubscriptionShortenCalculateRequest,
) -> SubscriptionShortenCalculateResponse:
    """구독 기간 단축 — 환불액 계산 (DB 변경 없음)"""
    current_end = order_item.final_subscribe_end_issue

    # shorten_months → shorten_end_issue 변환
    if shorten_in.shorten_months and not shorten_in.shorten_end_issue:
        shorten_end = _subtract_months_from_issue(current_end, shorten_in.shorten_months)
    elif shorten_in.shorten_end_issue:
        shorten_end = shorten_in.shorten_end_issue
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="shorten_end_issue 또는 shorten_months 중 하나가 필요합니다.",
        )

    if shorten_end >= current_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"단축 종료 호({shorten_end})는 현재 종료 호({current_end})보다 작아야 합니다.",
        )

    if not order_item.paid_subscribe_end_issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유료 구독 종료 호가 설정되지 않았습니다.",
        )

    shorten_count = _count_issue_diff(shorten_end, current_end)
    paid_period = _count_issue_diff(order_item.subscribe_start_issue, order_item.paid_subscribe_end_issue) + 1
    unit_price = int(order_item.sale_price / paid_period)
    refund_amount = int(shorten_count * unit_price * order_item.order_num)

    return SubscriptionShortenCalculateResponse(
        current_end_issue=current_end,
        shorten_end_issue=shorten_end,
        shorten_count=shorten_count,
        paid_period=paid_period,
        unit_price=unit_price,
        sale_price=order_item.sale_price,
        order_num=order_item.order_num,
        refund_amount=refund_amount,
    )


def shorten_confirm(
    db: Session,
    order_item: OrderItem,
    confirm_in: SubscriptionShortenConfirmRequest,
) -> OrderItem:
    """구독 기간 단축 — 최종 확정 및 저장 (shorten_calculate 재사용)"""
    if not confirm_in.refund_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="환불 확인이 필요합니다. refund_confirmed=true로 전송해주세요.",
        )

    # shorten_calculate 재사용 (검증 + 환불 계산 로직 단일화)
    calc = shorten_calculate(order_item, SubscriptionShortenCalculateRequest(
        shorten_end_issue=confirm_in.shorten_end_issue,
    ))

    # 환불 계좌 admin_memo에 기록
    if confirm_in.refund_bank and confirm_in.refund_account:
        refund_note = f"[단축 환불계좌] {confirm_in.refund_bank} {confirm_in.refund_account}"
        order_item.admin_memo = f"{order_item.admin_memo}\n{refund_note}" if order_item.admin_memo else refund_note

    return order_item_crud.shorten_subscription(
        db=db,
        order_item=order_item,
        shorten_end_issue=confirm_in.shorten_end_issue,
        refund_amount=calc.refund_amount,
    )


# ── 취소 ──────────────────────────────────────────────────────────────────────

def cancel_order_item(
    db: Session,
    order_item: OrderItem,
    cancel_in: OrderItemCancelRequest,
) -> OrderItem:
    """품목 취소 (MONTHLY 배송 후 차단, 환불액 자동 계산, PREPARING Send 취소)"""
    send_items = _get_active_send_items(db, order_item.order_item_id)

    # MONTHLY: SHIPPING/DELIVERED 존재 시 취소 불가
    if order_item.product_kind == "MONTHLY":
        blocking = [si for si in send_items if si.send.send_status in ("SHIPPING", "DELIVERED")]
        if blocking:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 배송이 시작된 MONTHLY 상품은 취소할 수 없습니다.",
            )

    # 환불액 계산 (결제 전 취소: 돈을 받지 않았으므로 환불금 0)
    if order_item.order.order_status == "ORDERED":
        refund_amount = 0
    elif cancel_in.refund_amount is not None:
        refund_amount = cancel_in.refund_amount
    elif order_item.product_kind == "MONTHLY":
        refund_amount = order_item.sale_price * order_item.order_num
    elif order_item.product_kind == "YEARLY" and order_item.paid_subscribe_end_issue:
        # YEARLY: paid_subscribe_end_issue 기준으로 잔여 환불 회차 계산
        # - 무상 연장 회차는 paid_subscribe_end_issue에 반영 안 됨 → 자동 제외
        # - 유료 연장 회차는 paid_subscribe_end_issue에 반영 됨 → 자동 포함
        paid_end = order_item.paid_subscribe_end_issue
        if order_item.last_send_issue:
            remaining = _count_issue_diff(order_item.last_send_issue, paid_end)
        else:
            remaining = _count_issue_diff(order_item.subscribe_start_issue, paid_end) + 1

        contracted_months = _count_issue_diff(order_item.subscribe_start_issue, paid_end) + 1
        if remaining > 0 and contracted_months > 0:
            refund_per_issue = order_item.sale_price // contracted_months
            refund_amount = refund_per_issue * remaining * order_item.order_num
        else:
            refund_amount = 0
    else:
        refund_amount = 0

    # PREPARING Send 취소
    now = now_kst()
    for si in send_items:
        if si.send.send_status == "PREPARING":
            si.send.send_status = "CANCELLED"
            si.send.cancelled_at = now
            si.cancelled_at = now

    # admin_memo append
    reason_memo = f"[취소] {cancel_in.admin_memo}"
    if order_item.admin_memo:
        order_item.admin_memo = order_item.admin_memo + "\n" + reason_memo
    else:
        order_item.admin_memo = reason_memo

    order_item.refund_amount = refund_amount

    return order_item_crud.cancel_order_item(db=db, order_item=order_item)


# ── 마지막 발송 호 ────────────────────────────────────────────────────────────

def update_last_send_issue(db: Session, order_item: OrderItem, issue: str) -> OrderItem:
    """마지막 발송 호 업데이트"""
    return order_item_crud.update_last_send_issue(db=db, order_item=order_item, issue=issue)


# ── Dispatch 대상 조회 ────────────────────────────────────────────────────────

def convert_to_send_product_code(product_code: str, product_kind: str, issue: str) -> str:
    """주문품목 product_code를 발송용 코드로 변환 (YEARLY: base+YYYYMM → base-{issue})"""
    if product_kind == "YEARLY" and "+" in product_code:
        base_code = product_code.split("+")[0]
        return f"{base_code}-{issue}"
    return product_code


def find_subscription_targets(
    db: Session,
    issue: str,
    product_kind: Optional[str] = None,
    product_code: Optional[str] = None,
    base_code: Optional[str] = None,
    postal_code: Optional[str] = None,
) -> List[DispatchTarget]:
    """발송 대상 품목 조회 (YEARLY/MONTHLY, 취소·휴지·발송완료 제외)"""
    pause_subquery = (
        db.query(Pause.order_item_id)
        .filter(Pause.pause_issue == issue, Pause.deleted_at.is_(None))
        .subquery()
    )

    # 이미 해당 issue로 활성 SendItem이 존재하는 order_item_id 제외
    already_sent_subquery = (
        db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.issue == issue,
            SendItem.cancelled_at.is_(None),
            Send.cancelled_at.is_(None),
        )
        .subquery()
    )

    # product_kind 지정 시 해당 종류만, 미지정 시 YEARLY+MONTHLY 모두
    if product_kind:
        kind_filter = OrderItem.product_kind == product_kind
    else:
        kind_filter = OrderItem.product_kind.in_(["YEARLY", "MONTHLY"])

    query = (
        db.query(
            OrderItem,
            Order.customer_id,
            Order.order_channel,
            Customer.customer_name,
            Customer.customer_phone,
            Address.recipient_name,
            Address.recipient_phone,
            Address.country_code,
            Address.postal_code,
            Address.recipient_address,
            Address.customer_memo,
        )
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(Customer, Order.customer_id == Customer.customer_id)
        .outerjoin(Address, OrderItem.address_id == Address.address_id)
        .filter(
            kind_filter,
            Order.order_status == "PAID",
            OrderItem.cancelled_at.is_(None),
            OrderItem.final_subscribe_start_issue <= issue,
            OrderItem.final_subscribe_end_issue >= issue,
            or_(
                OrderItem.last_send_issue.is_(None),
                OrderItem.last_send_issue < issue,
            ),
            ~OrderItem.order_item_id.in_(pause_subquery),
            ~OrderItem.order_item_id.in_(already_sent_subquery),
        )
    )

    if product_code:
        query = query.filter(OrderItem.product_code == product_code)
    if base_code:
        query = query.filter(OrderItem.product_code.like(f"{base_code}%"))
    if postal_code:
        query = query.filter(Address.postal_code == postal_code)

    results = query.order_by(Customer.customer_name.asc()).all()

    targets = []
    for row in results:
        (
            item, _customer_id, _order_channel, _customer_name, _customer_phone,
            recipient_name, recipient_phone, country_code, postal_code, recipient_address, customer_memo,
        ) = row

        targets.append(DispatchTarget(
            order_item_id=item.order_item_id,
            order_id=item.order_id,
            product_code=item.product_code,
            product_kind=item.product_kind,
            product_name=item.product_name,
            order_num=item.order_num,
            subscribe_start_issue=item.subscribe_start_issue,
            final_subscribe_end_issue=item.final_subscribe_end_issue,
            last_send_issue=item.last_send_issue,
            address_id=item.address_id,
            recipient_name=recipient_name,
            recipient_phone=recipient_phone,
            country_code=country_code,
            postal_code=postal_code,
            recipient_address=recipient_address,
            customer_memo=customer_memo,
        ))

    return targets
