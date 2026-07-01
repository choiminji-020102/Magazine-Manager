# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import not_, or_
from sqlalchemy.orm import Session, selectinload

# 로컬 애플리케이션
from app.core import vip_slots
from app.models.address import Address
from app.models.order_item import OrderItem
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.send import SendListQuery


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
    """발송 목록 조회 (필터/정렬/페이지네이션).

    각 Send 의 SendItem 목록도 selectinload 로 한 번에 로드 — 카드 표시용
    인라인 items 응답을 N+1 없이 채우기 위함.
    """
    q = db.query(Send).options(selectinload(Send.items))

    if query.send_status:
        q = q.filter(Send.send_status == query.send_status)
        # 옛 KR 강제 필터 제거 (PR4) — VIP 슬롯은 비-KR Send 도 허용해야 하므로
        # 일반 monthly/yearly 그룹핑 단계의 country_code='KR' 격리는 그룹핑 함수가 책임.
        # 목록 조회는 country_code 필터 없음.
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
    if query.recipient_name:
        q = q.filter(Send.recipient_name.like(f"%{query.recipient_name}%"))
    if query.recipient_phone:
        q = q.filter(Send.recipient_phone.like(f"%{query.recipient_phone}%"))
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
        )
        # 일반 단품/정기 탭(vip_slot_number 미지정) 은 활성 VIP 슬롯 주소 제외
        # — VIP 박스는 VIP 탭에서만 보이도록 격리. [발송 생성] 단계의 VIP 자동 제외와 일관성.
        if query.vip_slot_number is None:
            active_slots = [s.slot_number for s in vip_slots.list_slots() if s.is_enabled]
            if active_slots:
                addr_alias = aliased(Address)
                q = q.join(addr_alias, addr_alias.address_id == oi_alias.address_id)
                vip_columns = [getattr(addr_alias, f"vip{n}") for n in active_slots]
                q = q.filter(not_(or_(*vip_columns)))
        q = q.distinct()
    if query.vip_slot_number is not None:
        # Send → SendItem → OrderItem → Address.vipN=true 필터
        # 다른 SendItem/OrderItem/Address 조인과 중복되지 않게 alias 사용
        from sqlalchemy.orm import aliased
        si_vip = aliased(SendItem)
        oi_vip = aliased(OrderItem)
        addr_vip = aliased(Address)
        vip_col = getattr(addr_vip, f"vip{query.vip_slot_number}")
        q = (
            q.join(si_vip, si_vip.send_id == Send.send_id)
            .join(oi_vip, oi_vip.order_item_id == si_vip.order_item_id)
            .join(addr_vip, addr_vip.address_id == oi_vip.address_id)
            .filter(vip_col.is_(True))
            .distinct()
        )

    allowed_sort = {
        "created_at", "updated_at",
        "delivered_at",
    }
    sort_col = getattr(Send, query.sort_by if query.sort_by in allowed_sort else "created_at")
    q = q.order_by(sort_col.asc() if query.sort_order == "asc" else sort_col.desc())

    total = q.count()
    items = q.offset((query.page - 1) * query.limit).limit(query.limit).all()
    return items, total


