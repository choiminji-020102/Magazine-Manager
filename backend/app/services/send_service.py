# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import now_kst, parse_subscribe_start_issue
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.send import SendListQuery, SendStatusUpdate, SendUpdate
from app.crud import send as send_crud
from app.services import send_item_service
from app.services.dispatch_grouping_service import (
    SendGroup,
    get_paid_order_items_for_dispatch,
    group_monthly_for_send,
    group_yearly_for_send,
)
from app.services.order_item_service import convert_to_send_product_code


# ── 헬퍼 ──────────────────────────────────────────────────────────────────────

def derive_courier_company(send_method: Optional[str]) -> Optional[str]:
    """발송 방법(send_method)으로부터 운송사(courier_company)를 자동 도출.

    - 기출유택배 → CJ대한통운 (외부 위탁 택배)
    - 그 외(기출유우편/일반우편/찾아가기) → 자체배송
    - send_method 없음 → None

    운영자가 Send 본체에서 수동으로 다른 값으로 수정할 수 있다.
    """
    if send_method is None:
        return None
    if send_method == "기출유택배":
        return "CJ대한통운"
    return "자체배송"


# ── PREPARING Send 생성 ────────────────────────────────────────────────────────

def create_preparing_sends_from_groups(
    db: Session,
    groups: List[SendGroup],
    issue: Optional[str] = None,
) -> List[Send]:
    """그룹 리스트를 받아 Send + SendItem을 PREPARING 상태로 일괄 생성.

    - send_method, courier_company, tracking_no 모두 NULL (실제 배송중 전환 시점에 결정)
    - YEARLY 그룹: 입력 issue 필수. SendItem.product_code는 convert_to_send_product_code로 변환,
      SendItem.issue는 입력 issue 사용
    - MONTHLY 그룹: issue 없이도 동작. SendItem.product_code는 OrderItem.product_code 그대로,
      SendItem.issue는 parse_subscribe_start_issue(product_code)로 도출
    - OrderItem.last_send_issue는 갱신하지 않음 (PREPARING은 아직 발송 전)

    호출자(엔드포인트)가 db.commit() 책임.
    """
    if not groups:
        return []

    # 그룹들에 포함된 모든 OrderItem ID·Product code 일괄 조회 + upfront 검증
    all_order_item_ids: List[int] = []
    for group in groups:
        all_order_item_ids.extend(group.order_item_ids)

    order_items = (
        db.query(OrderItem)
        .filter(OrderItem.order_item_id.in_(all_order_item_ids))
        .all()
    )
    order_items_by_id = {oi.order_item_id: oi for oi in order_items}

    missing_oi_ids = set(all_order_item_ids) - set(order_items_by_id.keys())
    if missing_oi_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OrderItem을 찾을 수 없습니다: {sorted(missing_oi_ids)}",
        )

    product_codes = {oi.product_code for oi in order_items}
    products = db.query(Product).filter(Product.product_code.in_(product_codes)).all()
    products_by_code = {p.product_code: p for p in products}

    missing_product_codes = product_codes - set(products_by_code.keys())
    if missing_product_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"상품을 찾을 수 없습니다: {sorted(missing_product_codes)}",
        )

    has_yearly = any(oi.product_kind == "YEARLY" for oi in order_items)
    if has_yearly and not issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="YEARLY OrderItem 발송 생성 시 issue가 필요합니다.",
        )

    created_sends: List[Send] = []

    for group in groups:
        send = Send(
            address_id=group.address_id,
            send_status="PREPARING",
            send_method=None,
            courier_company=None,
            tracking_no=None,
            recipient_name=group.recipient_name,
            recipient_phone=group.recipient_phone,
            country_code=group.country_code,
            postal_code=group.postal_code,
            recipient_address=group.recipient_address,
            customer_memo=group.customer_memo,
        )
        db.add(send)
        db.flush()  # send_id 확보

        for order_item_id in group.order_item_ids:
            order_item = order_items_by_id[order_item_id]
            product = products_by_code[order_item.product_code]

            # 종류별 product_code·issue 결정
            if order_item.product_kind == "YEARLY":
                send_item_product_code = convert_to_send_product_code(
                    product.product_code, "YEARLY", issue
                )
                send_item_issue = issue
            else:  # MONTHLY
                send_item_product_code = order_item.product_code
                send_item_issue = parse_subscribe_start_issue(order_item.product_code)
                if not send_item_issue:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"MONTHLY product_code에서 호 파싱 실패: {order_item.product_code}",
                    )

            send_item = SendItem(
                send_id=send.send_id,
                order_item_id=order_item.order_item_id,
                product_code=send_item_product_code,
                product_name=product.product_name,
                issue=send_item_issue,
                send_num=order_item.order_num,
                cost_price=product.cost_price or 0,
                unit_weight=float(product.unit_weight) if product.unit_weight is not None else None,
                unit_width=float(product.unit_width) if product.unit_width is not None else None,
                unit_length=float(product.unit_length) if product.unit_length is not None else None,
                unit_height=float(product.unit_height) if product.unit_height is not None else None,
            )
            db.add(send_item)

        created_sends.append(send)

    db.flush()
    return created_sends


