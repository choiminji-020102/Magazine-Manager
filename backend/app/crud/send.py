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
    # PK 를 2차 정렬키로 고정 — [발송 생성] 은 일괄 INSERT 라 created_at 이 초 단위로 동일한
    # 행이 수백 건씩 뭉친다. tie 상태에서는 LIMIT/OFFSET 페이징의 행 순서가 비결정적이라
    # 같은 행이 두 페이지에 중복 등장하고 다른 행은 어느 페이지에도 안 나오는 누락이 발생한다.
    is_asc = query.sort_order == "asc"
    q = q.order_by(
        sort_col.asc() if is_asc else sort_col.desc(),
        Send.send_id.asc() if is_asc else Send.send_id.desc(),
    )

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
    """PREPARING SendItem 을 scope 조건에 맞게 정확히 골라 삭제. 삭제된 Send 수 반환.

    Send 를 통째로 지우지 않고 **매칭되는 SendItem만** 지운 뒤, 그 결과 SendItem 이
    0개가 된 Send 만 함께 삭제한다 — VIP 그룹핑으로 만들어진 혼합 Send(정기+단품 공존)의
    주소가 나중에 vipN 이 꺼져 monthly/yearly 조건에 걸리더라도, 같이 있던 다른 종류/호의
    SendItem 은 보존된다.

    scope:
      - "monthly" : MONTHLY SendItem 중 활성 vipN 모두 false 인 주소만. issue 는 받아도
                    사용하지 않음 (MONTHLY는 호 개념이 없어 항상 전량 대상).
      - "yearly"  : YEARLY SendItem 중 활성 vipN 모두 false 인 주소 + **그 호(issue)만**.
                    issue 필수 (다른 호의 미배송 PREPARING을 실수로 통째 날리는 사고 방지
                    — 예전엔 issue 없으면 전체 삭제했었음).
      - "vip1".."vip6" : 해당 슬롯(Address.vipN=true)의 SendItem. MONTHLY는 issue 무관
                    전량 대상, YEARLY는 그 호만 대상. issue 필수.

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

    query = (
        db.query(SendItem.send_item_id, SendItem.send_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .filter(Send.send_status == "PREPARING")
    )

    if is_vip:
        slot_number = int(scope[3:])
        vip_col = getattr(Address, f"vip{slot_number}")
        query = (
            query
            .join(Address, Address.address_id == OrderItem.address_id)
            .filter(
                vip_col.is_(True),
                # MONTHLY는 issue 무관 전량, YEARLY는 그 호만 대상
                or_(OrderItem.product_kind == "MONTHLY", SendItem.issue == issue),
            )
        )
    else:
        kind = "MONTHLY" if scope == "monthly" else "YEARLY"
        query = query.filter(OrderItem.product_kind == kind)
        if kind == "YEARLY":
            query = query.filter(SendItem.issue == issue)
        active_slots = [s.slot_number for s in vip_slots.list_slots() if s.is_enabled]
        if active_slots:
            vip_columns = [getattr(Address, f"vip{n}") for n in active_slots]
            query = (
                query
                .join(Address, Address.address_id == OrderItem.address_id)
                .filter(not_(or_(*vip_columns)))
            )

    rows = query.distinct().all()
    if not rows:
        return 0

    target_si_ids = [r[0] for r in rows]
    affected_send_ids = {r[1] for r in rows}

    # 매칭된 SendItem 만 정확히 삭제 (Send 통째 삭제 아님)
    db.query(SendItem).filter(
        SendItem.send_item_id.in_(target_si_ids)
    ).delete(synchronize_session=False)

    # 영향받은 Send 들 중 잔여 SendItem 이 0개인 것만 한 번에 조회해 삭제
    # (다른 호/종류의 SendItem 이 남아있으면 그 Send 는 보존)
    still_has_items = {
        row[0] for row in db.query(SendItem.send_id)
        .filter(SendItem.send_id.in_(affected_send_ids))
        .distinct()
        .all()
    }
    empty_send_ids = affected_send_ids - still_has_items
    if not empty_send_ids:
        return 0
    return db.query(Send).filter(
        Send.send_id.in_(empty_send_ids)
    ).delete(synchronize_session=False)
