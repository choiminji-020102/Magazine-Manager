"""페이징 목록 쿼리의 정렬 안정성 회귀 테스트.

배경: ORDER BY 가 유일하지 않은 컬럼 하나뿐이면, 정렬값이 같은 행들 사이의
순서가 DB 구현에 따라 매 쿼리마다 달라질 수 있다. LIMIT/OFFSET 페이징에서
이 순서가 흔들리면 같은 행이 두 페이지에 중복 등장하고 다른 행은 어느
페이지에도 나오지 않는 누락이 발생한다.

실제로 sends.created_at 은 [발송 생성] 일괄 INSERT 때문에 동일 값이
수백 건씩 뭉쳤고(MySQL DATETIME 은 정밀도 0 = 초 단위 절삭),
발송 후보 [전체 선택]이 295건 중 290건만 선택하는 문제로 발현했다.
"""
import re
from datetime import datetime

import pytest

from app.crud import address as address_crud
from app.crud import admin as admin_crud
from app.crud import customer as customer_crud
from app.crud import order as order_crud
from app.crud import order_item as order_item_crud
from app.crud import pause as pause_crud
from app.crud import product as product_crud
from app.crud import send as send_crud
from app.models.send import Send
from app.schemas.send import SendListQuery
from app.services import activity_log_service, inquiry_service

# (이름, 호출 함수, 기대되는 2차 정렬 컬럼)
# 모든 목록 함수는 (db, page=, limit=) 형태로 호출 가능하다.
LIST_QUERIES = [
    ("sends", lambda db, page, limit: send_crud.list_sends(
        db, SendListQuery(page=page, limit=limit)), "send_id"),
    ("orders", lambda db, page, limit: order_crud.list_orders(
        db, page=page, limit=limit), "order_id"),
    ("order_items", lambda db, page, limit: order_item_crud.list_order_items(
        db, page=page, limit=limit), "order_item_id"),
    ("customers", lambda db, page, limit: customer_crud.list_customers(
        db, page=page, limit=limit), "customer_id"),
    ("products", lambda db, page, limit: product_crud.list_products(
        db, page=page, limit=limit), "product_id"),
    ("addresses", lambda db, page, limit: address_crud.list_addresses(
        db, page=page, limit=limit), "address_id"),
    ("pauses", lambda db, page, limit: pause_crud.list_pauses(
        db, page=page, limit=limit), "pause_id"),
    ("admins", lambda db, page, limit: admin_crud.list_admins(
        db, page=page, limit=limit), "admin_id"),
    ("activity_logs", lambda db, page, limit: activity_log_service.get_logs(
        db, page=page, limit=limit), "log_id"),
    ("inquiries", lambda db, page, limit: inquiry_service.get_inquiries(
        db, page=page, limit=limit), "inquiry_id"),
]

ORDER_BY_RE = re.compile(r"ORDER BY (.+?)(?:\s+LIMIT|\s*$)", re.IGNORECASE | re.DOTALL)


def _last_order_by_clause(statements):
    """수집된 SQL 중 ORDER BY 를 가진 마지막 SELECT 문의 ORDER BY 절을 돌려준다."""
    for stmt in reversed(statements):
        match = ORDER_BY_RE.search(stmt)
        if match:
            return match.group(1)
    return None


@pytest.mark.parametrize("name,call,pk_column", LIST_QUERIES, ids=[q[0] for q in LIST_QUERIES])
def test_list_queries_have_pk_tiebreak(db, captured_sql, name, call, pk_column):
    """모든 페이징 목록 쿼리의 ORDER BY 는 PK 로 끝나야 한다.

    PK 는 유일하므로 (정렬값, PK) 조합이 항상 유일해지고, 정렬 순서가
    하나로 확정된다. 이 테스트는 DB 방언과 무관하게 성립하므로
    SQLite 에서도 회귀를 확실히 잡는다.
    """
    call(db, 1, 20)

    clause = _last_order_by_clause(captured_sql)
    assert clause is not None, f"{name}: ORDER BY 절이 있는 쿼리를 찾지 못함"

    last_term = clause.split(",")[-1].strip()
    assert pk_column in last_term, (
        f"{name}: ORDER BY 의 마지막 정렬키가 PK({pk_column})가 아님 → "
        f"정렬값이 같은 행의 순서가 비결정적이 되어 페이징에서 중복·누락 발생. "
        f"실제 ORDER BY: {clause.strip()}"
    )


