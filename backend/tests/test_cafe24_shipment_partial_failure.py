"""카페24 배송상태 전환의 부분 실패 처리 회귀 테스트.

핵심 회귀 — 배치 안의 한 건이 실패해도 **나머지 건까지 통째로 실패 처리하면 안 된다.**
(이전 구현은 응답에 errors 가 하나라도 있으면 `return None` 으로 성공분 정보를 버려서,
 카페24에서는 이미 전환된 건까지 우리 DB 에 반영되지 않았다.)

두 번째 회귀 — 카페24 배송상태 전환 API 는 멱등하지 않아 이미 배송중인 주문에
status="shipping" 을 다시 보내면 422 "(Current order status: In transit)" 로 거부한다.
이건 우리가 원하는 상태에 이미 도달했다는 뜻이므로 성공으로 봐야 한다. 그러지 않으면
한 번 어긋난 건이 재시도할 때마다 같은 422 를 맞아 영원히 DELIVERED 로 넘어가지 못한다.

→ docs/troubleshooting/cafe24-shipment-status-deadlock.md

부수 검증 — HTTP 422 응답에서도 body 의 errors 를 읽어야 한다(실제로 배치는 HTTP 200 +
errors, 단건은 HTTP 422 + errors 로 관측됐다). 그리고 errors 를 요청 항목에 전부
매칭하지 못하면 판정 근거가 불완전하므로 종래대로 "배치 전체 실패"로 떨어져야 한다.
"""
import asyncio
import json

import httpx
import pytest

from app.services import cafe24_admin_service, send_service


# ── helper ────────────────────────────────────────────────────────────────────

def _in_transit_error(order_id: str, shipping_code: str) -> dict:
    """실제 카페24 응답에서 그대로 옮긴 형태(2026-08-25 관측)."""
    return {
        "code": 422,
        "message": "This status cannot be applied to this order. (Current order status: In transit)",
        "more_info": {
            "shop_no": 1,
            "order_id": order_id,
            "status": "shipping",
            "shipping_code": shipping_code,
            "status_additional_info": None,
        },
    }


def _yearly_req(order_id: str, shipping_code: str) -> dict:
    return {"order_id": order_id, "shipping_code": shipping_code, "status": "shipping"}


def _response(status_code: int, body: dict) -> httpx.Response:
    return httpx.Response(
        status_code,
        content=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        request=httpx.Request("PUT", "https://example.test/shipments"),
    )


def _patch_cafe24(monkeypatch, response: httpx.Response):
    """call_cafe24 를 고정 응답으로 대체. db/client 는 실제로 쓰이지 않는다."""
    async def _fake(**kwargs):
        return response

    monkeypatch.setattr(cafe24_admin_service, "call_cafe24", _fake)


def _run_tolerant(payload):
    return asyncio.run(
        cafe24_admin_service._call_shipments_tolerant(
            method="PUT", db=None, client=None, requests_payload=payload
        )
    )


# ── 부분 실패: 실패한 항목만 남아야 한다 ───────────────────────────────────────

@pytest.mark.parametrize("http_status_code", [200, 422])
def test_partial_failure_keeps_successful_items(monkeypatch, http_status_code):
    """3건 중 1건만 errors 에 있으면, 실패 항목도 1건이어야 한다.

    http 200 + errors / http 422 + errors 두 형태 모두 실제로 관측됐으므로 둘 다 검증한다.
    (이전 구현은 422 일 때 body 를 아예 파싱하지 않아 errors 를 통째로 잃었다.)
    """
    payload = [
        _yearly_req("20260101-0000002", "D-20260101-0000002-00"),
        _yearly_req("20260101-0000004", "D-20260101-0000004-00"),
        _yearly_req("20260101-0000005", "D-20260101-0000005-00"),
    ]
    body = {"errors": [_in_transit_error("20260101-0000004", "D-20260101-0000004-00")]}
    _patch_cafe24(monkeypatch, _response(http_status_code, body))

    _shipments, failed_items = _run_tolerant(payload)

    assert len(failed_items) == 1, "errors 에 없는 2건까지 실패 처리되면 안 된다"
    assert failed_items[0]["item"]["shipping_code"] == "D-20260101-0000004-00"
    assert failed_items[0]["code"] == 422
    assert failed_items[0]["more_info"]["order_id"] == "20260101-0000004"


