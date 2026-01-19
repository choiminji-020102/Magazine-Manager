from sqlalchemy.orm import Session
from typing import Optional, List, Tuple
from datetime import datetime

from app.models.activity_log import ActivityLog
from app.models.admin import Admin


def create_log(
    db: Session,
    action: str,
    target_type: str,
    target_id: Optional[int] = None,
    target_name: Optional[str] = None,
    details: Optional[dict] = None,
    admin: Optional[Admin] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> ActivityLog:
    log = ActivityLog(
        admin_id=admin.admin_id if admin else None,
        admin_name=admin.admin_name if admin else "SYSTEM",
        action=action,
        target_type=target_type,
        target_id=target_id,
        target_name=target_name,
        details=details,
        ip_address=ip_address,
        user_agent=user_agent
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
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Tuple[List[ActivityLog], int]:
    query = db.query(ActivityLog)
    
    if admin_id:
        query = query.filter(ActivityLog.admin_id == admin_id)
    if action:
        query = query.filter(ActivityLog.action == action)
    if target_type:
        query = query.filter(ActivityLog.target_type == target_type)
    if target_id:
        query = query.filter(ActivityLog.target_id == target_id)
    if start_date:
        query = query.filter(ActivityLog.created_at >= start_date)
    if end_date:
        query = query.filter(ActivityLog.created_at <= end_date + " 23:59:59")
    
    total = query.count()
    
    offset = (page - 1) * limit
    items = query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit).all()
    
    return items, total