# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import now_kst
from app.models.order_item import OrderItem
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.send import SendListQuery, SendUpdate


def read_send_by_id(db: Session, send_id: int) -> Send:
    """발송 ID로 발송 조회"""
    send = db.query(Send).filter(Send.send_id == send_id).first()
    if not send:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="발송 정보를 찾을 수 없습니다.",
        )
    return send


def read_sends_by_order_id(db: Session, order_id: int) -> List[Send]:
    """주문 ID로 발송 목록 조회 (SendItem→OrderItem→order_id 경유)."""
    return (
        db.query(Send)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(OrderItem.order_id == order_id)
        .distinct()
        .order_by(Send.created_at.desc())
        .all()
    )


def list_sends(db: Session, query: SendListQuery) -> Tuple[List[Send], int]:
    """발송 목록 조회 (필터/정렬/페이지네이션)"""
    q = db.query(Send)

    if query.send_status:
        q = q.filter(Send.send_status == query.send_status)
    if query.courier_company:
        q = q.filter(Send.courier_company == query.courier_company)
    if query.tracking_no:
        q = q.filter(Send.tracking_no.like(f"%{query.tracking_no}%"))
    if query.start_date:
        q = q.filter(Send.created_at >= query.start_date)
    if query.end_date:
        q = q.filter(Send.created_at <= f"{query.end_date} 23:59:59")
    if query.is_cancelled is not None:
        if query.is_cancelled:
            q = q.filter(Send.cancelled_at.isnot(None))
        else:
            q = q.filter(Send.cancelled_at.is_(None))
    if query.recipient_search:
        q = q.filter(
            Send.recipient_name.like(f"%{query.recipient_search}%")
            | Send.recipient_phone.like(f"%{query.recipient_search}%")
        )
    if query.postal_code:
        q = q.filter(Send.postal_code == query.postal_code)
    if query.issue:
        q = q.join(SendItem, Send.send_id == SendItem.send_id).filter(
            SendItem.issue == query.issue
        ).distinct()
    if query.product_kind:
        # Send → SendItem → OrderItem.product_kind 로 필터
        # issue 필터와 SendItem 조인이 중복되지 않도록 별칭 없이 안전 조인
        from sqlalchemy.orm import aliased
        si_alias = aliased(SendItem)
        oi_alias = aliased(OrderItem)
        q = (
            q.join(si_alias, si_alias.send_id == Send.send_id)
            .join(oi_alias, oi_alias.order_item_id == si_alias.order_item_id)
            .filter(oi_alias.product_kind == query.product_kind)
            .distinct()
        )

    allowed_sort = {
        "created_at", "updated_at",
        "shipped_at", "delivered_at",
    }
    sort_col = getattr(Send, query.sort_by if query.sort_by in allowed_sort else "created_at")
    q = q.order_by(sort_col.asc() if query.sort_order == "asc" else sort_col.desc())

    total = q.count()
    items = q.offset((query.page - 1) * query.limit).limit(query.limit).all()
    return items, total


def update_send(db: Session, send: Send, send_in: SendUpdate) -> Send:
    """발송 수정 (스냅샷 필드 개별 업데이트)"""
    for field, value in send_in.model_dump(exclude_unset=True).items():
        setattr(send, field, value)
    db.commit()
    db.refresh(send)
    return send


def update_send_status(
    db: Session,
    send: Send,
    send_status: str,
    tracking_no: Optional[str] = None,
    courier_company: Optional[str] = None,
) -> Send:
    """발송 상태 변경 + 상태별 타임스탬프 자동 설정"""
    now = now_kst()
    send.send_status = send_status

    if send_status == "SHIPPING":
        send.shipped_at = now
        if tracking_no:
            send.tracking_no = tracking_no
        if courier_company:
            send.courier_company = courier_company
        # SHIPPING 전환 시 연관 OrderItem.last_send_issue 업데이트
        from app.models.order_item import OrderItem
        send_items = db.query(SendItem).filter(
            SendItem.send_id == send.send_id,
            SendItem.cancelled_at.is_(None),
        ).all()
        for si in send_items:
            order_item = db.query(OrderItem).filter(OrderItem.order_item_id == si.order_item_id).first()
            if order_item and si.issue:
                if not order_item.last_send_issue or si.issue > order_item.last_send_issue:
                    order_item.last_send_issue = si.issue
    elif send_status == "DELIVERED":
        send.delivered_at = now
    elif send_status == "CANCELLED":
        send.cancelled_at = now

    db.commit()
    db.refresh(send)
    return send


