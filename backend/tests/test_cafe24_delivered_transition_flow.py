"""발송완료 처리(YEARLY) 전체 흐름 통합 테스트 — 카페24 상태별 분기 검증.

단위 테스트(test_cafe24_shipment_partial_failure.py)가 판정 규칙 하나하나를 본다면,
여기서는 transition_sends_to_delivered_batch 를 실제로 돌려서 **DB 가 어떻게 바뀌는지**
(send_status / last_send_issue / delivered_at)와 **카페24로 무엇이 나가는지**(PUT payload)를
함께 확인한다.

정책 (2026-08-25 확정):
  - 카페24 standby(배송대기)  → PUT 전송 → 성공 → DELIVERED
  - 카페24 shipping(배송중)   → PUT 이 422 In transit 으로 거부되지만 성공으로 판정 → DELIVERED
  - 카페24 shipped(배송완료)  → PUT 을 아예 보내지 않음 → 실패 → PREPARING 유지
  - 상태 조회 실패            → 보내지 않음 → 실패 → PREPARING 유지 ("모르면 건드리지 않는다")
  - 한 Send 안에 보류 대상이 섞이면 그 Send 의 품목은 하나도 보내지 않는다
    (Send.send_status 는 하나뿐이라 일부만 전환하면 카페24만 앞서가는 불일치가 생긴다)

→ docs/troubleshooting/cafe24-shipment-status-deadlock.md
"""
import asyncio
from itertools import count

import pytest

from app.models.address import Address
from app.models.customer import Customer
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.send import Send
from app.models.send_item import SendItem
from app.services import cafe24_admin_service, send_service

_pk = count(1)
ISSUE = "202609"


# ── 픽스처 helper ─────────────────────────────────────────────────────────────

def _make_customer(db):
    c = Customer(
        customer_id=next(_pk),
        create_channel="CAFE24",
        customer_name="홍길동",
        customer_phone="01011112222",
        customer_phone_num4="2222",
    )
    db.add(c)
    db.flush()
    return c


def _make_address(db, customer):
    a = Address(
        address_id=next(_pk),
        customer_id=customer.customer_id,
        recipient_name="홍길동",
        recipient_phone="01011112222",
        country_code="KR",
        postal_code="12345",
        recipient_address="서울시 강남구 1",
    )
    db.add(a)
    db.flush()
    return a


def _make_product(db, product_code):
    existing = db.query(Product).filter(Product.product_code == product_code).first()
    if existing is not None:
        return existing  # 여러 Send 가 같은 상품을 쓴다 (product_code 는 UNIQUE)
    p = Product(
        product_id=next(_pk),
        product_code=product_code,
        product_name="말씀함께 [기본판]",
        product_kind="YEARLY",
        list_price=10000,
        sale_price=10000,
    )
    db.add(p)
    db.flush()
    return p


def _make_yearly_send(db, *, external_order_id, shipping_code, external_order_item_id,
                      customer, address, last_send_issue=None):
    """PREPARING Send 1개 + YEARLY OrderItem 1개(1:1)를 만든다.

    YEARLY 는 group_yearly_for_send 가 1 OrderItem = 1 Send 로 묶으므로 이 형태가 정상이다.
    """
    order = Order(
        order_id=next(_pk),
        external_order_id=external_order_id,
        customer_id=customer.customer_id,
        address_id=address.address_id,
        order_channel="CAFE24",
        order_status="PAID",
        total_amount=10000,
        payment_amount=10000,
    )
    db.add(order)
    db.flush()

    product_code = f"W0+{ISSUE}"
    _make_product(db, product_code)

    oi = OrderItem(
        order_item_id=next(_pk),
        external_order_item_id=external_order_item_id,
        order_id=order.order_id,
        address_id=address.address_id,
        product_code=product_code,
        product_kind="YEARLY",
        product_name="말씀함께 [기본판]",
        list_price=10000,
        sale_price=10000,
        order_num=1,
        subscribe_start_issue=ISSUE,
        subscribe_end_issue="202708",
        final_subscribe_start_issue=ISSUE,
        final_subscribe_end_issue="202708",
        subscribe_period=12,
        last_send_issue=last_send_issue,
        cafe24_shipping_code=shipping_code,
    )
    db.add(oi)
    db.flush()

    send = Send(
        send_id=next(_pk),
        address_id=address.address_id,
        send_status="PREPARING",
        recipient_name="홍길동",
        recipient_phone="01011112222",
        country_code="KR",
        postal_code="12345",
        recipient_address="서울시 강남구 1",
    )
    db.add(send)
    db.flush()

    si = SendItem(
        send_item_id=next(_pk),
        send_id=send.send_id,
        order_item_id=oi.order_item_id,
        product_code=product_code,
        product_name="말씀함께 [기본판]",
        issue=ISSUE,
        send_num=1,
        cost_price=0,
    )
    db.add(si)
    db.flush()
    return send, oi


