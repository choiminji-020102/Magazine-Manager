# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.common import ResponseModel
from app.schemas.send_item import SendItemCreate, SendItemResponse, SendItemUpdate
from app.services import activity_log_service, send_item_service, send_service

router = APIRouter(tags=["발송 품목"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/sends/{send_id}/items",
    response_model=ResponseModel[List[SendItemResponse]],
)
def get_send_items(
    send_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """발송별 품목 목록"""
    send_service.get_send_by_id(db, send_id)  # 발송 존재 여부 검증
    items = send_item_service.get_send_items_by_send(db, send_id)

    return ResponseModel(
        message="발송별 품목 목록을 조회했습니다.",
        data=[SendItemResponse.model_validate(i) for i in items],
    )


@router.get(
    "/send-items/{send_item_id}",
    response_model=ResponseModel[SendItemResponse],
)
def get_send_item(
    send_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """발송 품목 상세"""
    item = send_item_service.get_send_item_by_id(db, send_item_id)

    return ResponseModel(
        message="발송 품목 정보를 조회했습니다.",
        data=SendItemResponse.model_validate(item),
    )


# ── 생성 ──────────────────────────────────────────────────────────────────────

@router.post(
    "/sends/{send_id}/items",
    response_model=ResponseModel[SendItemResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_send_item(
    send_id: int,
    item_in: SendItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """발송 품목 추가"""
    send = send_service.get_send_by_id(db, send_id)

    try:
        item = send_item_service.create_send_item(db, send, item_in)
    except IntegrityError:
        # SendItem UNIQUE(order_item_id, issue) 위반 — 같은 OI 에 같은 호로 이미 SendItem 존재
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"OrderItem #{item_in.order_item_id} 에 이미 {item_in.issue} 호 발송 품목이 있습니다.",
        )

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.SEND_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=item.send_item_id,
        target_name=item.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={
            "send_id": send_id,
            "order_item_id": item.order_item_id,
            "issue": item.issue,
            "send_num": item.send_num,
        },
    )

    return ResponseModel(
        message="발송 품목이 추가되었습니다.",
        data=SendItemResponse.model_validate(item),
    )


# ── 수정 ──────────────────────────────────────────────────────────────────────

@router.put(
    "/send-items/{send_item_id}",
    response_model=ResponseModel[SendItemResponse],
)
def update_send_item(
    send_item_id: int,
    item_in: SendItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """발송 품목 수정"""
    item = send_item_service.get_send_item_by_id(db, send_item_id)
    before = {"admin_memo": item.admin_memo}

    updated = send_item_service.update_send_item(db, item, item_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.SEND_ITEM,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=send_item_id,
        target_name=item.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"before": before, "after": item_in.model_dump(exclude_unset=True)},
    )

    return ResponseModel(
        message="발송 품목이 수정되었습니다.",
        data=SendItemResponse.model_validate(updated),
    )