def update_tracking(
    db: Session,
    send: Send,
    tracking_no: Optional[str] = None,
    send_method: Optional[str] = None,
    courier_company: Optional[str] = None,
) -> Send:
    """DELIVERED Send의 운송장/배송업체/배송방법 필드만 수정.

    상태 전환 동반 안 함 (PREPARING→DELIVERED 전환은 transition_send_to_delivered만).
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


def update_admin_memo(db: Session, send: Send, admin_memo: Optional[str]) -> Send:
    """Send.admin_memo 수정. 상태 무관, 빈/None 은 NULL 저장."""
    send.admin_memo = admin_memo
    db.commit()
    db.refresh(send)
    return send


def delete_single_preparing_send(db: Session, send: Send) -> int:
    """PREPARING Send 1건 + 잔여 SendItem cascade 삭제. 삭제된 SendItem 수 반환.

    호출자가 PREPARING 상태 검증 책임 (services 레이어).
    SendItem 먼저 DELETE → Send DELETE (FK 순서). db.commit() 까지 본 함수가 책임.
    """
    deleted_items = (
        db.query(SendItem)
        .filter(SendItem.send_id == send.send_id)
        .delete()
    )
    db.delete(send)
    db.commit()
    return deleted_items


def delete_preparing_sends(db: Session, scope: str, issue: Optional[str] = None) -> int:
    """PREPARING Send + SendItem 일괄 삭제. 삭제된 Send 수 반환.

    scope:
      - "monthly" : MONTHLY + 활성 vipN 모두 false 인 OrderItem 의 PREPARING Send 전체.
                    issue 는 받아도 사용하지 않음 (MONTHLY는 호 개념이 없어 항상 전체 삭제).
      - "yearly"  : YEARLY + 활성 vipN 모두 false 인 OrderItem 의 PREPARING Send만.
                    **issue 필수** — 그 호(SendItem.issue)의 Send만 삭제한다. YEARLY는
                    Send:SendItem 이 항상 1:1이라 박스째 삭제와 동일하게 안전함.
                    issue 없이 호출 시 ValueError (다른 호의 미배송 PREPARING을 실수로
                    통째 날리는 사고 방지 — 예전엔 issue 없으면 전체 삭제했었음).
      - "vip1".."vip6" : 해당 슬롯(Address.vipN=true)의 PREPARING SendItem.
                    **issue 필수.** 한 Send 에 정기+단품이 섞여 있을 수 있어 SendItem
                    단위로 골라 지운다. MONTHLY SendItem 은 issue 무관 전량 대상
                    (scope=monthly와 동일 정책), YEARLY SendItem 은 그 호만 대상.
                    삭제 후 SendItem 이 0개가 된 Send 만 함께 삭제 — 다른 호/종류가 남은
                    박스는 그대로 보존한다.

    각 scope 는 자기 영역만 삭제 — 다른 탭의 PREPARING 절대 건드리지 않음 (격리).
    DELIVERED/CANCELLED Send 는 모든 scope 에서 절대 건드리지 않음.
    호출자가 db.commit() 책임.
    """
    is_vip = scope.startswith("vip") and scope[3:].isdigit() and 1 <= int(scope[3:]) <= 6
    if scope not in ("monthly", "yearly") and not is_vip:
        raise ValueError(f"잘못된 scope: {scope}")
    if scope == "yearly" and not issue:
        raise ValueError("scope=yearly 는 issue가 필수입니다.")
    if is_vip and not issue:
        raise ValueError(f"scope={scope} 는 issue가 필수입니다.")

    if scope in ("monthly", "yearly"):
        kind = "MONTHLY" if scope == "monthly" else "YEARLY"
        active_slots = [s.slot_number for s in vip_slots.list_slots() if s.is_enabled]
        target_ids_query = (
            db.query(Send.send_id)
            .join(SendItem, SendItem.send_id == Send.send_id)
            .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
            .filter(
                Send.send_status == "PREPARING",
                OrderItem.product_kind == kind,
            )
        )
        if kind == "YEARLY":
            target_ids_query = target_ids_query.filter(SendItem.issue == issue)
        if active_slots:
            vip_columns = [getattr(Address, f"vip{n}") for n in active_slots]
            target_ids_query = (
                target_ids_query
                .join(Address, Address.address_id == OrderItem.address_id)
                .filter(not_(or_(*vip_columns)))
            )
        target_ids_query = target_ids_query.distinct()

        target_send_ids = [row[0] for row in target_ids_query.all()]
        if not target_send_ids:
            return 0

        # SendItem 먼저 삭제 (FK) → Send 삭제. 여기서 걸린 target_send_ids 는
        # "이 kind(+issue) 만 담긴 Send" 이므로 통째 삭제해도 다른 데이터 유실 없음.
        db.query(SendItem).filter(
            SendItem.send_id.in_(target_send_ids)
        ).delete(synchronize_session=False)
        deleted = db.query(Send).filter(
            Send.send_id.in_(target_send_ids)
        ).delete(synchronize_session=False)
        return deleted

    # vip1..vip6
    slot_number = int(scope[3:])
    vip_col = getattr(Address, f"vip{slot_number}")

    target_si_query = (
        db.query(SendItem.send_item_id, SendItem.send_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .join(Address, Address.address_id == OrderItem.address_id)
        .filter(
            Send.send_status == "PREPARING",
            vip_col.is_(True),
            # MONTHLY는 issue 무관 전량, YEARLY는 그 호만 대상
            or_(OrderItem.product_kind == "MONTHLY", SendItem.issue == issue),
        )
    )
    rows = target_si_query.distinct().all()
    if not rows:
        return 0

    target_si_ids = [r[0] for r in rows]
    affected_send_ids = {r[1] for r in rows}

    db.query(SendItem).filter(
        SendItem.send_item_id.in_(target_si_ids)
    ).delete(synchronize_session=False)

    # 잔여 SendItem 이 0개가 된 Send 만 추가 삭제 (다른 호/종류가 남아있으면 박스 보존)
    deleted = 0
    for send_id in affected_send_ids:
        remaining = db.query(SendItem).filter(SendItem.send_id == send_id).count()
        if remaining == 0:
            db.query(Send).filter(Send.send_id == send_id).delete(synchronize_session=False)
            deleted += 1
    return deleted