def _add_item_to_send(db, send, *, external_order_id, shipping_code, external_order_item_id,
                      customer, address):
    """이미 있는 Send 에 YEARLY 품목을 하나 더 붙인다 (VIP 박스처럼 혼합된 경우)."""
    _s, oi = _make_yearly_send(
        db,
        external_order_id=external_order_id,
        shipping_code=shipping_code,
        external_order_item_id=external_order_item_id,
        customer=customer,
        address=address,
    )
    # 방금 만들어진 Send/SendItem 중 SendItem 만 대상 Send 로 옮긴다
    si = db.query(SendItem).filter(SendItem.order_item_id == oi.order_item_id).one()
    si.send_id = send.send_id
    db.flush()
    return oi


# ── 카페24 목 ─────────────────────────────────────────────────────────────────

class _Cafe24Stub:
    """fetch_shipment_statuses / put_shipments_tolerant 를 대체하고 호출 내역을 기록한다."""

    def __init__(self, statuses: dict):
        self.statuses = statuses          # shipping_code → status ("standby"/"shipping"/"shipped")
        self.put_payloads = []            # 실제로 카페24에 나간 요청

    async def fetch_shipment_statuses(self, *, db, client, order_ids):
        # 조회 실패는 "매핑에 없음"으로 표현된다 (호출자가 None 으로 간주)
        return {code: st for code, st in self.statuses.items() if st is not None}

    async def put_shipments_tolerant(self, *, db, client, requests_payload):
        self.put_payloads.append(list(requests_payload))
        failed = []
        for req in requests_payload:
            if self.statuses.get(req["shipping_code"]) == "shipping":
                # 이미 배송중 → 카페24가 422 로 거부 (실제 관측 형태)
                failed.append({
                    "item": req,
                    "reason": "Cafe24 Shipments API 오류 (422): ...",
                    "code": 422,
                    "message": "This status cannot be applied to this order. "
                               "(Current order status: In transit)",
                    "more_info": {
                        "shop_no": 1,
                        "order_id": req["order_id"],
                        "status": "shipping",
                        "shipping_code": req["shipping_code"],
                        "status_additional_info": None,
                    },
                })
        return [], failed


@pytest.fixture
def cafe24(monkeypatch):
    def _install(statuses):
        stub = _Cafe24Stub(statuses)
        monkeypatch.setattr(cafe24_admin_service, "fetch_shipment_statuses",
                            stub.fetch_shipment_statuses)
        monkeypatch.setattr(cafe24_admin_service, "put_shipments_tolerant",
                            stub.put_shipments_tolerant)
        return stub
    return _install


def _run(db, sends):
    return asyncio.run(
        send_service.transition_sends_to_delivered_batch(
            db=db,
            sends_input=[(s.send_id, "자체배송") for s in sends],
            send_method="기출유우편",
            courier_company="자체배송",
            client=None,
        )
    )


# ── 상태별 분기 ───────────────────────────────────────────────────────────────

@pytest.mark.parametrize("cafe24_status, expect_delivered, expect_sent", [
    ("standby", True, True),    # 배송대기 → 전송 → 성공
    ("shipping", True, True),   # 배송중 → 전송하지만 422 → 성공으로 판정
    ("shipped", False, False),  # 배송완료 → 전송 안 함 → 실패
    (None, False, False),       # 조회 실패 → 전송 안 함 → 실패
])
def test_transition_by_cafe24_status(db, cafe24, cafe24_status, expect_delivered, expect_sent):
    customer = _make_customer(db)
    address = _make_address(db, customer)
    send, oi = _make_yearly_send(
        db, external_order_id="20260901-0000001", shipping_code="CODE-A",
        external_order_item_id="20260901-0000001-01", customer=customer, address=address,
    )
    db.commit()
    stub = cafe24({"CODE-A": cafe24_status})

    ok_count, _synced, failed = _run(db, [send])

    assert bool(stub.put_payloads) is expect_sent, "카페24로 나간 요청 유무가 기대와 다르다"
    if expect_delivered:
        assert ok_count == 1 and failed == []
        assert send.send_status == "DELIVERED"
        assert send.delivered_at is not None
        assert oi.last_send_issue == ISSUE, "YEARLY 는 DELIVERED 시 last_send_issue 가 갱신된다"
    else:
        assert ok_count == 0 and len(failed) == 1
        assert send.send_status == "PREPARING"
        assert oi.last_send_issue is None
        assert failed[0]["category"] == "cafe24"


