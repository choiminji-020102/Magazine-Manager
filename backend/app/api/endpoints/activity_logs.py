from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityLogResponse
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
from app.services import activity_log_service

router = APIRouter(prefix="/activity-logs", tags=["활동 로그"])

require_super_admin = require_roles(["SUPER_ADMIN"])


@router.get("", response_model=PaginatedResponse[ActivityLogResponse])
def get_activity_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin_id: Optional[int] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """활동 로그 조회 (SUPER_ADMIN 전용)"""
    items, total = activity_log_service.get_logs(
        db, page, limit, admin_id, action, target_type, target_id, start_date, end_date
    )
    
    return PaginatedResponse(
        data=[ActivityLogResponse.model_validate(item) for item in items],
        pagination=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    )