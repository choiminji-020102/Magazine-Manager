"""배송지 변경 회귀 테스트.

핵심 회귀 — YEARLY 는 매월 그 호의 Send 가 새로 생성되므로, 지난 호가 모두 DELIVERED 여도
구독 종료 호가 남아 있으면 배송지를 바꿀 수 있어야 한다.
(이전 구현은 "PREPARING Send 가 없음 = 전 회차 발송 완료" 로 오판해 정기구독자의 이사를
 반영하지 못했다.)

개별 품목 변경(order_item_service.update_address) 과 주문 단위 일괄 변경
(order_service.change_order_address) 두 경로를 모두 검증한다.
"""
from itertools import count

import pytest

from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.send import Send
from app.models.send_item import SendItem
from app.schemas.order_item import OrderItemAddressUpdate
from app.services import order_item_service, order_service

CUSTOMER_ID = 1

# SQLite 는 BigInteger PK 를 자동증가시키지 않으므로 명시 지정한다
# (test_pagination_ordering.py 와 동일한 제약)
_pk = count(1)


# ── 픽스처 helper ─────────────────────────────────────────────────────────────

def _make_address(db, *, name="홍길동", postal="12345", addr="서울시 강남구 1", country="KR"):
    address = Address(
        address_id=next(_pk),
        customer_id=CUSTOMER_ID,
        recipient_name=name,
        recipient_phone="01011112222",
        country_code=country,
        postal_code=postal,
        recipient_address=addr,
        customer_memo="부재시 경비실",
    )
    db.add(address)
    db.flush()
    return address


def _make_order(db, address):
    order = Order(
        order_id=next(_pk),
        customer_id=CUSTOMER_ID,
        address_id=address.address_id,
        order_channel="OFFLINE",
        order_status="PAID",
    )
    db.add(order)
    db.flush()
    return order


def _make_item(db, order, address, *, kind="YEARLY", start="202512", end="202611", last_send=None):
    item = OrderItem(
        order_item_id=next(_pk),
        order_id=order.order_id,
        address_id=address.address_id,
        product_code=f"W0{'+' if kind == 'YEARLY' else '-'}{start}",
        product_kind=kind,
        product_name="말씀함께 [기본판]",
        subscribe_start_issue=start,
        subscribe_end_issue=end,
        final_subscribe_start_issue=start,
        final_subscribe_end_issue=end,
        subscribe_period=12 if kind == "YEARLY" else 1,
        last_send_issue=last_send,
    )
    db.add(item)
    db.flush()
    return item


def _make_send(db, item, address, *, issue, status):
    send = Send(
        send_id=next(_pk),
        address_id=address.address_id,
        send_status=status,
        recipient_name=address.recipient_name,
        recipient_phone=address.recipient_phone,
        country_code=address.country_code,
        postal_code=address.postal_code,
        recipient_address=address.recipient_address,
        customer_memo=address.customer_memo,
    )
    db.add(send)
    db.flush()
    send_item = SendItem(
        send_item_id=next(_pk),
        send_id=send.send_id,
        order_item_id=item.order_item_id,
        product_code=item.product_code,
        product_name=item.product_name,
        issue=issue,
    )
    db.add(send_item)
    db.flush()
    return send


def _issues(start_year_month, count):
    """연속된 호 목록 생성 — ('202512', 3) → ['202512', '202601', '202602']"""
    year, month = int(start_year_month[:4]), int(start_year_month[4:])
    out = []
    for _ in range(count):
        out.append(f"{year:04d}{month:02d}")
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return out


@pytest.fixture
def old_address(db):
    return _make_address(db, name="홍길동", postal="12345", addr="서울시 강남구 1")


@pytest.fixture
def new_address(db):
    return _make_address(db, name="홍길동", postal="54321", addr="부산시 해운대구 99")


# ── 개별 품목 배송지 변경 ─────────────────────────────────────────────────────

def test_yearly_지난호_전부발송완료_구독남으면_변경가능(db, old_address, new_address):
    """이번 회귀의 핵심 — 25.12 시작 구독이 26.07 까지 발송됐고 26.11 까지 남은 상황."""
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, start="202512", end="202611", last_send="202607")
    for issue in _issues("202512", 8):  # 202512 ~ 202607
        _make_send(db, item, old_address, issue=issue, status="DELIVERED")

    result = order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=new_address.address_id)
    )

    assert result.can_change is True
    assert item.address_id == new_address.address_id
    assert result.pending_issues == []               # PREPARING Send 는 없음
    assert len(result.already_shipped_issues) == 8
    assert "다음 호 발송분부터" in result.message