def test_shipped_failure_reason_is_actionable(db, cafe24):
    """배송완료 건의 실패 사유는 관리자가 무엇을 해야 하는지 알 수 있어야 한다."""
    customer = _make_customer(db)
    address = _make_address(db, customer)
    send, _oi = _make_yearly_send(
        db, external_order_id="20260901-0000001", shipping_code="CODE-A",
        external_order_item_id="20260901-0000001-01", customer=customer, address=address,
    )
    db.commit()
    cafe24({"CODE-A": "shipped"})

    _ok, _synced, failed = _run(db, [send])

    assert "배송완료" in failed[0]["reason"]


# ── 섞인 배치: 건별로 갈려야 한다 (핵심 회귀) ─────────────────────────────────

def test_mixed_batch_processes_each_send_independently(db, cafe24):
    """한 배치에 standby/shipping/shipped 가 섞여도 서로를 죽이지 않는다.

    이전 구현은 응답에 errors 가 하나라도 있으면 배치 전체를 실패 처리해서,
    정상 처리됐어야 할 건까지 PREPARING 으로 남았다 (2026-08-03 장애).
    """
    customer = _make_customer(db)
    address = _make_address(db, customer)
    send_a, oi_a = _make_yearly_send(
        db, external_order_id="20260901-0000001", shipping_code="CODE-A",
        external_order_item_id="20260901-0000001-01", customer=customer, address=address,
    )
    send_b, oi_b = _make_yearly_send(
        db, external_order_id="20260901-0000002", shipping_code="CODE-B",
        external_order_item_id="20260901-0000002-01", customer=customer, address=address,
    )
    send_c, oi_c = _make_yearly_send(
        db, external_order_id="20260901-0000003", shipping_code="CODE-C",
        external_order_item_id="20260901-0000003-01", customer=customer, address=address,
    )
    db.commit()
    stub = cafe24({"CODE-A": "standby", "CODE-B": "shipping", "CODE-C": "shipped"})

    ok_count, _synced, failed = _run(db, [send_a, send_b, send_c])

    assert ok_count == 2, "standby·shipping 두 건은 성공해야 한다"
    assert send_a.send_status == "DELIVERED" and oi_a.last_send_issue == ISSUE
    assert send_b.send_status == "DELIVERED" and oi_b.last_send_issue == ISSUE
    assert send_c.send_status == "PREPARING" and oi_c.last_send_issue is None
    assert [f["send_id"] for f in failed] == [send_c.send_id]

    # shipped 인 CODE-C 는 카페24로 나가지 않아야 한다
    sent_codes = {r["shipping_code"] for payload in stub.put_payloads for r in payload}
    assert sent_codes == {"CODE-A", "CODE-B"}


# ── 한 Send 안에 보류 대상이 섞인 경우 ────────────────────────────────────────

def test_blocked_send_sends_nothing_at_all(db, cafe24):
    """한 Send 안에 shipped 가 섞이면 같은 Send 의 standby 품목도 보내지 않는다.

    보내면 카페24만 shipping 으로 앞서가고 Send 는 PREPARING 으로 남아
    되돌릴 수 없는 새 불일치가 생긴다.
    """
    customer = _make_customer(db)
    address = _make_address(db, customer)
    send, oi_a = _make_yearly_send(
        db, external_order_id="20260901-0000001", shipping_code="CODE-A",
        external_order_item_id="20260901-0000001-01", customer=customer, address=address,
    )
    oi_b = _add_item_to_send(
        db, send, external_order_id="20260901-0000002", shipping_code="CODE-B",
        external_order_item_id="20260901-0000002-01", customer=customer, address=address,
    )
    db.commit()
    stub = cafe24({"CODE-A": "standby", "CODE-B": "shipped"})

    ok_count, _synced, failed = _run(db, [send])

    assert stub.put_payloads == [], "보류된 Send 의 품목은 하나도 보내면 안 된다"
    assert ok_count == 0
    assert send.send_status == "PREPARING"
    assert oi_a.last_send_issue is None and oi_b.last_send_issue is None
    assert len(failed) == 1 and failed[0]["send_id"] == send.send_id


# ── VIP Send: 정기+단품 혼합 박스 ─────────────────────────────────────────────

