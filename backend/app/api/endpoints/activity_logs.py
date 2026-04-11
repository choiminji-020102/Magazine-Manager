# 서드파티 라이브러리
import math

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.deps import require_super_admin
from app.db.session import get_db
from app.models import admin as admin_model
from app.schemas.activity_log import ActivityLogListQuery, ActivityLogResponse
from app.schemas.common import PaginatedResponse
from app.services import activity_log_service

router = APIRouter(prefix="/activity-logs", tags=["활동 로그"])


@router.get("", response_model=PaginatedResponse[ActivityLogResponse])
def get_activity_logs(
    query: ActivityLogListQuery = Depends(ActivityLogListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """활동 로그 조회 (SUPER_ADMIN 전용)"""
    logs, total = activity_log_service.get_logs(
        db=db,
        page=query.page,
        limit=query.limit,
        admin_id=query.admin_id,
        action=query.action,
        target_type=query.target_type,
        start_date=query.start_date,
        end_date=query.end_date,
    )

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=math.ceil(total / query.limit) if total > 0 else 0,
        items=logs,
    )
