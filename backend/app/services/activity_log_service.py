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
    """
    활동 로그 생성
    
    Args:
        db: 데이터베이스 세션
        action: 액션 (최대 50자)
        target_type: 대상 타입 (최대 50자)
        target_id: 대상 ID
        target_name: 대상 이름 (최대 255자)
        details: 상세 정보 (JSON)
        admin: 관리자 객체
        ip_address: IP 주소 (최대 45자)
        user_agent: User Agent (최대 500자)
    
    Returns:
        생성된 ActivityLog 객체
    """
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
    """
    활동 로그 조회 (페이지네이션 지원)
    
    Args:
        db: 데이터베이스 세션
        page: 페이지 번호 (1부터 시작)
        limit: 페이지당 항목 수
        admin_id: 관리자 ID 필터
        action: 액션 필터
        target_type: 대상 타입 필터
        target_id: 대상 ID 필터
        start_date: 시작 날짜 (YYYY-MM-DD 형식)
        end_date: 종료 날짜 (YYYY-MM-DD 형식)
    
    Returns:
        (로그 리스트, 전체 개수) 튜플
    """
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
        try:
            start_datetime = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(ActivityLog.created_at >= start_datetime)
        except ValueError:
            # 잘못된 날짜 형식인 경우 무시
            pass
    if end_date:
        try:
            end_datetime = datetime.strptime(end_date, "%Y-%m-%d")
            # 종료일의 23:59:59까지 포함
            end_datetime = end_datetime.replace(hour=23, minute=59, second=59)
            query = query.filter(ActivityLog.created_at <= end_datetime)
        except ValueError:
            # 잘못된 날짜 형식인 경우 무시
            pass
    
    total = query.count()
    
    offset = (page - 1) * limit
    items = query.order_by(ActivityLog.created_at.desc()).offset(offset).limit(limit).all()
    
    return items, total