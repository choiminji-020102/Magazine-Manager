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
    OrderItemCancelCalculateResponse,
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


def recalculate_final_end_issue(db: Session, order_item: OrderItem) -> str:
    """핵심 공식: final_end = f(final_start, subscribe_period, pause)"""
    base_end = calculate_subscribe_end_issue(
        order_item.final_subscribe_start_issue,
        order_item.subscribe_period,
    )
    pause_count = _count_active_pauses(db, order_item.order_item_id)
    if pause_count > 0:
        return _add_months_to_issue(base_end, pause_count)
    return base_end


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

    # 1) subscribe_period 변경 → 공식으로 final_end 재계산
    extend_months = extend_in.extend_months
    order_item.subscribe_period += extend_months
    order_item.final_subscribe_end_issue = recalculate_final_end_issue(db, order_item)

    # 2) admin_memo에 연장 기록
    if extend_in.is_paid:
        memo_lines = [f"[유료 연장] {extend_months}개월"]
        if extend_in.paid_amount is not None:
            memo_lines[0] += f", 결제금액: {extend_in.paid_amount:,}원"
        if extend_in.refund_bank and extend_in.refund_account:
            memo_lines.append(f"[유료 연장 계좌] {extend_in.refund_bank} {extend_in.refund_account}")
        if extend_in.reason:
            memo_lines.append(f"사유: {extend_in.reason}")
    else:
        memo_lines = [f"[무상 연장] {extend_months}개월"]
        if extend_in.reason:
            memo_lines.append(f"사유: {extend_in.reason}")

    memo_note = "\n".join(memo_lines)
    order_item.admin_memo = f"{order_item.admin_memo}\n---\n{memo_note}" if order_item.admin_memo else memo_note

    # 3) 저장
    db.commit()
    db.refresh(order_item)
    return order_item


def batch_extend_subscription(
    db: Session,
    batch_in: SubscriptionBatchExtendRequest,
) -> SubscriptionBatchExtendResponse:
    """구독 기간 연장 (다건 일괄, 무상 연장만 지원)"""
    results: List[SubscriptionBatchExtendResultItem] = []

    for order_item_id in batch_in.order_item_ids:
        try:
            order_item = get_active_order_item_by_id(db, order_item_id)
            if order_item.product_kind != "YEARLY":
                raise ValueError("YEARLY 상품만 연장 가능합니다.")

            # 1) subscribe_period 변경 → 공식으로 final_end 재계산
            prev_end = order_item.final_subscribe_end_issue
            extend_months = batch_in.extend_months
            order_item.subscribe_period += extend_months
            order_item.final_subscribe_end_issue = recalculate_final_end_issue(db, order_item)

            # 2) 저장
            db.commit()
            db.refresh(order_item)

            results.append(SubscriptionBatchExtendResultItem(
                order_item_id=order_item_id,
                success=True,
                prev_end_issue=prev_end,
                new_end_issue=order_item.final_subscribe_end_issue,
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

    # final_subscribe_start_issue 변경 → 공식으로 final_end 재계산
    order_item.final_subscribe_start_issue = change_in.new_start_issue
    order_item.final_subscribe_end_issue = recalculate_final_end_issue(db, order_item)

    db.commit()
    db.refresh(order_item)
    return order_item


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
    shorten_months = shorten_in.shorten_months
    shorten_end = _subtract_months_from_issue(current_end, shorten_months)

    if shorten_end >= current_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"단축 종료 호({shorten_end})는 현재 종료 호({current_end})보다 작아야 합니다.",
        )

    # 이미 발송된 호보다 앞으로 단축 불가
    if order_item.last_send_issue and shorten_end < order_item.last_send_issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"단축 종료 호({shorten_end})가 마지막 발송 호({order_item.last_send_issue})보다 앞설 수 없습니다.",
        )

    paid_period = order_item.subscribe_period
    unit_price = order_item.sale_price // paid_period if paid_period > 0 else 0
    refund_amount = shorten_months * unit_price * order_item.order_num

    return SubscriptionShortenCalculateResponse(
        current_end_issue=current_end,
        shorten_end_issue=shorten_end,
        shorten_count=shorten_months,
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
    """구독 기간 단축 — 최종 확정 및 저장 (shorten_calculate로 검증)"""
    # shorten_calculate 재사용 (검증)
    shorten_months = confirm_in.shorten_months
    shorten_calculate(order_item, SubscriptionShortenCalculateRequest(
        shorten_months=shorten_months,
    ))

    # 1) subscribe_period 변경 → 공식으로 final_end 재계산
    refund_amount = confirm_in.refund_amount

    order_item.subscribe_period -= shorten_months
    order_item.final_subscribe_end_issue = recalculate_final_end_issue(db, order_item)
    order_item.refund_amount = (order_item.refund_amount or 0) + refund_amount

    # 2) admin_memo에 단축 기록
    memo_lines = [f"[단축] {shorten_months}개월, 환불: {refund_amount:,}원"]
    if confirm_in.reason:
        memo_lines.append(f"사유: {confirm_in.reason}")
    if confirm_in.refund_bank and confirm_in.refund_account:
        memo_lines.append(f"[단축 환불계좌] {confirm_in.refund_bank} {confirm_in.refund_account}")
    shorten_note = "\n".join(memo_lines)
    order_item.admin_memo = f"{order_item.admin_memo}\n---\n{shorten_note}" if order_item.admin_memo else shorten_note

    # 3) 저장
    db.commit()
    db.refresh(order_item)
    return order_item


# ── 취소 ──────────────────────────────────────────────────────────────────────

def cancel_item_calculate(
    db: Session, order_item: OrderItem,
) -> OrderItemCancelCalculateResponse:
    """품목 취소 환불 계산 미리보기 (DB 변경 없음)"""
    order_status = order_item.order.order_status

    # 이미 취소된 주문은 품목 취소 불가
    if order_status in ("CANCELLED", "UNPAID_CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 주문의 품목은 취소할 수 없습니다.",
        )

    # 배송 후 차단
    delivered_count = _count_delivered_issues(db, order_item.order_item_id)
    if delivered_count > 0:
        if order_item.product_kind == "YEARLY":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="배송이 시작된 YEARLY 상품은 품목 취소가 아닌 구독 단축으로 처리해주세요.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 배송이 시작된 상품은 취소할 수 없습니다.",
            )

    # 배송 전 → 전액 환불 (이미 환불된 금액 차감)
    already_refunded = order_item.refund_amount or 0
    if order_status == "ORDERED":
        refund_amount = 0
    else:
        full_refund = order_item.sale_price * order_item.order_num
        refund_amount = full_refund - already_refunded

    # 구독 기간 계산 (주문 취소/구독 단축과 동일한 공식)
    subscribe_period = _count_issue_diff(
        order_item.subscribe_start_issue, order_item.final_subscribe_end_issue
    ) + 1
    unit_price = order_item.sale_price // subscribe_period if subscribe_period > 0 else 0

    return OrderItemCancelCalculateResponse(
        order_status=order_status,
        product_kind=order_item.product_kind,
        sale_price=order_item.sale_price,
        order_num=order_item.order_num,
        subscribe_period=subscribe_period,
        delivered_count=0,
        remaining_count=1 if order_item.product_kind == "MONTHLY" else subscribe_period,
        unit_price=unit_price,
        refund_amount=refund_amount,
    )


