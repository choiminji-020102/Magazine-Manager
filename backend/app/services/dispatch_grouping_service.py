"""발송 그룹핑 서비스

OrderItem 리스트를 받아 한 박스(=Send) 단위로 묶어 반환한다.
- 단품(MONTHLY): (우편번호, 주소) 2필드 그룹. 호 무관. 그룹 내 (이름, 연락처)는 가나다 첫 후보 자동 채택
- 정기구독(YEARLY): 1 OrderItem = 1 그룹. 외부 issue 기준 중복 발송 방지
- VIP(vipN): 슬롯에 속한 OrderItem 을 정기·단품 통합으로 (우편번호, 주소) 그룹

DB 변경 없음 (순수 그룹핑 로직). 엑셀 다운로드와 "배송중 전환" 양쪽이 공유한다.

VIP 슬롯 격리:
- monthly/yearly 그룹: 활성 vip 슬롯에 속한 OrderItem 자동 제외 (이중 발송 방지)
- vipN 그룹: country_code 필터 절대 사용 안 함 (오로지 Address.vipN=true 가 기준)
- 단일성 제약(V-7) 덕에 한 OrderItem 은 정확히 한 vipN 또는 monthly/yearly 중 하나에만 속함

중복 발송 방지:
- MONTHLY: SendItem 서브쿼리만 사용 (last_send_issue 미사용)
- YEARLY: last_send_issue + SendItem 서브쿼리 둘 다 (defense in depth, 기존 find_subscription_targets 패턴)

출력 정렬 (엑셀 §5.2.4 / §5.3.5 와 일관 — PREPARING Send 생성 순서 = 엑셀 표시 순서):
- monthly / vipN: (postal_code, recipient_address, chosen_recipient_name, chosen_address_id)
- yearly: (postal_code, recipient_address, product_name, subscribe_start_issue, order_item_id)
"""

# 표준 라이브러리
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import func, not_, or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core import vip_slots
from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.pause import Pause
from app.models.send import Send
from app.models.send_item import SendItem