def test_yearly_구독완주하면_변경불가(db, old_address, new_address):
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, start="202512", end="202611", last_send="202611")
    for issue in _issues("202512", 12):  # 202512 ~ 202611 전부 발송
        _make_send(db, item, old_address, issue=issue, status="DELIVERED")

    result = order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=new_address.address_id)
    )

    assert result.can_change is False
    assert item.address_id == old_address.address_id  # 안 건드림
    assert len(result.already_shipped_issues) == 12


def test_monthly_발송완료면_변경불가(db, old_address, new_address):
    """MONTHLY 는 시작호 = 종료호(1회성) 이므로 발송 완료 = 끝."""
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, kind="MONTHLY", start="202607", end="202607")
    _make_send(db, item, old_address, issue="202607", status="DELIVERED")

    result = order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=new_address.address_id)
    )

    assert result.can_change is False
    assert item.address_id == old_address.address_id


def test_send이_아직_없는_신규주문은_변경가능(db, old_address, new_address):
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, kind="MONTHLY", start="202609", end="202609")

    result = order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=new_address.address_id)
    )

    assert result.can_change is True
    assert item.address_id == new_address.address_id
    assert result.already_shipped_issues == []


def test_preparing_send는_스냅샷필드까지_동기화된다(db, old_address, new_address):
    """이미 만들어진 발송 건은 재생성 없이 새 주소가 반영돼야 한다 (엑셀이 Send 스냅샷을 읽음)."""
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, start="202512", end="202611", last_send="202607")
    _make_send(db, item, old_address, issue="202607", status="DELIVERED")
    preparing = _make_send(db, item, old_address, issue="202608", status="PREPARING")

    result = order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=new_address.address_id)
    )

    assert result.can_change is True
    assert result.pending_issues == ["202608"]
    assert preparing.address_id == new_address.address_id
    assert preparing.recipient_name == new_address.recipient_name
    assert preparing.recipient_phone == new_address.recipient_phone
    assert preparing.postal_code == new_address.postal_code
    assert preparing.recipient_address == new_address.recipient_address
    assert preparing.country_code == new_address.country_code
    assert preparing.customer_memo == new_address.customer_memo


def test_delivered_send는_옛주소_그대로_보존된다(db, old_address, new_address):
    """발송 기록은 당시 주소를 유지해야 한다."""
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, start="202512", end="202611", last_send="202607")
    delivered = _make_send(db, item, old_address, issue="202607", status="DELIVERED")

    order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=new_address.address_id)
    )

    assert delivered.address_id == old_address.address_id
    assert delivered.recipient_address == old_address.recipient_address
    assert delivered.postal_code == old_address.postal_code


def test_해외주소_yearly도_동일하게_변경된다(db, old_address):
    """country_code 필터는 발송 그룹화 단계의 관심사 — 배송지 변경 자체는 막지 않는다."""
    overseas = _make_address(db, postal="99999", addr="Tokyo, Japan", country="JP")
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, start="202512", end="202611", last_send="202607")
    _make_send(db, item, old_address, issue="202607", status="DELIVERED")

    result = order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=overseas.address_id)
    )

    assert result.can_change is True
    assert item.address_id == overseas.address_id


def test_없는_배송지면_404(db, old_address):
    from fastapi import HTTPException

    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address)

    with pytest.raises(HTTPException) as exc:
        order_item_service.update_address(
            db, item, OrderItemAddressUpdate(address_id=999999)
        )
    assert exc.value.status_code == 404


# ── 주문 단위 일괄 변경 ───────────────────────────────────────────────────────

