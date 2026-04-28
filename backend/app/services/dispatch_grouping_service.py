"""발송 그룹핑 서비스

OrderItem 리스트를 받아 한 박스(=Send) 단위로 묶어 반환한다.
- 단품(MONTHLY): (우편번호, 주소) 2필드 그룹. 호 무관. 그룹 내 (이름, 연락처)는 가나다 첫 후보 자동 채택
- 정기구독(YEARLY): 1 OrderItem = 1 그룹. 외부 issue 기준 중복 발송 방지

DB 변경 없음 (순수 그룹핑 로직). 엑셀 다운로드와 "배송중 전환" 양쪽이 공유한다.

중복 발송 방지:
- MONTHLY: SendItem 서브쿼리만 사용 (last_send_issue 미사용)
- YEARLY: last_send_issue + SendItem 서브쿼리 둘 다 (defense in depth, 기존 find_subscription_targets 패턴)
"""

# 표준 라이브러리
from dataclasses import dataclass
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.pause import Pause
from app.models.send_item import SendItem


@dataclass
class SendGroup:
    """한 Send에 대응하는 OrderItem 묶음.

    - MONTHLY: (우편번호, 주소)가 같은 OrderItem들이 묶임. 그룹 내 (이름, 연락처)가 다른 경우
      가나다 첫 후보로 자동 채택된 단일 수령인 정보가 박힘.
    - YEARLY: 1 OrderItem = 1 그룹. 그 OrderItem의 배송지·수령인이 그대로 박힘.
    """
    address_id: int
    recipient_name: str
    recipient_phone: str
    country_code: str
    postal_code: str
    recipient_address: str
    customer_memo: Optional[str]
    order_item_ids: List[int]


def group_monthly_for_send(
    db: Session,
    order_item_ids: List[int],
) -> List[SendGroup]:
    """단품(MONTHLY) OrderItem 리스트를 (우편번호, 주소) 단위로 묶어 반환.

    - 그룹 내 (이름, 연락처)가 다르면 가나다 정렬 첫 번째를 자동 채택.
    - 중복 발송 방지: 활성 SendItem이 이미 있는 OrderItem은 자동 제외 (호 비교 없음).
    - last_send_issue 필드는 사용·갱신 모두 안 함.
    """
    if not order_item_ids:
        return []

    already_sent_ids = {
        row[0]
        for row in db.query(SendItem.order_item_id)
        .filter(
            SendItem.order_item_id.in_(order_item_ids),
            SendItem.cancelled_at.is_(None),
        )
        .all()
    }
    target_ids = [oid for oid in order_item_ids if oid not in already_sent_ids]
    if not target_ids:
        return []

    rows = (
        db.query(OrderItem, Address)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(OrderItem.order_item_id.in_(target_ids))
        .all()
    )

    # (우편번호, 주소)로 그룹화 + 후보 누적
    groups: dict = {}
    for oi, addr in rows:
        group_key = (
            (addr.postal_code or "").strip(),
            (addr.recipient_address or "").strip(),
        )
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append((oi, addr))

    result: List[SendGroup] = []
    for items in groups.values():
        # 가나다 정렬 첫 후보 채택 (정렬 키: recipient_name → recipient_phone)
        sorted_items = sorted(
            items,
            key=lambda pair: (
                (pair[1].recipient_name or ""),
                (pair[1].recipient_phone or ""),
            ),
        )
        chosen_addr = sorted_items[0][1]
        order_item_ids_in_group = [oi.order_item_id for oi, _ in items]
        result.append(
            SendGroup(
                address_id=chosen_addr.address_id,
                recipient_name=chosen_addr.recipient_name,
                recipient_phone=chosen_addr.recipient_phone,
                country_code=chosen_addr.country_code,
                postal_code=chosen_addr.postal_code,
                recipient_address=chosen_addr.recipient_address,
                customer_memo=chosen_addr.customer_memo,
                order_item_ids=order_item_ids_in_group,
            )
        )
    return result