def test_all_items_failing_are_all_reported(monkeypatch):
    """전부 실패하면 전부 실패로 나와야 한다(반대 방향 과잉 보정 방지)."""
    payload = [
        _yearly_req("20260101-0000002", "D-20260101-0000002-00"),
        _yearly_req("20260101-0000004", "D-20260101-0000004-00"),
    ]
    body = {"errors": [
        _in_transit_error("20260101-0000002", "D-20260101-0000002-00"),
        _in_transit_error("20260101-0000004", "D-20260101-0000004-00"),
    ]}
    _patch_cafe24(monkeypatch, _response(422, body))

    _shipments, failed_items = _run_tolerant(payload)

    assert len(failed_items) == 2


# ── 매칭 불가 시에는 안전하게 배치 전체 실패 ──────────────────────────────────

def test_unmatchable_errors_fall_back_to_whole_batch(monkeypatch):
    """errors 를 요청 항목에 붙이지 못하면 배치 전체를 실패로 돌린다.

    일부만 붙이고 나머지를 성공으로 넘기면, 매칭 못 한 오류에 해당하는 요청이
    성공으로 오판된다. 근거가 불완전할 때는 종래의 안전한 동작으로 떨어져야 한다.
    """
    payload = [
        _yearly_req("20260101-0000002", "D-20260101-0000002-00"),
        _yearly_req("20260101-0000004", "D-20260101-0000004-00"),
    ]
    # 이 배치에 없는 shipping_code / order_id
    body = {"errors": [_in_transit_error("99999999-9999999", "D-99999999-9999999-00")]}
    _patch_cafe24(monkeypatch, _response(422, body))

    _shipments, failed_items = _run_tolerant(payload)

    assert len(failed_items) == 2, "특정 불가한 오류가 있으면 배치 전체가 실패여야 한다"
    assert all(fi["code"] is None for fi in failed_items), "폴백 항목엔 건별 판정 근거가 없다"


def test_non_json_error_body_falls_back_to_whole_batch(monkeypatch):
    """JSON 이 아닌 오류 응답(게이트웨이 오류 등)도 배치 전체 실패로 처리된다."""
    payload = [_yearly_req("20260101-0000002", "D-20260101-0000002-00")]
    monkeypatch.setattr(
        cafe24_admin_service,
        "call_cafe24",
        lambda **kwargs: _async_value(
            httpx.Response(
                502,
                content=b"<html>Bad Gateway</html>",
                request=httpx.Request("PUT", "https://example.test/shipments"),
            )
        ),
    )

    _shipments, failed_items = _run_tolerant(payload)

    assert len(failed_items) == 1
    assert failed_items[0]["code"] is None


def _async_value(value):
    async def _coro():
        return value
    return _coro()


# ── "이미 그 상태" 판정 ───────────────────────────────────────────────────────

def test_in_transit_is_treated_as_already_in_requested_state():
    failed_item = {
        "item": _yearly_req("20260101-0000002", "D-20260101-0000002-00"),
        "reason": "...",
        **{k: v for k, v in _in_transit_error("20260101-0000002", "D-20260101-0000002-00").items()
           if k in ("code", "message", "more_info")},
    }
    assert send_service._is_already_in_requested_state(failed_item) is True


@pytest.mark.parametrize(
    "mutate, why",
    [
        ({"code": 400}, "422 가 아닌 오류는 '이미 그 상태'가 아니다"),
        ({"message": "Order not found."}, "다른 사유의 422 를 성공으로 넘기면 안 된다"),
        ({"more_info": {"status": "shipped", "order_id": "x"}},
         "요청한 status 와 현재 상태가 다르면 성공으로 볼 수 없다"),
        ({"more_info": {}}, "판정 근거가 없으면 실패로 남긴다"),
        ({"message": None}, "메시지가 없으면 판정 불가 → 실패로 남긴다"),
    ],
)
def test_other_failures_are_not_treated_as_success(mutate, why):
    failed_item = {
        "item": _yearly_req("20260101-0000002", "D-20260101-0000002-00"),
        "reason": "...",
        **{k: v for k, v in _in_transit_error("20260101-0000002", "D-20260101-0000002-00").items()
           if k in ("code", "message", "more_info")},
    }
    failed_item.update(mutate)
    assert send_service._is_already_in_requested_state(failed_item) is False, why


def test_fallback_items_are_not_treated_as_success():
    """매칭 실패 폴백 항목(code=None)은 절대 성공으로 판정되면 안 된다."""
    fallback = {"item": {}, "reason": "...", "code": None, "message": None, "more_info": None}
    assert send_service._is_already_in_requested_state(fallback) is False


# ── 배송완료(shipped) 건은 PUT 대상에서 제외되어야 한다 ────────────────────────

def _shipments_body(shipping_code: str, statuses: list) -> dict:
    """GET /orders/{id}/shipments 응답 형태. status 는 items[] 안에 있다."""
    return {"shipments": [{
        "shipping_code": shipping_code,
        "order_id": "20260101-0000002",
        "items": [{"status": s, "order_item_code": f"x-{i}"} for i, s in enumerate(statuses)],
    }]}


