"""활동 로그 목록 조회가 큰 details 때문에 죽지 않는지 — 회귀 테스트.

핵심 회귀 — 한 번의 쿼리로 정렬하면 MySQL 이 SELECT 한 컬럼을 전부 정렬 버퍼에 담는다.
details(JSON)에 큰 값이 섞이면 버퍼 한도를 넘어 **쿼리 자체가 실패**한다
(1038 Out of sort memory). 실제로 카페24 실패 사유 전문이 저장돼 한 건이 744KB 가 됐고,
활동 로그 화면이 통째로 500 을 반환했다. 공유 호스팅이라 sort_buffer_size 는 올릴 수 없다.

해결: 정렬은 log_id 만 뽑는 가벼운 쿼리에서 끝내고, 본문은 그 ID 로 따로 가져와
파이썬에서 재배열한다(deferred join). **본문 쿼리에 ORDER BY 를 다시 넣으면 재발한다.**

한계: SQLite 에는 정렬 버퍼 한도가 없어 실패 자체를 재현할 수 없다. 그래서 데이터가 아니라
**SQL 구조**(본문 조회에 ORDER BY 가 없는가)로 고정한다.

→ docs/troubleshooting/cafe24-shipment-status-deadlock.md §7-(A)
"""
from datetime import datetime
from itertools import count

from app.models.activity_log import ActivityLog
from app.services import activity_log_service

_pk = count(1)

# created_at 을 전부 같게 둔다 — PK 2차 정렬키가 없으면 순서가 비결정적이 되는 조건
SAME_TS = datetime(2026, 8, 3, 14, 0, 0)


def _make_log(db, *, details=None, created_at=SAME_TS):
    log = ActivityLog(
        log_id=next(_pk),
        admin_id=1,
        admin_name="최민지",
        action="DISPATCH",
        target_type="SEND",
        target_name="[배송완료 처리] 0건",
        details=details,
        created_at=created_at,
    )
    db.add(log)
    db.flush()
    return log


def _select_statements(captured_sql):
    return [s for s in captured_sql if s.strip().upper().startswith("SELECT")]


# ── SQL 구조 ──────────────────────────────────────────────────────────────────

def test_body_query_has_no_order_by(db, captured_sql):
    """본문(details 를 가져오는) 쿼리에는 ORDER BY 가 없어야 한다.

    여기에 ORDER BY 가 붙으면 details 가 다시 정렬 버퍼에 들어가 원래 문제가 그대로 재발한다.
    순서는 앞선 log_id 전용 쿼리에서 이미 확정되므로 다시 정렬할 이유가 없다.
    """
    for _ in range(5):
        _make_log(db, details={"failed": ["x" * 100]})
    db.commit()
    captured_sql.clear()

    activity_log_service.get_logs(db=db, page=1, limit=30)

    body = [s for s in _select_statements(captured_sql) if "activity_logs.details" in s]
    assert body, "details 를 가져오는 쿼리가 있어야 한다"
    for stmt in body:
        assert "ORDER BY" not in stmt.upper(), (
            "본문 조회에 ORDER BY 가 붙었다 — details 가 정렬 버퍼에 들어가 "
            "큰 값이 섞이면 1038 로 죽는다"
        )


def test_sorting_query_selects_only_log_id(db, captured_sql):
    """정렬을 수행하는 쿼리는 log_id 만 뽑아야 한다 (버퍼에 담기는 양을 최소화)."""
    for _ in range(3):
        _make_log(db, details={"a": 1})
    db.commit()
    captured_sql.clear()

    activity_log_service.get_logs(db=db, page=1, limit=30)

    sorted_stmts = [s for s in _select_statements(captured_sql) if "ORDER BY" in s.upper()]
    assert sorted_stmts, "정렬 쿼리가 있어야 한다"
    for stmt in sorted_stmts:
        assert "activity_logs.details" not in stmt, (
            "정렬 쿼리가 details 까지 SELECT 하고 있다 — 정렬 버퍼가 터지는 원인"
        )


# ── 동작 ──────────────────────────────────────────────────────────────────────

def test_order_is_preserved_after_two_step_query(db):
    """2단계로 나눠 조회해도 정렬 순서(created_at DESC, log_id DESC)가 유지돼야 한다.

    본문을 IN 으로 가져오면 DB 가 돌려주는 행 순서는 보장되지 않는다. 앞 쿼리에서 얻은
    ID 순서대로 재배열하지 않으면 화면 순서가 뒤섞인다.
    """
    made = [_make_log(db, details={"i": i}) for i in range(10)]
    db.commit()

    logs, total = activity_log_service.get_logs(db=db, page=1, limit=30)

    assert total == 10
    expected = [m.log_id for m in sorted(made, key=lambda x: -x.log_id)]
    assert [l.log_id for l in logs] == expected, "created_at 이 같으면 log_id 내림차순이어야 한다"


def test_pagination_covers_all_rows_without_duplicates(db):
    """created_at 이 전부 같아도 페이지 순회가 전체를 빠짐없이 한 번씩 덮어야 한다."""
    made = [_make_log(db, details={"i": i}) for i in range(25)]
    db.commit()

    seen = []
    for page in (1, 2, 3):
        logs, total = activity_log_service.get_logs(db=db, page=page, limit=10)
        seen.extend(l.log_id for l in logs)

    assert total == 25
    assert len(seen) == 25, "누락 또는 초과"
    assert len(set(seen)) == 25, "같은 행이 두 페이지에 나타남"
    assert seen == sorted((m.log_id for m in made), reverse=True)


def test_large_details_survives_round_trip(db):
    """큰 details 가 섞여 있어도 조회되고 값이 그대로 돌아온다."""
    big = {"failed": [{"reason": "x" * 2000} for _ in range(50)]}
    target = _make_log(db, details=big)
    for _ in range(5):
        _make_log(db, details={"small": 1})
    db.commit()

    logs, _total = activity_log_service.get_logs(db=db, page=1, limit=30)

    got = next(l for l in logs if l.log_id == target.log_id)
    assert got.details == big


def test_empty_result_returns_early(db):
    """조건에 맞는 행이 없으면 본문 쿼리를 돌리지 않고 빈 목록을 돌려준다."""
    logs, total = activity_log_service.get_logs(db=db, page=1, limit=30, action="CREATE")

    assert logs == []
    assert total == 0


def test_filters_apply_to_both_queries(db):
    """필터는 정렬 쿼리에만 걸리지만, 그 결과 ID 로 본문을 가져오므로 최종 결과에도 반영된다."""
    _make_log(db, details={"a": 1})
    other = ActivityLog(
        log_id=next(_pk), admin_id=2, admin_name="관리자",
        action="CREATE", target_type="PRODUCT", target_name="상품",
        details=None, created_at=SAME_TS,
    )
    db.add(other)
    db.commit()

    logs, total = activity_log_service.get_logs(db=db, page=1, limit=30, action="CREATE")

    assert total == 1
    assert [l.log_id for l in logs] == [other.log_id]
