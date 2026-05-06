"""[발송] 박스 invariant 점검 스크립트.

PR2 V-9 회귀 테스트 + PR6.8.1 추가 — invariant 자동 검증.
PR1 V-8 (check_vip_singleness) 와 동일 패턴으로 운영 DB 에 점검을 돌린다.

검증 invariant 5종:
  1. PREPARING Send 격리 — 한 PREPARING Send 안의 OrderItem 들의 Address vip
     슬롯 패턴이 모두 동일 (단일성 V-7 + 그룹핑 격리)
  2. DELIVERED 박스 필수 필드 — send_method / courier_company / tracking_no /
     delivered_at 모두 채워져 있어야 함
  3. 빈 PREPARING 박스 — 활성 SendItem 0개 박스가 잔존하면 안 됨 (주문 취소
     수술적 제거 시 빈 박스 DELETE 누락 검출)
  4. 비활성 vip 슬롯 잔존 박스 — 슬롯이 is_enabled=false 인데 그 슬롯의
     PREPARING 박스가 잔존 (운영자가 슬롯 토글 후 정리 안 한 경우)
  5. CANCELLED 박스 일관성 — send_status=CANCELLED 면 cancelled_at 도 NOT NULL

분포 출력 (참고용):
  - 활성 vip 슬롯별 PREPARING Send / OrderItem 수
  - monthly / yearly (vip 모두 false) PREPARING Send / OrderItem 수
  - PAID 미발송 OrderItem (현 시점 [발송 생성] 누르면 추가될 수)

사용법:
    cd backend && python scripts/check_dispatch_invariants.py
또는
    python -m backend.scripts.check_dispatch_invariants

종료 코드:
  0 — invariant 모두 통과
  1 — invariant 위반 1건 이상 (운영자 조사 필요)
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


def check_delivered_required_fields(db) -> list:
    """invariant: DELIVERED 박스는 send_method / courier_company / tracking_no /
    delivered_at 모두 NOT NULL 이어야 한다.

    transition_send_to_delivered 로 들어왔다면 자동 보장. 위반 = 직접 SQL 수정
    또는 옛 데이터.
    """
    rows = (
        db.query(Send.send_id, Send.send_method, Send.courier_company,
                 Send.tracking_no, Send.delivered_at)
        .filter(Send.send_status == "DELIVERED")
        .all()
    )
    violations = []
    for sid, sm, cc, tn, da in rows:
        missing = []
        if not sm: missing.append("send_method")
        if not cc: missing.append("courier_company")
        if not tn: missing.append("tracking_no")
        if not da: missing.append("delivered_at")
        if missing:
            violations.append({"send_id": sid, "missing": missing})
    return violations


def check_empty_preparing_sends(db) -> list:
    """invariant: PREPARING 박스는 활성 SendItem 1개 이상이어야 한다.

    주문 취소 수술적 제거 (PLAN §7 #16) 시 빈 박스도 DELETE 하기로 했으나
    혹시 누락 케이스 검출. 빈 박스는 그룹핑 결과에 영향 없으나 데이터 청결도
    측면에서 정리 필요.
    """
    # 모든 PREPARING Send
    all_preparing = db.query(Send.send_id).filter(Send.send_status == "PREPARING").all()
    all_ids = {row[0] for row in all_preparing}
    # 활성 SendItem 가진 PREPARING Send
    with_items = (
        db.query(Send.send_id)
        .join(SendItem, SendItem.send_id == Send.send_id)
        .filter(
            Send.send_status == "PREPARING",
            SendItem.cancelled_at.is_(None),
        )
        .distinct()
        .all()
    )
    active_ids = {row[0] for row in with_items}
    return sorted(all_ids - active_ids)


def check_inactive_vip_slot_residue(db) -> list:
    """invariant: 슬롯이 is_enabled=false 인데 그 슬롯(Address.vipN=true) 의
    PREPARING 박스가 잔존하면 안 된다.

    운영자가 슬롯을 비활성 토글한 후 [발송 생성] 재실행 안 하면 잔존 가능.
    UI 는 fallback 처리하지만 데이터 잔존은 운영자가 정리해야 함.
    """
    inactive_slots = [s.slot_number for s in vip_slots.list_slots() if not s.is_enabled]
    violations = []
    for n in inactive_slots:
        vip_col = getattr(Address, f"vip{n}")
        send_ids = (
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
            .all()
        )
        if send_ids:
            violations.append({
                "slot_number": n,
                "send_ids": sorted([row[0] for row in send_ids]),
            })
    return violations


def check_cancelled_send_consistency(db) -> list:
    """invariant: send_status=CANCELLED 박스는 cancelled_at NOT NULL.

    새 흐름은 박스에 CANCELLED 를 새로 부여하지 않지만 옛 데이터 점검.
    """
    rows = (
        db.query(Send.send_id, Send.cancelled_at)
        .filter(Send.send_status == "CANCELLED")
        .all()
    )
    return [sid for sid, ca in rows if ca is None]


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
        any_fail = False

        # 1. PREPARING Send 격리
        violations = check_send_vip_consistency(db)
        print("[1] PREPARING Send 격리 — 한 박스 안 OrderItem vip 패턴 일관성")
        if violations:
            any_fail = True
            print(f"  [FAIL] {len(violations)}건 위반:")
            for v in violations:
                print(f"    - send_id={v['send_id']}")
                for label, addr_ids in v["patterns"].items():
                    print(f"        패턴 {label!r} → address_ids={addr_ids}")
        else:
            print("  [OK] 위반 없음.")

        # 2. DELIVERED 박스 필수 필드
        bad_delivered = check_delivered_required_fields(db)
        print()
        print("[2] DELIVERED 박스 필수 필드 — send_method/courier_company/tracking_no/delivered_at")
        if bad_delivered:
            any_fail = True
            print(f"  [FAIL] {len(bad_delivered)}건 누락:")
            for v in bad_delivered:
                print(f"    - send_id={v['send_id']}  missing={v['missing']}")
        else:
            print("  [OK] 위반 없음.")

        # 3. 빈 PREPARING 박스
        empty_ids = check_empty_preparing_sends(db)
        print()
        print("[3] 빈 PREPARING 박스 — 활성 SendItem 0개 박스 잔존")
        if empty_ids:
            any_fail = True
            print(f"  [FAIL] {len(empty_ids)}건 잔존: send_ids={empty_ids}")
            print("       → 주문 취소 수술적 제거 시 빈 박스 DELETE 누락 가능. 수동 정리 또는 [발송 생성] 재실행 권장.")
        else:
            print("  [OK] 위반 없음.")

        # 4. 비활성 vip 슬롯 잔존 박스
        inactive_residue = check_inactive_vip_slot_residue(db)
        print()
        print("[4] 비활성 vip 슬롯 PREPARING 박스 잔존")
        if inactive_residue:
            any_fail = True
            print(f"  [FAIL] {len(inactive_residue)}개 슬롯에 잔존:")
            for v in inactive_residue:
                print(f"    - vip{v['slot_number']} (비활성) → send_ids={v['send_ids']}")
            print("       → 슬롯 재활성화 후 [발송 생성] 재실행으로 정리 가능.")
        else:
            print("  [OK] 위반 없음.")

        # 5. CANCELLED 박스 일관성
        bad_cancelled = check_cancelled_send_consistency(db)
        print()
        print("[5] CANCELLED 박스 일관성 — cancelled_at NOT NULL")
        if bad_cancelled:
            any_fail = True
            print(f"  [FAIL] {len(bad_cancelled)}건 누락: send_ids={bad_cancelled}")
        else:
            print("  [OK] 위반 없음.")

        # 분포 카운트 (참고)
        dist = collect_distribution(db)
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

        return 1 if any_fail else 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