def _run_fetch(order_ids, response):
    async def _fake(**kwargs):
        return response
    import app.services.cafe24_admin_service as svc
    orig = svc.call_cafe24
    svc.call_cafe24 = _fake
    try:
        return asyncio.run(
            svc.fetch_shipment_statuses(db=None, client=None, order_ids=order_ids)
        )
    finally:
        svc.call_cafe24 = orig


@pytest.mark.parametrize("statuses, expected", [
    (["standby"], "standby"),
    (["shipping"], "shipping"),
    (["shipped"], "shipped"),
    (["shipping", "shipped"], "shipped"),   # 섞이면 shipped 우선 — 보수적 판정
    (["shipped", "shipped"], "shipped"),
])
def test_fetch_shipment_statuses_reads_item_level_status(statuses, expected):
    """status 는 shipment 최상위가 아니라 items[] 안에 있다.

    (최상위에서 찾으면 전부 None 이 되어 '상태를 모른다'로 떨어진다 — 조사 중 실제로 겪음.)
    """
    code = "D-20260101-0000002-00"
    result = _run_fetch(["20260101-0000002"], _response(200, _shipments_body(code, statuses)))
    assert result[code] == expected


def test_fetch_shipment_statuses_omits_unreadable_orders():
    """조회 실패한 주문은 매핑에 담기지 않는다 → 호출자가 '모름'으로 보고 보류한다."""
    result = _run_fetch(["20260101-0000002"], _response(500, {"message": "boom"}))
    assert result == {}


# ── 보류된 Send 에 속한 요청은 전부 전송에서 빠져야 한다 ───────────────────────

def _select_sendable(yearly_requests, statuses, send_ids_by_code):
    """send_service 의 YEARLY 사전 선별과 동일한 규칙을 재현한다.

    (transition_sends_to_delivered_batch 전체를 돌리려면 DB·Send 픽스처가 필요해서,
     선별 규칙만 떼어 검증한다. 규칙이 바뀌면 이 테스트도 함께 고쳐야 한다.)
    """
    blocked = set()
    for req in yearly_requests:
        current = statuses.get(req["shipping_code"])
        if current in ("shipped", None):
            blocked |= send_ids_by_code.get(req["shipping_code"], set())
    return [
        req for req in yearly_requests
        if not (send_ids_by_code.get(req["shipping_code"], set()) & blocked)
    ], blocked


def test_shipped_item_blocks_whole_send_from_being_sent():
    """한 Send 안에 shipped 가 섞이면 같은 Send 의 standby 품목도 보내지 않는다.

    보내버리면 카페24만 shipping 으로 앞서가고 Send 는 PREPARING 으로 남아
    되돌릴 수 없는 새 불일치가 생긴다.
    """
    req_a = _yearly_req("20260101-0000002", "CODE-A")  # standby
    req_b = _yearly_req("20260101-0000002", "CODE-B")  # shipped
    send_ids_by_code = {"CODE-A": {100}, "CODE-B": {100}}  # 같은 Send
    statuses = {"CODE-A": "standby", "CODE-B": "shipped"}

    sendable, blocked = _select_sendable([req_a, req_b], statuses, send_ids_by_code)

    assert sendable == [], "같은 Send 의 품목은 하나도 보내면 안 된다"
    assert blocked == {100}


def test_other_sends_are_unaffected_by_a_blocked_send():
    """보류는 그 Send 에만 한정된다 — 다른 Send 까지 막으면 안 된다."""
    req_a = _yearly_req("20260101-0000002", "CODE-A")  # shipped  → Send 100 보류
    req_b = _yearly_req("20260101-0000004", "CODE-B")  # standby  → Send 200 정상
    req_c = _yearly_req("20260101-0000005", "CODE-C")  # shipping → Send 300 정상
    send_ids_by_code = {"CODE-A": {100}, "CODE-B": {200}, "CODE-C": {300}}
    statuses = {"CODE-A": "shipped", "CODE-B": "standby", "CODE-C": "shipping"}

    sendable, blocked = _select_sendable([req_a, req_b, req_c], statuses, send_ids_by_code)

    assert [r["shipping_code"] for r in sendable] == ["CODE-B", "CODE-C"]
    assert blocked == {100}


def test_unknown_status_also_blocks_the_send():
    """상태를 조회하지 못한 건도 보내지 않는다 — '모르면 건드리지 않는다'."""
    req = _yearly_req("20260101-0000002", "CODE-A")
    sendable, blocked = _select_sendable([req], {}, {"CODE-A": {100}})

    assert sendable == []
    assert blocked == {100}