# ── SHIPPING 전환 ─────────────────────────────────────────────────────────────

def transition_send_to_shipping(
    db: Session,
    send: Send,
    send_method: str,
    courier_company: str,
    tracking_no: str,
) -> Send:
    """단일 PREPARING Send를 SHIPPING으로 전환.

    - send_method, courier_company, tracking_no 모두 필수
    - shipped_at = now_kst()
    - YEARLY Send: 연관 OrderItem.last_send_issue를 SendItem.issue 기준 max로 갱신
    - MONTHLY Send: last_send_issue 갱신 안 함

    호출자(엔드포인트)가 db.commit() 책임.
    """
    if send.send_status != "PREPARING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PREPARING 상태에서만 SHIPPING으로 전환 가능합니다. 현재: {send.send_status}",
        )
    if not send_method or not courier_company or not tracking_no:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="send_method, courier_company, tracking_no 모두 필수입니다.",
        )

    send.send_status = "SHIPPING"
    send.send_method = send_method
    send.courier_company = courier_company
    send.tracking_no = tracking_no
    send.shipped_at = now_kst()

    # YEARLY 여부 판정 후 last_send_issue 갱신
    send_items = (
        db.query(SendItem)
        .filter(SendItem.send_id == send.send_id, SendItem.cancelled_at.is_(None))
        .all()
    )
    if send_items:
        order_item_ids = [si.order_item_id for si in send_items]
        order_items = (
            db.query(OrderItem)
            .filter(OrderItem.order_item_id.in_(order_item_ids))
            .all()
        )
        order_items_by_id = {oi.order_item_id: oi for oi in order_items}

        # 그룹핑 함수가 같은 종류만 한 Send에 묶도록 보장하므로 첫 OrderItem 기준으로 판정
        is_yearly = bool(order_items) and order_items[0].product_kind == "YEARLY"

        if is_yearly:
            for si in send_items:
                oi = order_items_by_id.get(si.order_item_id)
                if oi is None:
                    continue
                if not oi.last_send_issue or si.issue > oi.last_send_issue:
                    oi.last_send_issue = si.issue

    db.flush()
    return send


def transition_sends_to_shipping_batch(
    db: Session,
    sends_input: List[Tuple[int, str]],
    send_method: str,
    courier_company: str,
) -> int:
    """선택된 PREPARING Send들을 일괄 SHIPPING 전환. 전환된 Send 수 반환.

    sends_input: (send_id, tracking_no) 페어 리스트. 박스마다 운송장 다를 수 있음. tracking_no 모두 필수.
    send_method, courier_company는 모든 Send에 공통 적용.

    Upfront 검증: 모든 Send가 존재하고 PREPARING 상태여야 함.
    한 건이라도 실패 시 HTTPException 400으로 전체 거부 (all-or-nothing).
    호출자가 db.commit() + 활동 로그 책임.
    """
    send_ids = [sid for sid, _ in sends_input]
    tracking_by_id = dict(sends_input)

    sends = db.query(Send).filter(Send.send_id.in_(send_ids)).all()
    sends_by_id = {s.send_id: s for s in sends}

    missing = sorted(set(send_ids) - set(sends_by_id.keys()))
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"존재하지 않는 발송: {missing}. 페이지를 새로고침한 후 다시 시도해주세요.",
        )

    non_preparing = [s.send_id for s in sends if s.send_status != "PREPARING"]
    if non_preparing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PREPARING 상태가 아닌 발송이 포함되어 있습니다: {non_preparing}. 페이지를 새로고침한 후 다시 시도해주세요.",
        )

    for send in sends:
        transition_send_to_shipping(
            db=db,
            send=send,
            send_method=send_method,
            courier_company=courier_company,
            tracking_no=tracking_by_id[send.send_id],
        )

    return len(sends)


# ── [발송 생성] 오케스트레이션 ─────────────────────────────────────────────────

