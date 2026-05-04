"""[발송] PREPARING Send 격리 invariant 점검 스크립트.

PR2 V-9 회귀 테스트 — 시나리오 (a) / (d) / (e) 의 invariant 자동 검증.
PR1 V-8 (check_vip_singleness) 와 동일 패턴으로 운영 DB 에 점검을 돌린다.

검증 (격리 invariant):
  한 PREPARING Send 안의 모든 OrderItem 의 Address vip 슬롯 패턴(vip1..vip6)이 동일해야 한다.
  - 패턴이 다르면 monthly/yearly 그룹핑이 vipN OrderItem 을 잘못 묶었거나,
    vipN 탭 그룹핑이 다른 슬롯 OrderItem 을 잘못 묶음 (격리 깨짐)
  - 단일성 제약(V-7)으로 한 Address 에 vip 가 최대 1개 → 정상 운영 시 자연 만족

분포 출력 (참고용):
  - 활성 vip 슬롯별 PREPARING Send / OrderItem 수
  - monthly / yearly (vip 모두 false) PREPARING Send / OrderItem 수
  - PAID 미발송 OrderItem (현 시점 [발송 생성] 누르면 추가될 수)

사용법:
    cd backend && python scripts/check_dispatch_invariants.py
또는
    python -m backend.scripts.check_dispatch_invariants

종료 코드:
  0 — invariant 통과
  1 — invariant 위반 (운영자 조사 필요)
"""
# 표준 라이브러리
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# 서드파티 라이브러리
from sqlalchemy import not_, or_

# 로컬 애플리케이션
from app.core import vip_slots
from app.db.session import SessionLocal
from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.send import Send
from app.models.send_item import SendItem


def _vip_pattern(addr: Address) -> tuple:
    return tuple(bool(getattr(addr, f"vip{n}")) for n in range(1, 7))


def _pattern_label(pattern: tuple) -> str:
    active = [f"vip{n+1}" for n, v in enumerate(pattern) if v]
    return ",".join(active) if active else "<none>"


def check_send_vip_consistency(db) -> list:
    """invariant: 한 PREPARING Send 안의 OrderItem 들의 Address vip 패턴이 모두 동일.

    위반 = 한 Send 안에 다른 슬롯 또는 vip/non-vip 가 섞임 (격리 깨짐).
    """
    rows = (
        db.query(
            Send.send_id,
            Address.address_id,
            Address.vip1, Address.vip2, Address.vip3,
            Address.vip4, Address.vip5, Address.vip6,
        )
        .join(SendItem, SendItem.send_id == Send.send_id)
        .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
        .join(Address, Address.address_id == OrderItem.address_id)
        .filter(
            Send.send_status == "PREPARING",
            SendItem.cancelled_at.is_(None),
        )
        .all()
    )
    by_send: dict = {}
    for sid, addr_id, *vips in rows:
        pattern = tuple(bool(v) for v in vips)
        entry = by_send.setdefault(sid, {})
        entry.setdefault(pattern, []).append(addr_id)

    violations = []
    for sid, patterns in by_send.items():
        if len(patterns) > 1:
            violations.append({
                "send_id": sid,
                "patterns": {
                    _pattern_label(p): sorted(set(addr_ids))
                    for p, addr_ids in patterns.items()
                },
            })
    return violations


