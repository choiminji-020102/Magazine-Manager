# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.pause import (
    PauseBatchCreate,
    PauseBatchCreateResponse,
    PauseByIssueResponse,
    PauseCreate,
    PauseListQuery,
    PauseListResponse,
    PauseResponse,
    PauseUpdate,
)
from app.services import activity_log_service, order_item_service, pause_service

router = APIRouter(tags=["휴지"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/pauses",
    response_model=PaginatedResponse[PauseListResponse],
)
def list_pauses(
    query: PauseListQuery = Depends(PauseListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """휴지 목록 조회"""
    items, total = pause_service.list_pauses(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=[PauseListResponse(**p) for p in items],
    )


@router.get(
    "/pauses/by-issue/{issue}",
    response_model=ResponseModel[List[PauseByIssueResponse]],
)
def get_pauses_by_issue(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """호별 휴지 목록 (고객/상품 정보 포함)"""
    pauses = pause_service.get_pauses_by_issue(db, issue)

    return ResponseModel(
        message="호별 휴지 목록을 조회했습니다.",
        data=[PauseByIssueResponse(**p) for p in pauses],
    )


@router.get(
    "/order-items/{order_item_id}/pauses",
    response_model=ResponseModel[List[PauseResponse]],
)
def get_pauses_by_order_item(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """품목별 휴지 목록"""
    order_item_service.get_order_item_by_id(db, order_item_id)  # 품목 존재 확인
    pauses = pause_service.get_pauses_by_order_item(db, order_item_id)

    return ResponseModel(
        message="품목별 휴지 목록을 조회했습니다.",
        data=[PauseResponse.model_validate(p) for p in pauses],
    )


@router.get(
    "/pauses/{pause_id}",
    response_model=ResponseModel[PauseResponse],
)
def get_pause(
    pause_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """휴지 상세 조회"""
    pause = pause_service.get_pause_by_id(db, pause_id)

    return ResponseModel(
        message="휴지 정보를 조회했습니다.",
        data=PauseResponse.model_validate(pause),
    )


# ── 생성 ──────────────────────────────────────────────────────────────────────

@router.post(
    "/pauses/batch",
    response_model=ResponseModel[PauseBatchCreateResponse],
    status_code=status.HTTP_201_CREATED,
)
def batch_create_pause(
    batch_in: PauseBatchCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """다건 휴지 일괄 생성 (YEARLY만, 선택한 월 수만큼 구독 기간 연장)"""
    order_item = order_item_service.get_active_order_item_by_id(db, batch_in.order_item_id)
    prev_end = order_item.final_subscribe_end_issue

    result = pause_service.batch_create_pause(db, order_item, batch_in, current_admin.admin_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.PAUSE,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=order_item.order_item_id,
        target_name=order_item.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "order_item_id": batch_in.order_item_id,
            "pause_issues": batch_in.pause_issues,
            "reason": batch_in.reason,
            "prev_final_end_issue": prev_end,
            "new_final_end_issue": result.new_final_end_issue,
        },
    )

    return ResponseModel(
        message=f"휴지 {result.created_count}건이 등록되었습니다.",
        data=result,
    )


@router.post(
    "/pauses",
    response_model=ResponseModel[PauseResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_pause(
    pause_in: PauseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """단건 휴지 생성 (YEARLY만, 구독 기간 1개월 연장)"""
    order_item = order_item_service.get_active_order_item_by_id(db, pause_in.order_item_id)
    prev_end = order_item.final_subscribe_end_issue

    pause = pause_service.create_pause(db, order_item, pause_in, current_admin.admin_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.PAUSE,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=pause.pause_id,
        target_name=order_item.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "order_item_id": pause_in.order_item_id,
            "pause_issue": pause_in.pause_issue,
            "reason": pause_in.reason,
            "prev_final_end_issue": prev_end,
            "new_final_end_issue": order_item.final_subscribe_end_issue,
        },
    )

    return ResponseModel(
        message="휴지가 등록되었습니다.",
        data=PauseResponse.model_validate(pause),
    )


# ── 수정 ──────────────────────────────────────────────────────────────────────

@router.put(
    "/pauses/{pause_id}",
    response_model=ResponseModel[PauseResponse],
)
def update_pause(
    pause_id: int,
    pause_in: PauseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """휴지 수정 (사유만 수정 가능)"""
    pause = pause_service.get_pause_by_id(db, pause_id)
    before_reason = pause.reason

    updated = pause_service.update_pause(db, pause, pause_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.PAUSE,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=pause_id,
        target_name=f"{pause.pause_issue}호 휴지",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"before": {"reason": before_reason}, "after": {"reason": updated.reason}},
    )

    return ResponseModel(
        message="휴지 정보가 수정되었습니다.",
        data=PauseResponse.model_validate(updated),
    )


# ── 삭제 / 복구 ───────────────────────────────────────────────────────────────

@router.delete(
    "/pauses/{pause_id}",
    response_model=ResponseModel[PauseResponse],
)
def delete_pause(
    pause_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """휴지 소프트 삭제 (구독 기간 1개월 단축)"""
    pause = pause_service.get_pause_by_id(db, pause_id)
    order_item = order_item_service.get_order_item_by_id(db, pause.order_item_id)
    prev_end = order_item.final_subscribe_end_issue

    deleted = pause_service.delete_pause(db, pause)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.PAUSE,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=pause_id,
        target_name=f"{pause.pause_issue}호 휴지",
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "order_item_id": pause.order_item_id,
            "pause_issue": pause.pause_issue,
            "prev_final_end_issue": prev_end,
            "new_final_end_issue": order_item.final_subscribe_end_issue,
        },
    )

    return ResponseModel(
        message="휴지가 삭제되었습니다.",
        data=PauseResponse.model_validate(deleted),
    )