@dataclass
class SendGroup:
    """한 Send에 대응하는 OrderItem 묶음.

    - MONTHLY / VIP: (우편번호, 주소)가 같은 OrderItem들이 묶임. 그룹 내 (이름, 연락처)가 다른 경우
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


# ── 내부 헬퍼 ──────────────────────────────────────────────────────────────────

def _active_vip_slot_numbers() -> List[int]:
    """현재 활성화된 VIP 슬롯 번호 리스트 (1..6 부분집합)."""
    return [s.slot_number for s in vip_slots.list_slots() if s.is_enabled]


def _exclude_active_vip(query, active_slots: List[int]):
    """쿼리에 '활성 vipN 모두 false' 필터 적용 (Address join 이미 되어 있다고 가정).

    활성 슬롯이 0개면 필터 미적용 (현재 동작 그대로).
    """
    if not active_slots:
        return query
    vip_columns = [getattr(Address, f"vip{n}") for n in active_slots]
    return query.filter(not_(or_(*vip_columns)))


# ── monthly ────────────────────────────────────────────────────────────────────

def group_monthly_for_send(
    db: Session,
    order_item_ids: List[int],
) -> List[SendGroup]:
    """단품(MONTHLY) OrderItem 리스트를 (우편번호, 주소) 단위로 묶어 반환.

    - 활성 vip 슬롯에 속한 OrderItem 자동 제외 (vipN 탭에서 따로 처리)
    - 그룹 내 (이름, 연락처)가 다르면 가나다 정렬 첫 번째를 자동 채택.
    - 중복 발송 방지: "활성 SendItem이 있는" 또는 "DELIVERED/CANCELLED Send에 들어있는"
      OrderItem은 자동 제외 (호 비교 없음). 즉, "한 번이라도 발송 처리되거나 박스가
      종료된" OrderItem은 재발송하지 않는다.
    - last_send_issue 필드는 사용·갱신 모두 안 함.
    - 출력 정렬: (postal_code, recipient_address, chosen_recipient_name, chosen_address_id)
    """
    if not order_item_ids:
        return []

    already_sent_ids = {
        row[0]
        for row in db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.order_item_id.in_(order_item_ids),
            or_(
                SendItem.cancelled_at.is_(None),
                Send.send_status.in_(["DELIVERED", "CANCELLED"]),
            ),
        )
        .all()
    }
    target_ids = [oid for oid in order_item_ids if oid not in already_sent_ids]
    if not target_ids:
        return []

    active_slots = _active_vip_slot_numbers()
    rows_query = (
        db.query(OrderItem, Address)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(
            OrderItem.order_item_id.in_(target_ids),
            Address.country_code == "KR",   # 해외 발송은 새 흐름 대상 외
        )
    )
    rows_query = _exclude_active_vip(rows_query, active_slots)
    rows = rows_query.all()

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

    # 출력 정렬: (postal_code, recipient_address, chosen_recipient_name, chosen_address_id)
    result.sort(key=lambda g: (
        g.postal_code or "",
        g.recipient_address or "",
        g.recipient_name or "",
        g.address_id,
    ))
    return result


# ── yearly ─────────────────────────────────────────────────────────────────────

def group_yearly_for_send(
    db: Session,
    order_item_ids: List[int],
    issue: str,
) -> List[SendGroup]:
    """정기구독(YEARLY) OrderItem 리스트를 OrderItem 단위로 묶어 반환 (1 OrderItem = 1 그룹).

    - 활성 vip 슬롯에 속한 OrderItem 자동 제외 (vipN 탭에서 따로 처리)
    - 중복 발송 방지 (다음 조건을 모두 만족하는 OrderItem만 포함):
      - OrderItem.last_send_issue IS NULL 또는 last_send_issue < issue
      - 그 호로 "활성 SendItem이 있는" 또는 "DELIVERED/CANCELLED Send에 들어있는" 이력 없음
        (즉, 그 호로 한 번이라도 발송 처리되거나 박스가 종료된 OrderItem은 재발송 X)
      - 그 호로 휴지(Pause)되지 않음
      - final_subscribe_start_issue ≤ issue ≤ final_subscribe_end_issue (구독 범위 안)
    - 출력 정렬: (postal_code, recipient_address, product_name, subscribe_start_issue, order_item_id)
    """
    if not order_item_ids:
        return []

    already_sent_ids = {
        row[0]
        for row in db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.order_item_id.in_(order_item_ids),
            SendItem.issue == issue,
            or_(
                SendItem.cancelled_at.is_(None),
                Send.send_status.in_(["DELIVERED", "CANCELLED"]),
            ),
        )
        .all()
    }

    pause_subquery = (
        db.query(Pause.order_item_id)
        .filter(Pause.pause_issue == issue, Pause.deleted_at.is_(None))
        .subquery()
    )

    active_slots = _active_vip_slot_numbers()
    rows_query = (
        db.query(OrderItem, Address)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(
            OrderItem.order_item_id.in_(order_item_ids),
            Address.country_code == "KR",   # 해외 발송은 새 흐름 대상 외
            or_(
                OrderItem.last_send_issue.is_(None),
                OrderItem.last_send_issue < issue,
            ),
            OrderItem.final_subscribe_start_issue <= issue,
            OrderItem.final_subscribe_end_issue >= issue,
            ~OrderItem.order_item_id.in_(db.query(pause_subquery)),
        )
    )
    rows_query = _exclude_active_vip(rows_query, active_slots)
    rows = rows_query.all()

    # 정렬 후 SendGroup 생성 — rows 가 이미 OrderItem 을 들고 있어 추가 IN 쿼리 불필요
    filtered = [(oi, addr) for oi, addr in rows if oi.order_item_id not in already_sent_ids]
    filtered.sort(key=lambda pair: (
        (pair[1].postal_code or ""),
        (pair[1].recipient_address or ""),
        (pair[0].product_name or ""),
        (pair[0].subscribe_start_issue or ""),
        pair[0].order_item_id,
    ))
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
        for oi, addr in filtered
    ]


# ── vip ────────────────────────────────────────────────────────────────────────

def group_vip_for_send(
    db: Session,
    slot_number: int,
    issue: str,
) -> List[SendGroup]:
    """VIP 슬롯(vipN) 의 OrderItem 을 (우편번호, 주소) 단위로 묶어 반환.

    - 슬롯 N 이 비활성이면 400 (방어용 — 호출자도 이미 검증)
    - 대상: PAID + cancelled_at IS NULL + Address.vipN=true
    - 🚫 country_code 필터 절대 금지 — 해외 포함 모두 가져옴
    - 정기(YEARLY) + 단품(MONTHLY) 통합 — 같은 (우편번호, 주소) 면 한 그룹에 공존
    - 정기 부분 필터: subscribe 범위 + last_send_issue + Pause + 발송이력 없음 (group_yearly 와 동일)
    - 단품 부분 필터: 발송이력 없음 (group_monthly 와 동일)
    - 그룹핑 키: (postal_code, recipient_address) — monthly 와 동일. 같은 그룹 안 수령인이 다르면
      가나다 첫 후보 자동 채택 (정렬 키: recipient_name → recipient_phone)
    - product_code `+`/`~` → `-` 변환은 본 함수에서 안 함. create_preparing_sends_from_groups 가
      OrderItem.product_kind 별로 처리 (기존 yearly 흐름 그대로)
    - 출력 정렬: monthly 와 동일 — (postal_code, recipient_address, chosen_recipient_name, chosen_address_id)
    """
    if slot_number < 1 or slot_number > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"slot_number는 1..6 범위여야 합니다: {slot_number}",
        )
    slot = next((s for s in vip_slots.list_slots() if s.slot_number == slot_number), None)
    if slot is None or not slot.is_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"비활성 슬롯입니다: vip{slot_number}",
        )

    vip_col = getattr(Address, f"vip{slot_number}")

    # 1. 후보 OrderItem 조회 (PAID + 취소 X + vipN=true)
    candidates = (
        db.query(OrderItem, Address)
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(
            Order.order_status == "PAID",
            OrderItem.cancelled_at.is_(None),
            vip_col.is_(True),
        )
        .all()
    )
    if not candidates:
        return []

    candidate_ids = [oi.order_item_id for oi, _ in candidates]

    # 2. 단품 발송이력 (issue 무관) + 정기 발송이력 (issue 일치) — 한번에
    monthly_already_sent = {
        row[0]
        for row in db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.order_item_id.in_(candidate_ids),
            or_(
                SendItem.cancelled_at.is_(None),
                Send.send_status.in_(["DELIVERED", "CANCELLED"]),
            ),
        )
        .all()
    }
    yearly_already_sent = {
        row[0]
        for row in db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            SendItem.order_item_id.in_(candidate_ids),
            SendItem.issue == issue,
            or_(
                SendItem.cancelled_at.is_(None),
                Send.send_status.in_(["DELIVERED", "CANCELLED"]),
            ),
        )
        .all()
    }
    paused_ids = {
        row[0]
        for row in db.query(Pause.order_item_id)
        .filter(
            Pause.order_item_id.in_(candidate_ids),
            Pause.pause_issue == issue,
            Pause.deleted_at.is_(None),
        )
        .all()
    }

    # 3. kind 별 필터링
    eligible: List[Tuple[OrderItem, Address]] = []
    for oi, addr in candidates:
        if oi.product_kind == "MONTHLY":
            if oi.order_item_id in monthly_already_sent:
                continue
            eligible.append((oi, addr))
        else:  # YEARLY
            if oi.order_item_id in yearly_already_sent:
                continue
            if oi.order_item_id in paused_ids:
                continue
            if oi.last_send_issue and oi.last_send_issue >= issue:
                continue
            if oi.final_subscribe_start_issue and oi.final_subscribe_start_issue > issue:
                continue
            if oi.final_subscribe_end_issue and oi.final_subscribe_end_issue < issue:
                continue
            eligible.append((oi, addr))

    if not eligible:
        return []

    # 4. (우편번호, 주소) 그룹핑 + 가나다 첫 후보 채택 (group_monthly 와 동일 패턴)
    groups: dict = {}
    for oi, addr in eligible:
        group_key = (
            (addr.postal_code or "").strip(),
            (addr.recipient_address or "").strip(),
        )
        if group_key not in groups:
            groups[group_key] = []
        groups[group_key].append((oi, addr))

    result: List[SendGroup] = []
    for items in groups.values():
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

    # 출력 정렬: monthly 와 동일
    result.sort(key=lambda g: (
        g.postal_code or "",
        g.recipient_address or "",
        g.recipient_name or "",
        g.address_id,
    ))
    return result


# ── PAID OrderItem 조회 (발송 생성 흐름의 입력) ─────────────────────────────

def get_paid_order_items_for_dispatch(
    db: Session,
) -> Tuple[List[OrderItem], List[OrderItem]]:
    """[발송 생성] 흐름의 입력 — PAID + 취소되지 않은 + 국내(KR) OrderItem을 종류별로 분리해 반환.

    그 호로 이미 SendItem 있는지·구독 범위·휴지 여부 등 추가 필터는
    group_yearly_for_send / group_monthly_for_send 함수가 처리.
    VIP 슬롯 격리 필터도 group 함수가 처리.

    Returns:
        (yearly_order_items, monthly_order_items) 튜플
    """
    rows = (
        db.query(OrderItem)
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(
            Order.order_status == "PAID",
            OrderItem.cancelled_at.is_(None),
            Address.country_code == "KR",   # 해외 발송은 새 흐름 대상 외
        )
        .all()
    )
    yearly_items = [oi for oi in rows if oi.product_kind == "YEARLY"]
    monthly_items = [oi for oi in rows if oi.product_kind == "MONTHLY"]
    return yearly_items, monthly_items


def count_paid_not_prepared(db: Session) -> Dict[str, int]:
    """PAID + 활성 SendItem 없는 OrderItem 카운트를 scope 별로 분해해 반환.

    PreparingSendListPage 알림 배너용 — 각 탭별 "다음 [발송 생성] 시 PREPARING 에 추가될 OrderItem 수".

    반환 dict 키 (항상 고정 8개):
    - "monthly": MONTHLY + KR + 활성 vipN 모두 false
    - "yearly":  YEARLY  + KR + 활성 vipN 모두 false
    - "vip1".."vip6": Address.vip{N}=true (country_code 무관, kind 무관). 비활성 슬롯은 0

    공통 조건:
    - Order.order_status = 'PAID'
    - OrderItem.cancelled_at IS NULL
    - "활성 SendItem(cancelled_at IS NULL)" 또는 "DELIVERED/CANCELLED Send 에 들어있는 SendItem"
      이 모두 없는 OrderItem (group_*_for_send 와 동일한 발송 이력 판정)

    VIP 격리 (PR2 정책 일관):
    - monthly/yearly 는 활성 vipN 모두 false 인 OrderItem 만 (비활성 슬롯의 vipN=true 는 monthly/yearly 에 흡수)
    - vipN 키는 활성 슬롯만 실제 카운트, 비활성 슬롯은 0 (응답 모양 안정 — 운영 중 슬롯 토글되어도 8키 유지)

    단일성 제약(V-7) 덕에 한 OrderItem 은 정확히 한 키에만 카운트 (8 키 합계 = 전체 PAID 미발송).
    """
    has_send_item_subq = (
        db.query(SendItem.order_item_id)
        .join(Send, SendItem.send_id == Send.send_id)
        .filter(
            or_(
                SendItem.cancelled_at.is_(None),
                Send.send_status.in_(["DELIVERED", "CANCELLED"]),
            ),
        )
        .subquery()
    )

    result: Dict[str, int] = {"monthly": 0, "yearly": 0}
    for n in range(1, 7):
        result[f"vip{n}"] = 0

    active_slots = [s.slot_number for s in vip_slots.list_slots() if s.is_enabled]

    # monthly + yearly (KR + 활성 vipN 제외) — 단일 group_by 쿼리
    my_query = (
        db.query(OrderItem.product_kind, func.count(OrderItem.order_item_id))
        .join(Order, OrderItem.order_id == Order.order_id)
        .join(Address, OrderItem.address_id == Address.address_id)
        .filter(
            Order.order_status == "PAID",
            OrderItem.cancelled_at.is_(None),
            Address.country_code == "KR",
            ~OrderItem.order_item_id.in_(db.query(has_send_item_subq)),
        )
    )
    if active_slots:
        vip_columns = [getattr(Address, f"vip{n}") for n in active_slots]
        my_query = my_query.filter(not_(or_(*vip_columns)))
    for kind, cnt in my_query.group_by(OrderItem.product_kind).all():
        if kind == "MONTHLY":
            result["monthly"] = cnt
        elif kind == "YEARLY":
            result["yearly"] = cnt

    # 활성 vipN 각각 (country_code 무관, kind 무관)
    for n in active_slots:
        vip_col = getattr(Address, f"vip{n}")
        cnt = (
            db.query(func.count(OrderItem.order_item_id))
            .join(Order, OrderItem.order_id == Order.order_id)
            .join(Address, OrderItem.address_id == Address.address_id)
            .filter(
                Order.order_status == "PAID",
                OrderItem.cancelled_at.is_(None),
                vip_col.is_(True),
                ~OrderItem.order_item_id.in_(db.query(has_send_item_subq)),
            )
            .scalar()
        )
        result[f"vip{n}"] = cnt or 0

    return result