def collect_distribution(db) -> dict:
    """분포 카운트 (운영자 한눈에 파악용)."""
    active_slots = [s.slot_number for s in vip_slots.list_slots() if s.is_enabled]

    # vipN 별 PREPARING Send / OrderItem 수
    vip_counts: dict = {}
    for n in active_slots:
        vip_col = getattr(Address, f"vip{n}")
        send_count = (
            db.query(Send.send_id)
            .join(SendItem, SendItem.send_id == Send.send_id)
            .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
            .join(Address, Address.address_id == OrderItem.address_id)
            .filter(
                Send.send_status == "PREPARING",
                vip_col.is_(True),
                SendItem.cancelled_at.is_(None),
            )
            .distinct()
            .count()
        )
        oi_count = (
            db.query(SendItem.order_item_id)
            .join(Send, Send.send_id == SendItem.send_id)
            .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
            .join(Address, Address.address_id == OrderItem.address_id)
            .filter(
                Send.send_status == "PREPARING",
                vip_col.is_(True),
                SendItem.cancelled_at.is_(None),
            )
            .distinct()
            .count()
        )
        vip_counts[f"vip{n}"] = {"sends": send_count, "order_items": oi_count}

    # monthly / yearly (vip 모두 false) PREPARING 카운트
    def _kind_count(kind: str) -> dict:
        q_send = (
            db.query(Send.send_id)
            .join(SendItem, SendItem.send_id == Send.send_id)
            .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
            .filter(
                Send.send_status == "PREPARING",
                OrderItem.product_kind == kind,
                SendItem.cancelled_at.is_(None),
            )
        )
        q_oi = (
            db.query(SendItem.order_item_id)
            .join(Send, Send.send_id == SendItem.send_id)
            .join(OrderItem, OrderItem.order_item_id == SendItem.order_item_id)
            .filter(
                Send.send_status == "PREPARING",
                OrderItem.product_kind == kind,
                SendItem.cancelled_at.is_(None),
            )
        )
        if active_slots:
            vip_columns = [getattr(Address, f"vip{n}") for n in active_slots]
            q_send = (
                q_send
                .join(Address, Address.address_id == OrderItem.address_id)
                .filter(not_(or_(*vip_columns)))
            )
            q_oi = (
                q_oi
                .join(Address, Address.address_id == OrderItem.address_id)
                .filter(not_(or_(*vip_columns)))
            )
        return {"sends": q_send.distinct().count(), "order_items": q_oi.distinct().count()}

    monthly_yearly = {
        "monthly_no_vip": _kind_count("MONTHLY"),
        "yearly_no_vip": _kind_count("YEARLY"),
    }

    # PAID 미발송 (현 시점 [발송 생성] 시 추가될 수) — kind 별
    has_send_item_subq = (
        db.query(SendItem.order_item_id)
        .join(Send, Send.send_id == SendItem.send_id)
        .filter(
            or_(
                SendItem.cancelled_at.is_(None),
                Send.send_status.in_(["DELIVERED", "CANCELLED"]),
            ),
        )
        .subquery()
    )
    paid_unsent = {}
    for kind in ("MONTHLY", "YEARLY"):
        cnt = (
            db.query(OrderItem.order_item_id)
            .join(Order, OrderItem.order_id == Order.order_id)
            .join(Address, Address.address_id == OrderItem.address_id)
            .filter(
                Order.order_status == "PAID",
                OrderItem.cancelled_at.is_(None),
                OrderItem.product_kind == kind,
                ~OrderItem.order_item_id.in_(db.query(has_send_item_subq)),
            )
            .distinct()
            .count()
        )
        paid_unsent[kind] = cnt

    return {
        "active_slots": active_slots,
        "vip_preparing": vip_counts,
        "non_vip_preparing": monthly_yearly,
        "paid_unsent_by_kind": paid_unsent,
    }


def main() -> int:
    db = SessionLocal()
    try:
        # 1. invariant 검증 (격리)
        violations = check_send_vip_consistency(db)

        # 2. 분포 카운트 (참고)
        dist = collect_distribution(db)

        print("[격리 invariant] 한 PREPARING Send 안의 OrderItem 들의 Address vip 패턴 일관성")
        if violations:
            print(f"  [FAIL] {len(violations)}건 위반:")
            for v in violations:
                print(f"    - send_id={v['send_id']}")
                for label, addr_ids in v["patterns"].items():
                    print(f"        패턴 {label!r} → address_ids={addr_ids}")
        else:
            print("  [OK] 위반 없음.")

        print()
        print("[분포 카운트]")
        print(f"  활성 vip 슬롯: {dist['active_slots'] or '<없음>'}")
        if dist["vip_preparing"]:
            for slot, cnts in dist["vip_preparing"].items():
                print(f"  {slot} PREPARING : sends={cnts['sends']}  order_items={cnts['order_items']}")
        for label, cnts in dist["non_vip_preparing"].items():
            print(f"  {label} PREPARING : sends={cnts['sends']}  order_items={cnts['order_items']}")
        print("  PAID 미발송 (다음 [발송 생성] 시 추가될 OrderItem 수):")
        for kind, cnt in dist["paid_unsent_by_kind"].items():
            print(f"    {kind}: {cnt}")

        return 1 if violations else 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