def test_일괄변경_yearly는_바뀌고_완료된monthly는_유지된다(db, old_address, new_address):
    """한 주문에 정기구독(남음) + 단품(발송완료) 이 섞인 경우."""
    order = _make_order(db, old_address)

    yearly = _make_item(db, order, old_address, start="202512", end="202611", last_send="202607")
    for issue in _issues("202512", 8):
        _make_send(db, yearly, old_address, issue=issue, status="DELIVERED")

    monthly_done = _make_item(db, order, old_address, kind="MONTHLY", start="202607", end="202607")
    _make_send(db, monthly_done, old_address, issue="202607", status="DELIVERED")

    monthly_new = _make_item(db, order, old_address, kind="MONTHLY", start="202609", end="202609")

    order_service.change_order_address(db, order, new_address.address_id)
    db.commit()

    assert yearly.address_id == new_address.address_id       # 구독 남음 → 변경
    assert monthly_done.address_id == old_address.address_id  # 발송 완료 → 유지
    assert monthly_new.address_id == new_address.address_id   # 미발송 → 변경


def test_일괄변경_취소된품목은_제외된다(db, old_address, new_address):
    from datetime import datetime

    order = _make_order(db, old_address)
    active = _make_item(db, order, old_address, start="202512", end="202611")
    cancelled = _make_item(db, order, old_address, start="202512", end="202611")
    cancelled.cancelled_at = datetime(2026, 7, 1)
    db.flush()

    order_service.change_order_address(db, order, new_address.address_id)
    db.commit()

    assert active.address_id == new_address.address_id
    assert cancelled.address_id == old_address.address_id


def test_일괄변경_preparing_send_스냅샷도_동기화된다(db, old_address, new_address):
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, start="202512", end="202611", last_send="202607")
    preparing = _make_send(db, item, old_address, issue="202608", status="PREPARING")

    order_service.change_order_address(db, order, new_address.address_id)
    db.commit()

    assert item.address_id == new_address.address_id
    assert preparing.recipient_address == new_address.recipient_address
    assert preparing.postal_code == new_address.postal_code


def test_일괄변경_없는_배송지면_404(db, old_address):
    from fastapi import HTTPException

    order = _make_order(db, old_address)
    _make_item(db, order, old_address)

    with pytest.raises(HTTPException) as exc:
        order_service.change_order_address(db, order, 999999)
    assert exc.value.status_code == 404


# ── 쿼리 효율 ─────────────────────────────────────────────────────────────────

def test_발송이력이_많아도_send를_건건이_조회하지_않는다(db, captured_sql, old_address, new_address):
    """`si.send` lazy load N+1 회귀 방지 — 12개월치 발송 이력이 있어도 Send 조회는 한 번."""
    order = _make_order(db, old_address)
    item = _make_item(db, order, old_address, start="202512", end="202711", last_send="202611")
    for issue in _issues("202512", 12):
        _make_send(db, item, old_address, issue=issue, status="DELIVERED")

    captured_sql.clear()
    order_item_service.update_address(
        db, item, OrderItemAddressUpdate(address_id=new_address.address_id)
    )

    send_selects = [s for s in captured_sql if s.lstrip().upper().startswith("SELECT") and "sends" in s]
    assert len(send_selects) <= 2, (
        f"Send 조회 쿼리가 {len(send_selects)}건 — 발송 건수에 비례하면 N+1. 실행된 쿼리:\n"
        + "\n".join(send_selects)
    )


# ── 판정 helper 단위 검증 ─────────────────────────────────────────────────────

@pytest.mark.parametrize(
    "kind,end_issue,last_send,shipped,expected",
    [
        ("YEARLY", "202611", "202607", ["202607"], True),    # 구독 남음
        ("YEARLY", "202611", "202611", ["202611"], False),   # 완주
        ("YEARLY", "202611", None, ["202607"], True),        # 레거시 이관분 (last_send NULL)
        ("YEARLY", "202611", "202611", ["202607"], False),   # last_send 가 더 최신
        ("YEARLY", "202611", None, [], True),                # 발송 전 — 전 회차가 남음
        ("MONTHLY", "202607", None, ["202607"], False),      # 단품 발송 완료 — 끝
        ("MONTHLY", "202607", None, [], True),               # 단품 발송 전 — 그 한 번이 남음
    ],
)
def test_has_remaining_send_issues(db, old_address, kind, end_issue, last_send, shipped, expected):
    order = _make_order(db, old_address)
    item = _make_item(
        db, order, old_address, kind=kind, start="202512", end=end_issue, last_send=last_send
    )
    assert order_item_service._has_remaining_send_issues(item, shipped) is expected
