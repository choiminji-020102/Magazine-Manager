# 표준 라이브러리
from datetime import date, datetime, timezone
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
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
    """주문 ID로 발송 목록 조회"""
    return (
        db.query(Send)
        .filter(Send.order_id == order_id)
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
    if query.official_send_date:
        q = q.filter(Send.official_send_date == query.official_send_date)
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

    allowed_sort = {
        "created_at", "updated_at", "official_send_date",
        "prepared_at", "shipped_at", "delivered_at",
    }
    sort_col = getattr(Send, query.sort_by if query.sort_by in allowed_sort else "created_at")
    q = q.order_by(sort_col.asc() if query.sort_order == "asc" else sort_col.desc())

    total = q.count()
    items = q.offset((query.page - 1) * query.limit).limit(query.limit).all()
    return items, total


def create_send(
    db: Session,
    order_id: int,
    address_id: Optional[int],
    official_send_date: Optional[date],
    admin_memo: Optional[str],
    recipient_name: str,
    recipient_phone: str,
    country_code: str,
    postal_code: str,
    recipient_address: str,
    customer_memo: Optional[str],
) -> Send:
    """발송 생성 (send_status = PREPARING 고정)"""
    send = Send(
        order_id=order_id,
        address_id=address_id,
        send_status="PREPARING",
        official_send_date=official_send_date,
        admin_memo=admin_memo,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        country_code=country_code,
        postal_code=postal_code,
        recipient_address=recipient_address,
        customer_memo=customer_memo,
    )
    db.add(send)
    db.flush()
    return send


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
    now = datetime.now(timezone.utc)
    send.send_status = send_status

    if send_status == "SHIPPING":
        send.shipped_at = now
        if tracking_no:
            send.tracking_no = tracking_no
        if courier_company:
            send.courier_company = courier_company
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
    tracking_no: str,
    courier_company: str,
) -> Send:
    """운송장 정보 등록 → SHIPPING 전환"""
    send.tracking_no = tracking_no
    send.courier_company = courier_company
    send.send_status = "SHIPPING"
    send.shipped_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(send)
    return send


def cancel_send(db: Session, send: Send) -> Send:
    """발송 취소 (연관 SendItem도 취소)"""
    from app.models.send_item import SendItem

    now = datetime.now(timezone.utc)
    send.send_status = "CANCELLED"
    send.cancelled_at = now

    items = (
        db.query(SendItem)
        .filter(SendItem.send_id == send.send_id, SendItem.cancelled_at.is_(None))
        .all()
    )
    for item in items:
        item.cancelled_at = now

    db.commit()
    db.refresh(send)
    return send


def auto_deliver_shipped_sends(db: Session, days: int = 3) -> int:
    """SHIPPING 상태에서 N일 경과한 발송을 자동 DELIVERED 전환. 전환 건수 반환."""
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    sends = (
        db.query(Send)
        .filter(
            Send.send_status == "SHIPPING",
            Send.shipped_at <= cutoff,
        )
        .all()
    )
    now = datetime.now(timezone.utc)
    for send in sends:
        send.send_status = "DELIVERED"
        send.delivered_at = now

    if sends:
        db.commit()
    return len(sends)
