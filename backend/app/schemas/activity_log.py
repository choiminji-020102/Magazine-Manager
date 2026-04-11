from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from fastapi import Query

from app.models.activity_log import ActivityAction, ActivityTargetType

'''
    db: Session,
    admin: Admin,
    action: str,
    target_type: str,
    target_id: Optional[int] = None,
    target_name: Optional[str] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
'''


class ActivityLogListQuery(BaseModel):
    """활동 로그 목록 조회 쿼리 파라미터"""
    page: int = Field(1, ge=1, description="페이지 번호")
    limit: int = Field(20, ge=1, le=100, description="페이지당 항목 수")
    admin_id: Optional[int] = Field(None, description="관리자 ID 필터")
    action: Optional[ActivityAction] = Field(None, description="액션 필터")
    target_type: Optional[ActivityTargetType] = Field(None, description="대상 타입 필터")
    start_date: Optional[str] = Field(None, description="시작 날짜 (YYYY-MM-DD 형식)")
    end_date: Optional[str] = Field(None, description="종료 날짜 (YYYY-MM-DD 형식)")

    @classmethod
    def as_query_params(
        cls,
        page: int = Query(1, ge=1, description="페이지 번호"),
        limit: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
        admin_id: Optional[int] = Query(None, description="관리자 ID 필터"),
        action: Optional[ActivityAction] = Query(None, description="액션 필터"),
        target_type: Optional[ActivityTargetType] = Query(None, description="대상 타입 필터"),
        start_date: Optional[str] = Query(None, description="시작 날짜 (YYYY-MM-DD 형식)"),
        end_date: Optional[str] = Query(None, description="종료 날짜 (YYYY-MM-DD 형식)"),
    ):
        return cls(
            page=page,
            limit=limit,
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            start_date=start_date,
            end_date=end_date,
        )


class ActivityLogCreate(BaseModel):
    admin_id: Optional[int] = None
    admin_name: Optional[str] = Field(None, max_length=50, description="관리자 이름")
    action: ActivityAction = Field(..., description="액션")
    target_type: ActivityTargetType = Field(..., description="대상 타입")
    target_id: Optional[int] = None
    target_name: Optional[str] = Field(None, max_length=255, description="대상 이름")
    details: Optional[dict] = None
    ip_address: Optional[str] = Field(None, max_length=45, description="IP 주소")
    user_agent: Optional[str] = Field(None, max_length=500, description="User Agent")


class ActivityLogResponse(BaseModel):
    log_id: int
    admin_id: Optional[int] = None
    admin_name: Optional[str] = Field(None, max_length=50, description="관리자 이름")
    action: ActivityAction = Field(..., description="액션")
    target_type: ActivityTargetType = Field(..., description="대상 타입")
    target_id: Optional[int] = None
    target_name: Optional[str] = Field(None, max_length=255, description="대상 이름")
    details: Optional[dict] = None
    ip_address: Optional[str] = Field(None, max_length=45, description="IP 주소")
    user_agent: Optional[str] = Field(None, max_length=500, description="User Agent")
    created_at: datetime
    
    class Config:
        from_attributes = True