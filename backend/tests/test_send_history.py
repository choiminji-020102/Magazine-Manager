"""주문 품목별 발송 이력 조회 회귀 테스트.

핵심 회귀 — 구독 상세의 '발송 이력' 은 그 품목(order_item) 의 발송만 보여야 한다.
(이전 구현은 order_id 로 조회해서 같은 주문에 묶인 **다른 품목의 발송까지** 섞어 보여줬고,
 SendItem 을 응답에 담지 않아 어느 호(issue)·어떤 책인지 구분할 수도 없었다.)

부수 검증 — admin_memo 는 SendItem/Send 양쪽에 존재하므로 item_/send_ 접두어로
출처가 뒤바뀌지 않아야 하고, Send 가 없는 미아 SendItem 은 결과에서 빠져야 한다
(조립부가 send 를 None 체크 없이 참조하므로 INNER JOIN 이 전제다).
"""
from itertools import count

from app.models.send import Send
from app.models.send_item import SendItem
from app.services import send_service

# SQLite 는 BigInteger PK 를 자동증가시키지 않으므로 명시 지정한다
# (test_address_change.py 와 동일한 제약)
_pk = count(1)


# ── 픽스처 helper ─────────────────────────────────────────────────────────────

def _make_send(db, *, status="DELIVERED", admin_memo=None, customer_memo=None,
               tracking_no=None, send_method=None, courier_company=None,
               country="KR", postal="12345"):
    send = Send(
        send_id=next(_pk),
        send_status=status,
        send_method=send_method,
        courier_company=courier_company,
        tracking_no=tracking_no,
        recipient_name="홍길동",
        recipient_phone="01011112222",
        country_code=country,
        postal_code=postal,
        recipient_address="서울시 강남구 1",
        customer_memo=customer_memo,
        admin_memo=admin_memo,
    )
    db.add(send)
    db.flush()
    return send


def _make_send_item(db, order_item_id, issue, *, send=None, send_id=None,
                    product_name="말씀함께 [기본판]", admin_memo=None, send_num=1):
    """send=None 이고 send_id 만 주면 미아(orphan) SendItem 을 만든다."""
    item = SendItem(
        send_item_id=next(_pk),
        send_id=send.send_id if send is not None else send_id,
        order_item_id=order_item_id,
        product_code=f"W0+{issue}",
        product_name=product_name,
        issue=issue,
        send_num=send_num,
        cost_price=0,
        admin_memo=admin_memo,
    )
    db.add(item)
    db.flush()
    return item


# OrderItem 행 자체는 만들지 않는다 — 조회는 SendItem.order_item_id 로만 좁히고,
# 품목 존재 확인은 엔드포인트(order_item_service.get_order_item_by_id) 책임이다.
TARGET = 100
OTHER = 200


# ── 테스트 ────────────────────────────────────────────────────────────────────

def test_other_order_item_sends_are_not_mixed_in(db):
    """같은 주문의 다른 품목 발송이 섞이지 않는다 (핵심 회귀)."""
    mine = _make_send(db)
    theirs = _make_send(db)
    _make_send_item(db, TARGET, "202604", send=mine, product_name="내 책")
    _make_send_item(db, OTHER, "202604", send=theirs, product_name="남의 책")
    db.commit()

    rows = send_service.get_send_history_by_order_item(db, TARGET)

    assert [r.product_name for r in rows] == ["내 책"]
    assert theirs.send_id not in [r.send_id for r in rows]


def test_ordered_by_issue_desc(db):
    """최신 호부터 내림차순으로 정렬된다."""
    for issue in ("202604", "202606", "202605"):  # 삽입 순서를 일부러 뒤섞는다
        _make_send_item(db, TARGET, issue, send=_make_send(db))
    db.commit()

    rows = send_service.get_send_history_by_order_item(db, TARGET)

    assert [r.issue for r in rows] == ["202606", "202605", "202604"]


def test_admin_memo_sources_are_not_swapped(db):
    """item_admin_memo 는 SendItem, send_admin_memo 는 Send 에서 온다."""
    send = _make_send(db, admin_memo="박스메모", customer_memo="부재시 경비실")
    _make_send_item(db, TARGET, "202604", send=send, admin_memo="품목메모")
    db.commit()

    row = send_service.get_send_history_by_order_item(db, TARGET)[0]

    assert row.item_admin_memo == "품목메모"
    assert row.send_admin_memo == "박스메모"
    assert row.customer_memo == "부재시 경비실"


def test_send_item_fields_come_from_send_item(db):
    """상품명·호·부수는 Send 가 아니라 SendItem 스냅샷에서 온다."""
    send = _make_send(db, tracking_no="1111", send_method="기출유택배",
                      courier_company="CJ대한통운")
    _make_send_item(db, TARGET, "202604", send=send,
                    product_name="어린이 말씀함께", send_num=2)
    db.commit()

    row = send_service.get_send_history_by_order_item(db, TARGET)[0]

    assert (row.product_name, row.issue, row.send_num) == ("어린이 말씀함께", "202604", 2)
    assert (row.tracking_no, row.send_method, row.courier_company) == (
        "1111", "기출유택배", "CJ대한통운")


def test_orphan_send_item_is_excluded(db):
    """Send 가 없는 미아 SendItem 은 결과에서 빠진다 (INNER JOIN 전제).

    한계: 이 시나리오는 SQLite 가 FK 를 강제하지 않아(PRAGMA foreign_keys=0) 만들 수 있다.
    MySQL 에 FK 제약이 살아 있다면 미아 행 자체가 생기지 않으므로 이 테스트는
    "제약이 없어도 조회가 안전한가" 를 보는 방어 검증이다.
    """
    _make_send_item(db, TARGET, "202604", send=_make_send(db))
    _make_send_item(db, TARGET, "202605", send_id=999999)  # 존재하지 않는 Send
    db.commit()

    rows = send_service.get_send_history_by_order_item(db, TARGET)

    assert [r.issue for r in rows] == ["202604"]


def test_preparing_send_has_no_delivered_at(db):
    """발송 후보(PREPARING) 는 배송완료 일시가 없다."""
    _make_send_item(db, TARGET, "202604", send=_make_send(db, status="PREPARING"))
    db.commit()

    row = send_service.get_send_history_by_order_item(db, TARGET)[0]

    assert row.send_status == "PREPARING"
    assert row.delivered_at is None


def test_empty_history(db):
    """발송 이력이 없는 품목은 빈 리스트를 반환한다."""
    assert send_service.get_send_history_by_order_item(db, 777) == []