def cancel_order_item(
    db: Session,
    order_item: OrderItem,
    cancel_in: OrderItemCancelRequest,
) -> OrderItem:
    """품목 취소 (배송 후 차단, 전액 환불, PREPARING Send 취소)"""
    # 이미 취소된 주문은 품목 취소 불가
    if order_item.order.order_status in ("CANCELLED", "UNPAID_CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 취소된 주문의 품목은 취소할 수 없습니다.",
        )

    send_items = _get_active_send_items(db, order_item.order_item_id)

    # 배송 후 취소 불가 (MONTHLY/YEARLY 모두)
    delivered_count = _count_delivered_issues(db, order_item.order_item_id)
    if delivered_count > 0:
        if order_item.product_kind == "YEARLY":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="배송이 시작된 YEARLY 상품은 품목 취소가 아닌 구독 단축으로 처리해주세요.",
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 배송이 시작된 상품은 취소할 수 없습니다.",
            )

    # 환불액 계산 (배송 전이므로 전액 환불 — 이미 환불된 금액 차감)
    already_refunded = order_item.refund_amount or 0
    if order_item.order.order_status == "ORDERED":
        refund_amount = 0
    elif cancel_in.refund_amount is not None:
        refund_amount = cancel_in.refund_amount
    else:
        full_refund = order_item.sale_price * order_item.order_num
        refund_amount = full_refund - already_refunded

    # PREPARING Send 취소
    now = now_kst()
    for si in send_items:
        if si.send.send_status == "PREPARING":
            si.send.send_status = "CANCELLED"
            si.send.cancelled_at = now
            si.cancelled_at = now

    # admin_memo append
    memo_lines = []
    if cancel_in.admin_memo.strip():
        memo_lines.append(f"[취소] {cancel_in.admin_memo.strip()}")
    else:
        memo_lines.append("[취소]")
    if cancel_in.refund_bank and cancel_in.refund_account:
        memo_lines.append(f"[취소 환불계좌] {cancel_in.refund_bank} {cancel_in.refund_account}")
    cancel_note = "\n".join(memo_lines)
    order_item.admin_memo = f"{order_item.admin_memo}\n---\n{cancel_note}" if order_item.admin_memo else cancel_note

    order_item.refund_amount = already_refunded + refund_amount

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
