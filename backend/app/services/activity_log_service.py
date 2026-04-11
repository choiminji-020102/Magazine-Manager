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
    items = query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit).all()

    return items, total