def update_tracking(
    db: Session,
    send: Send,
    tracking_no: Optional[str] = None,
    send_method: Optional[str] = None,
    courier_company: Optional[str] = None,
) -> Send:
    """SHIPPING/DELIVERED Send의 운송장/배송업체/배송방법 필드만 수정.

    상태 전환 동반 안 함 (PREPARING→SHIPPING 전환은 transition_send_to_shipping만).
    호출자가 상태 검증 책임 (services 레이어).
    """
    if tracking_no is not None:
        send.tracking_no = tracking_no
    if send_method is not None:
        send.send_method = send_method
    if courier_company is not None:
        send.courier_company = courier_company
    db.commit()
    db.refresh(send)
    return send


def cancel_send(db: Session, send: Send) -> Send:
    """발송 취소 (연관 SendItem도 취소 + OrderItem.last_send_issue 롤백)"""
    from app.models.order_item import OrderItem

    now = now_kst()
    send.send_status = "CANCELLED"
    send.cancelled_at = now

    items = (
        db.query(SendItem)
        .filter(SendItem.send_id == send.send_id, SendItem.cancelled_at.is_(None))
        .all()
    )

    # 취소되는 SendItem의 order_item_id 수집
    affected_order_item_ids = set()
    for item in items:
        item.cancelled_at = now
        affected_order_item_ids.add(item.order_item_id)

    # 각 OrderItem의 last_send_issue를 남은 SHIPPING/DELIVERED 발송 중 가장 큰 호로 롤백
    for oi_id in affected_order_item_ids:
        latest = (
            db.query(SendItem.issue)
            .join(Send, SendItem.send_id == Send.send_id)
            .filter(
                SendItem.order_item_id == oi_id,
                SendItem.cancelled_at.is_(None),
                Send.send_status.in_(["SHIPPING", "DELIVERED"]),
            )
            .order_by(SendItem.issue.desc())
            .first()
        )
        order_item = db.query(OrderItem).filter(OrderItem.order_item_id == oi_id).first()
        if order_item:
            order_item.last_send_issue = latest[0] if latest else None

    db.commit()
    db.refresh(send)
    return send


def auto_deliver_shipped_sends(db: Session, days: int = 3) -> int:
    """SHIPPING 상태에서 N일 경과한 발송을 자동 DELIVERED 전환. 전환 건수 반환."""
    from datetime import timedelta

    cutoff = now_kst() - timedelta(days=days)
    sends = (
        db.query(Send)
        .filter(
            Send.send_status == "SHIPPING",
            Send.shipped_at <= cutoff,
        )
        .all()
    )
    now = now_kst()
    for send in sends:
        send.send_status = "DELIVERED"
        send.delivered_at = now

    if sends:
        db.commit()
    return len(sends)


def delete_preparing_sends(db: Session, scope: str) -> int:
    """PREPARING Send + SendItem 일괄 삭제. 삭제된 Send 수 반환.

    scope:
      - "monthly" : SendItem이 MONTHLY OrderItem과 연결된 PREPARING Send만
      - "yearly"  : SendItem이 YEARLY OrderItem과 연결된 PREPARING Send만

    SHIPPING/DELIVERED/CANCELLED Send는 절대 건드리지 않음.
    Bulk DELETE 사용 (SendItem 먼저 → Send 나중, FK 순서 준수).
    호출자가 db.commit() 책임.
    """
    if scope not in ("monthly", "yearly"):
        raise ValueError(f"잘못된 scope: {scope}")

    kind = "MONTHLY" if scope == "monthly" else "YEARLY"
    target_ids_query = (
        db.query(Send.send_id)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(
            Send.send_status == "PREPARING",
            OrderItem.product_kind == kind,
        )
        .distinct()
    )

    target_send_ids = [row[0] for row in target_ids_query.all()]
    if not target_send_ids:
        return 0

    # SendItem 먼저 삭제 (FK)
    db.query(SendItem).filter(
        SendItem.send_id.in_(target_send_ids)
    ).delete(synchronize_session=False)

    # Send 삭제
    deleted = db.query(Send).filter(
        Send.send_id.in_(target_send_ids)
    ).delete(synchronize_session=False)

    return deleted
