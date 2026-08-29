# 표준 라이브러리
from datetime import datetime
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.activity_log import ActivityLog


def create_log(
    db: Session,
    action: str,
    target_type: str,
    admin_id: Optional[int] = None,
    admin_name: Optional[str] = None,
    target_id: Optional[int] = None,
    target_name: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> ActivityLog:
    log = ActivityLog(
        admin_id=admin_id,
        admin_name=admin_name,
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_logs(
    db: Session,
    page: int = 1,
    limit: int = 20,
    admin_id: Optional[int] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    target_ids: Optional[List[int]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Tuple[List[ActivityLog], int]:
    query = db.query(ActivityLog)

    if admin_id:
        query = query.filter(ActivityLog.admin_id == admin_id)
    if action:
        query = query.filter(ActivityLog.action == action)
    if target_type:
        query = query.filter(ActivityLog.target_type == target_type)
    # target_ids 가 우선 (다중 IN), 없을 때만 target_id 단건 적용
    if target_ids:
        query = query.filter(ActivityLog.target_id.in_(target_ids))
    elif target_id:
        query = query.filter(ActivityLog.target_id == target_id)
    if start_date:
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(ActivityLog.created_at >= start_datetime)
        except ValueError:
            pass
    if end_date:
        try:
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            query = query.filter(ActivityLog.created_at <= end_datetime)
        except ValueError:
            pass

    total = query.count()
    offset = (page - 1) * limit

    # ── 2단계 조회 (deferred join) ────────────────────────────────────────────
    # 한 번에 정렬하면 MySQL 이 SELECT 한 컬럼을 전부 정렬 버퍼에 담는데, details(JSON)에
    # 큰 값이 섞이면 버퍼 한도를 넘어 쿼리 자체가 실패한다
    # (1038 Out of sort memory — 카페24 실패 사유 전문이 저장돼 한 건 744KB 가 된 이력).
    # 공유 호스팅이라 sort_buffer_size 를 올릴 수 없으므로, 정렬은 **log_id 만** 뽑는
    # 가벼운 쿼리에서 끝내고 본문은 그 ID 로 따로 가져온다.
    #
    # PK 2차 정렬키 — created_at 이 같은 행이 많으면 페이징 순서가 비결정적이라 중복·누락 발생
    id_rows = (
        query.with_entities(ActivityLog.log_id)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.log_id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    ids = [row[0] for row in id_rows]
    if not ids:
        return [], total

    # 본문 조회에는 ORDER BY 를 걸지 않는다 — 여기에 걸면 details 가 다시 정렬 버퍼에
    # 들어가 같은 문제가 난다. 정렬 순서는 위에서 이미 확정됐으므로 그대로 재배열한다.
    rows = db.query(ActivityLog).filter(ActivityLog.log_id.in_(ids)).all()
    by_id = {r.log_id: r for r in rows}
    items = [by_id[i] for i in ids if i in by_id]

    return items, total