def _add_monthly_item_to_send(db, send, *, external_order_id, external_order_item_id,
                              customer, address):
    """VIP 박스처럼 같은 Send 에 MONTHLY 품목을 붙인다."""
    order = Order(
        order_id=next(_pk),
        external_order_id=external_order_id,
        customer_id=customer.customer_id,
        address_id=address.address_id,
        order_channel="CAFE24",
        order_status="PAID",
        total_amount=5000,
        payment_amount=5000,
    )
    db.add(order)
    db.flush()

    product_code = f"W0-{ISSUE}"
    existing = db.query(Product).filter(Product.product_code == product_code).first()
    if existing is None:
        db.add(Product(
            product_id=next(_pk), product_code=product_code,
            product_name="단품", product_kind="MONTHLY",
            list_price=5000, sale_price=5000,
        ))
        db.flush()

    oi = OrderItem(
        order_item_id=next(_pk),
        external_order_item_id=external_order_item_id,
        order_id=order.order_id,
        address_id=address.address_id,
        product_code=product_code,
        product_kind="MONTHLY",
        product_name="단품",
        list_price=5000,
        sale_price=5000,
        order_num=1,
        subscribe_start_issue=ISSUE,
        subscribe_end_issue=ISSUE,
        final_subscribe_start_issue=ISSUE,
        final_subscribe_end_issue=ISSUE,
        subscribe_period=1,
    )
    db.add(oi)
    db.flush()
    db.add(SendItem(
        send_item_id=next(_pk), send_id=send.send_id, order_item_id=oi.order_item_id,
        product_code=product_code, product_name="단품", issue=ISSUE, send_num=1, cost_price=0,
    ))
    db.flush()
    return oi


class _MixedStub(_Cafe24Stub):
    """MONTHLY POST 도 기록하는 스텁."""

    def __init__(self, statuses):
        super().__init__(statuses)
        self.post_payloads = []

    async def post_shipments_tolerant(self, *, db, client, requests_payload):
        self.post_payloads.append(list(requests_payload))
        return [], []


def test_blocked_yearly_also_blocks_monthly_in_same_send(db, monkeypatch):
    """VIP 박스에서 YEARLY 가 보류되면 같은 Send 의 MONTHLY 도 카페24로 나가면 안 된다.

    MONTHLY POST 가 YEARLY 판정보다 먼저 실행되던 시절에는, MONTHLY 만 카페24에 등록되고
    Send 는 PREPARING 으로 남아 되돌릴 수 없는 불일치가 생겼다. 그래서 사전 조회·보류 판정을
    MONTHLY POST 앞으로 옮겼다.
    """
    customer = _make_customer(db)
    address = _make_address(db, customer)
    send, oi_yearly = _make_yearly_send(
        db, external_order_id="20260901-0000001", shipping_code="CODE-A",
        external_order_item_id="20260901-0000001-01", customer=customer, address=address,
    )
    oi_monthly = _add_monthly_item_to_send(
        db, send, external_order_id="20260901-0000002",
        external_order_item_id="20260901-0000002-01", customer=customer, address=address,
    )
    db.commit()

    stub = _MixedStub({"CODE-A": "shipped"})   # YEARLY 가 이미 배송완료 → 보류
    monkeypatch.setattr(cafe24_admin_service, "fetch_shipment_statuses",
                        stub.fetch_shipment_statuses)
    monkeypatch.setattr(cafe24_admin_service, "put_shipments_tolerant",
                        stub.put_shipments_tolerant)
    monkeypatch.setattr(cafe24_admin_service, "post_shipments_tolerant",
                        stub.post_shipments_tolerant)

    ok_count, _synced, failed = _run(db, [send])

    assert stub.post_payloads == [], "보류된 Send 의 MONTHLY 품목도 보내면 안 된다"
    assert stub.put_payloads == []
    assert ok_count == 0
    assert send.send_status == "PREPARING"
    assert oi_monthly.cafe24_shipping_code is None
    assert oi_yearly.last_send_issue is None
    assert len(failed) == 1


# ── 인증 실패는 삼키지 않는다 ─────────────────────────────────────────────────

def test_auth_failure_is_not_swallowed_as_unknown_status(db, monkeypatch):
    """토큰 만료(HTTPException)는 '상태 조회 실패'로 뭉개지 말고 그대로 올라와야 한다.

    삼키면 전 건이 "잠시 후 다시 시도해주세요"로 실패하는데, 실제로는 카페24 재연결이
    필요해서 아무리 기다려도 풀리지 않는다 — 원인을 가리는 안내가 된다.
    """
    from fastapi import HTTPException

    customer = _make_customer(db)
    address = _make_address(db, customer)
    send, _oi = _make_yearly_send(
        db, external_order_id="20260901-0000001", shipping_code="CODE-A",
        external_order_item_id="20260901-0000001-01", customer=customer, address=address,
    )
    db.commit()

    async def _raise_auth(**kwargs):
        raise HTTPException(status_code=401, detail="Cafe24 refresh_token이 없습니다. 재연결이 필요합니다.")

    monkeypatch.setattr(cafe24_admin_service, "call_cafe24", _raise_auth)

    with pytest.raises(HTTPException) as exc:
        _run(db, [send])

    assert exc.value.status_code == 401
    assert send.send_status == "PREPARING"
