from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import math

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityLogResponse, ActivityLogListQuery
from app.schemas.common import PaginatedResponse, PaginationMeta
from app.services import activity_log_service

router = APIRouter(prefix="/activity-logs", tags=["활동 로그"])

require_super_admin = require_roles(["SUPER_ADMIN"])


@router.get("", response_model=PaginatedResponse[ActivityLogResponse])
def get_activity_logs(
    query: ActivityLogListQuery = Depends(ActivityLogListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """활동 로그 조회 (SUPER_ADMIN 전용)"""
    logs, total = activity_log_service.get_logs(
        db, query.page, query.limit, query.admin_id, query.action, 
        query.target_type, query.target_id, query.start_date, query.end_date
    )
    
    return PaginatedResponse(
        message="활동 로그 목록을 조회했습니다.",
        data=[ActivityLogResponse.model_validate(log) for log in logs],
        pagination=PaginationMeta(
            total=total,
            page=query.page,
            limit=query.limit,
            total_pages=math.ceil(total / query.limit) if total > 0 else 0
        )
    )