def _seed_sends_with_identical_timestamp(db, count):
    """created_at 이 전부 동일한 Send 를 count 건 만든다.

    send_id 는 명시 지정한다 (SQLite 는 BigInteger PK 를 자동증가시키지 않음).
    삽입 순서와 PK 순서를 어긋나게 넣어, 정렬이 삽입 순서에 우연히
    의존하지 않는지 함께 확인한다.
    """
    stamp = datetime(2026, 8, 1, 16, 47, 59)
    ids = list(range(1, count + 1))
    for send_id in ids[::2] + ids[1::2]:  # 홀수 먼저, 짝수 나중
        db.add(Send(
            send_id=send_id,
            send_status="PREPARING",
            created_at=stamp,
            updated_at=stamp,
            recipient_name=f"수령인{send_id}",
            recipient_phone="01000000000",
            country_code="KR",
            postal_code="00000",
            recipient_address=f"테스트 주소 {send_id}",
        ))
    db.commit()
    return set(ids)


def _sweep(db, limit):
    """페이지를 끝까지 순회하며 등장한 send_id 를 순서대로 모은다."""
    collected = []
    page = 1
    while True:
        items, total = send_crud.list_sends(
            db, SendListQuery(page=page, limit=limit, send_status="PREPARING"))
        collected.extend(s.send_id for s in items)
        if page * limit >= total or not items:
            return collected, total
        page += 1


def test_pagination_covers_all_rows_without_duplicates(db):
    """created_at 이 전부 같아도 페이지 순회가 전체를 빠짐없이 한 번씩 덮어야 한다."""
    expected = _seed_sends_with_identical_timestamp(db, 250)

    collected, total = _sweep(db, limit=100)

    assert total == len(expected)
    assert len(collected) == total, "반환된 행 수가 total 과 다름"
    assert len(set(collected)) == total, (
        f"고유 건수 부족 — 중복 {len(collected) - len(set(collected))}건 발생, "
        f"누락 {total - len(set(collected))}건"
    )
    assert set(collected) == expected, "순회 결과가 실제 데이터와 불일치"


def test_pagination_stable_across_limits(db):
    """페이지 크기를 바꿔도 순회 결과가 동일해야 한다.

    limit 이 달라지면 페이지 경계 위치가 달라진다. 경계가 어디에 놓이든
    결과가 같다는 것은 tie 순서가 실제로 고정됐다는 의미다.
    """
    expected = _seed_sends_with_identical_timestamp(db, 250)

    results = {}
    for limit in (7, 20, 50, 100):
        collected, total = _sweep(db, limit=limit)
        assert total == len(expected)
        assert len(set(collected)) == total, f"limit={limit} 에서 누락 발생"
        results[limit] = collected

    baseline = results[20]
    for limit, collected in results.items():
        assert collected == baseline, (
            f"limit={limit} 의 순회 결과가 limit=20 과 다름 → 페이지 경계에 따라 "
            f"정렬 순서가 흔들리고 있음"
        )


def test_ordering_is_deterministic_across_repeated_queries(db):
    """동일 조건을 반복 조회하면 순서까지 동일해야 한다."""
    _seed_sends_with_identical_timestamp(db, 250)

    runs = [_sweep(db, limit=100)[0] for _ in range(5)]

    assert all(run == runs[0] for run in runs), "반복 조회 시 행 순서가 달라짐"