def regenerate_preparing_sends(
    db: Session,
    scope: str,
    issue: Optional[str],
) -> Tuple[int, int]:
    """[발송 생성] 오케스트레이션. (deleted_count, created_count) 반환.

    1. scope에 따라 기존 PREPARING Send 일괄 삭제
    2. PAID OrderItem 조회
    3. scope에 따라 종류별 그룹핑 (issue 사용)
    4. PREPARING Send + SendItem 생성

    호출자(엔드포인트)가 db.commit() + 활동 로그 기록 책임.
    """
    if scope not in ("monthly", "yearly"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"잘못된 scope: {scope}. 'monthly' 또는 'yearly'여야 합니다.",
        )

    if scope == "yearly" and not issue:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="정기구독(YEARLY) 발송 생성 시 issue를 입력해야 합니다.",
        )

    # 1. 삭제
    deleted_count = send_crud.delete_preparing_sends(db=db, scope=scope)

    # 2. PAID OrderItem 조회
    yearly_items, monthly_items = get_paid_order_items_for_dispatch(db)

    # 3. 그룹핑
    groups: List[SendGroup] = []
    if scope == "monthly":
        monthly_ids = [oi.order_item_id for oi in monthly_items]
        groups.extend(group_monthly_for_send(db, monthly_ids))
    else:  # yearly
        yearly_ids = [oi.order_item_id for oi in yearly_items]
        groups.extend(group_yearly_for_send(db, yearly_ids, issue))

    # 4. PREPARING Send 생성
    created_sends = create_preparing_sends_from_groups(db, groups, issue=issue)

    return deleted_count, len(created_sends)


# ── 조회 ──────────────────────────────────────────────────────────────────────

def get_send_by_id(db: Session, send_id: int) -> Send:
    return send_crud.read_send_by_id(db=db, send_id=send_id)


def list_sends(db: Session, query: SendListQuery) -> Tuple[List[Send], int]:
    return send_crud.list_sends(db=db, query=query)


def get_sends_by_order(db: Session, order_id: int) -> List[Send]:
    return send_crud.read_sends_by_order_id(db=db, order_id=order_id)


def get_send_items(db: Session, send_id: int) -> List[SendItem]:
    return send_item_service.get_send_items_by_send(db=db, send_id=send_id)


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


def update_tracking(
    db: Session,
    send: Send,
    tracking_no: Optional[str] = None,
    send_method: Optional[str] = None,
    courier_company: Optional[str] = None,
) -> Send:
    """SHIPPING/DELIVERED Send의 운송장/배송업체/배송방법 수정.

    상태 검증: SHIPPING/DELIVERED만 허용 (PREPARING/CANCELLED 거부).
    상태 전환은 동반하지 않음 (필드 수정만).
    """
    if send.send_status not in ("SHIPPING", "DELIVERED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"운송장 수정은 SHIPPING/DELIVERED 상태에서만 가능합니다. 현재 상태: {send.send_status}",
        )
    return send_crud.update_tracking(
        db=db,
        send=send,
        tracking_no=tracking_no,
        send_method=send_method,
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


def delete_preparing_send_items_for_order_items(
    db: Session, order_item_ids: List[int]
) -> Tuple[int, int]:
    """주문/품목 취소 시 PREPARING Send에 묶인 SendItem 수술적 제거.

    - PREPARING Send에 속한 SendItem만 DELETE (cancelled_at 무관 — 미아 SendItem 방지)
    - 잔여 SendItem 0개 PREPARING Send도 함께 DELETE
    - 다른 PREPARING Send는 안 건드림 (send_id 유지)
    - SHIPPING/DELIVERED/CANCELLED Send는 호출 전 _validate_cancellable 등에서 차단됨
    - commit/refresh는 호출자가 담당 (db.flush만 수행)

    Returns: (deleted_send_items_count, deleted_sends_count)
    """
    if not order_item_ids:
        return (0, 0)

    send_items = (
        db.query(SendItem)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.order_item_id.in_(order_item_ids),
            Send.send_status == "PREPARING",
        )
        .all()
    )
    if not send_items:
        return (0, 0)

    affected_send_ids = {si.send_id for si in send_items}
    deleted_send_items_count = len(send_items)

    for si in send_items:
        db.delete(si)
    db.flush()

    deleted_sends_count = 0
    for sid in affected_send_ids:
        remaining = db.query(SendItem).filter(SendItem.send_id == sid).count()
        if remaining == 0:
            send = db.query(Send).get(sid)
            if send is not None:
                db.delete(send)
                deleted_sends_count += 1
    db.flush()

    return (deleted_send_items_count, deleted_sends_count)
