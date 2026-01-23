from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.pause import PauseCreate, PauseUpdate, PauseResponse, PauseByIssueResponse
from app.schemas.common import ResponseModel
from app.services import pause_service, order_item_service, activity_log_service

router = APIRouter(tags=["휴지"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("/order-items/{order_item_id}/pauses", response_model=ResponseModel[List[PauseResponse]])
def get_pauses_by_order_item(
    order_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """품목별 휴지 목록"""
    item = order_item_service.get_order_item_by_id(db, order_item_id)
    
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다."
        )
    
    pauses = pause_service.get_pauses_by_order_item(db, order_item_id)
    
    return ResponseModel(data=[PauseResponse.model_validate(p) for p in pauses])


@router.post("/order-items/{order_item_id}/pauses", response_model=ResponseModel[PauseResponse], status_code=status.HTTP_201_CREATED)
def create_pause(
    order_item_id: int,
    pause_in: PauseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """휴지 등록"""
    item = order_item_service.get_order_item_by_id(db, order_item_id)
    
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목을 찾을 수 없습니다."
        )
    
    if item.product_kind not in ["YEARLY", "MONTHLY"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="구독 상품만 휴지를 등록할 수 있습니다."
        )
    
    if pause_service.exists_for_issue(db, order_item_id, pause_in.pause_issue):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="해당 호에 이미 휴지가 등록되어 있습니다."
        )
    
    pause = pause_service.create_pause(db, order_item_id, pause_in, current_admin.admin_id)
    
    activity_log_service.create_log(
        db=db,
        action="CREATE",
        target_type="PAUSE",
        target_id=pause.pause_id,
        target_name=f"{item.product_name} - {pause_in.pause_issue}호",
        details={
            "order_item_id": order_item_id,
            "pause_issue": pause_in.pause_issue,
            "reason": pause_in.reason
        },
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="휴지가 등록되었습니다.",
        data=PauseResponse.model_validate(pause)
    )


@router.get("/pauses/{pause_id}", response_model=ResponseModel[PauseResponse])
def get_pause(
    pause_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """휴지 상세 조회"""
    pause = pause_service.get_pause_by_id(db, pause_id)
    
    if pause is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="휴지 정보를 찾을 수 없습니다."
        )
    
    return ResponseModel(data=PauseResponse.model_validate(pause))


@router.put("/pauses/{pause_id}", response_model=ResponseModel[PauseResponse])
def update_pause(
    pause_id: int,
    pause_in: PauseUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """휴지 수정"""
    pause = pause_service.get_pause_by_id(db, pause_id)
    
    if pause is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="휴지 정보를 찾을 수 없습니다."
        )
    
    old_data = {
        "pause_issue": pause.pause_issue,
        "reason": pause.reason
    }
    
    if pause_in.pause_issue and pause_in.pause_issue != pause.pause_issue:
        if pause_service.exists_for_issue(db, pause.order_item_id, pause_in.pause_issue):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="해당 호에 이미 휴지가 등록되어 있습니다."
            )
    
    pause = pause_service.update_pause(db, pause, pause_in)
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE",
        target_type="PAUSE",
        target_id=pause.pause_id,
        target_name=f"휴지#{pause.pause_id}",
        details={"before": old_data, "after": pause_in.model_dump(exclude_unset=True)},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="휴지 정보가 수정되었습니다.",
        data=PauseResponse.model_validate(pause)
    )


@router.delete("/pauses/{pause_id}", response_model=ResponseModel)
def delete_pause(
    pause_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """휴지 삭제"""
    pause = pause_service.get_pause_by_id(db, pause_id)
    
    if pause is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="휴지 정보를 찾을 수 없습니다."
        )
    
    pause_issue = pause.pause_issue
    order_item_id = pause.order_item_id
    pause_service.delete_pause(db, pause)
    
    activity_log_service.create_log(
        db=db,
        action="DELETE",
        target_type="PAUSE",
        target_id=pause_id,
        target_name=f"휴지#{pause_id}",
        details={"pause_issue": pause_issue, "order_item_id": order_item_id},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="휴지가 삭제되었습니다.")


@router.get("/pauses/issue/{issue}", response_model=ResponseModel[List[PauseByIssueResponse]])
def get_pauses_by_issue(
    issue: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """호수별 휴지 목록"""
    pauses = pause_service.get_pauses_by_issue(db, issue)
    
    return ResponseModel(data=[PauseByIssueResponse(**p) for p in pauses])