def group_yearly_for_send(
    db: Session,
    order_item_ids: List[int],
    issue: str,
) -> List[SendGroup]:
    """정기구독(YEARLY) OrderItem 리스트를 OrderItem 단위로 묶어 반환 (1 OrderItem = 1 그룹).

    중복 발송 방지 (다음 조건을 모두 만족하는 OrderItem만 포함):
    - OrderItem.last_send_issue IS NULL 또는 last_send_issue < issue
    - 그 호로 활성 SendItem이 없음
    - 그 호로 휴지(Pause)되지 않음
    - final_subscribe_start_issue ≤ issue ≤ final_subscribe_end_issue (구독 범위 안)
    """
    if not order_item_ids:
        return []

    already_sent_ids = {
        row[0]
        for row in db.query(SendItem.order_item_id)
        .filter(
            SendItem.order_item_id.in_(order_item_ids),
            SendItem.issue == issue,
            SendItem.cancelled_at.is_(None),
        )
        .all()
    }

    pause_subquery = (
        db.query(Pause.order_item_id)
        .filter(Pause.pause_issue == issue, Pause.deleted_at.is_(None))
        .subquery()
    )

    rows = (
        db.query(OrderItem, Address)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(
            OrderItem.order_item_id.in_(order_item_ids),
            or_(
                OrderItem.last_send_issue.is_(None),
                OrderItem.last_send_issue < issue,
            ),
            OrderItem.final_subscribe_start_issue <= issue,
            OrderItem.final_subscribe_end_issue >= issue,
            ~OrderItem.order_item_id.in_(db.query(pause_subquery)),
        )
        .all()
    )

    return [
        SendGroup(
            address_id=addr.address_id,
            recipient_name=addr.recipient_name,
            recipient_phone=addr.recipient_phone,
            country_code=addr.country_code,
            postal_code=addr.postal_code,
            recipient_address=addr.recipient_address,
            customer_memo=addr.customer_memo,
            order_item_ids=[oi.order_item_id],
        )
        for oi, addr in rows
        if oi.order_item_id not in already_sent_ids
    ]


# ── PAID OrderItem 조회 (발송 생성 흐름의 입력) ─────────────────────────────

def get_paid_order_items_for_dispatch(
    db: Session,
) -> Tuple[List[OrderItem], List[OrderItem]]:
    """[발송 생성] 흐름의 입력 — PAID + 취소되지 않은 OrderItem을 종류별로 분리해 반환.

    그 호로 이미 SendItem 있는지·구독 범위·휴지 여부 등 추가 필터는
    group_yearly_for_send / group_monthly_for_send 함수가 처리.

    Returns:
        (yearly_order_items, monthly_order_items) 튜플
    """
    rows = (
        db.query(OrderItem)
        .join(Order, OrderItem.order_id == Order.order_id)
        .filter(
            Order.order_status == "PAID",
            OrderItem.cancelled_at.is_(None),
        )
        .all()
    )
    yearly_items = [oi for oi in rows if oi.product_kind == "YEARLY"]
    monthly_items = [oi for oi in rows if oi.product_kind == "MONTHLY"]
    return yearly_items, monthly_items


def count_paid_not_prepared(db: Session) -> Tuple[int, int]:
    """PAID + 활성 SendItem 없는 OrderItem 카운트를 (yearly, monthly) 튜플로 반환.

    PreparingSendListPage 알림 배너용. "다음 [발송 생성] 시 PREPARING에 추가될 OrderItem 수".

    조건:
    - Order.order_status = 'PAID'
    - OrderItem.cancelled_at IS NULL
    - 활성 SendItem(cancelled_at IS NULL)이 없는 OrderItem
    """
    has_send_item_subq = (
        db.query(SendItem.order_item_id)
        .filter(SendItem.cancelled_at.is_(None))
        .subquery()
    )

    rows = (
        db.query(OrderItem.product_kind, func.count(OrderItem.order_item_id))
        .join(Order, OrderItem.order_id == Order.order_id)
        .filter(
            Order.order_status == "PAID",
            OrderItem.cancelled_at.is_(None),
            ~OrderItem.order_item_id.in_(db.query(has_send_item_subq)),
        )
        .group_by(OrderItem.product_kind)
        .all()
    )
    counts = dict(rows)
    return counts.get("YEARLY", 0), counts.get("MONTHLY", 0)
