from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.send_item import SendItemCreate, SendItemUpdate, SendItemResponse
from app.schemas.common import ResponseModel
from app.services import send_service, send_item_service, activity_log_service

router = APIRouter(tags=["발송 품목"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("/sends/{send_id}/items", response_model=ResponseModel[List[SendItemResponse]])
def get_send_items(
    send_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송별 품목 목록"""
    send = send_service.get_send_by_id(db, send_id)
    if send is None:
        raise HTTPException(status_code=404, detail="발송 정보를 찾을 수 없습니다.")
    
    items = send_item_service.get_send_items_by_send(db, send_id)
    return ResponseModel(data=[SendItemResponse.model_validate(i) for i in items])


@router.post("/sends/{send_id}/items", response_model=ResponseModel[SendItemResponse], status_code=201)
def create_send_item(
    send_id: int,
    item_in: SendItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 품목 추가"""
    send = send_service.get_send_by_id(db, send_id)
    if send is None:
        raise HTTPException(status_code=404, detail="발송 정보를 찾을 수 없습니다.")
    
    try:
        item = send_item_service.create_send_item(db, send, item_in)
        
        activity_log_service.create_log(
            db=db,
            action="CREATE",
            target_type="SEND_ITEM",
            target_id=item.send_item_id,
            target_name=item.product_name,
            details={
                "send_id": send_id,
                "product_code": item.product_code,
                "send_num": item.send_num
            },
            admin=current_admin,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )
        
        return ResponseModel(message="발송 품목이 추가되었습니다.", data=SendItemResponse.model_validate(item))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/send-items/{send_item_id}", response_model=ResponseModel[SendItemResponse])
def get_send_item(
    send_item_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 품목 상세"""
    item = send_item_service.get_send_item_by_id(db, send_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="발송 품목을 찾을 수 없습니다.")
    return ResponseModel(data=SendItemResponse.model_validate(item))


@router.put("/send-items/{send_item_id}", response_model=ResponseModel[SendItemResponse])
def update_send_item(
    send_item_id: int,
    item_in: SendItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 품목 수정"""
    item = send_item_service.get_send_item_by_id(db, send_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="발송 품목을 찾을 수 없습니다.")
    
    old_data = {"send_num": item.send_num}
    
    item = send_item_service.update_send_item(db, item, item_in)
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE",
        target_type="SEND_ITEM",
        target_id=item.send_item_id,
        target_name=item.product_name,
        details={"before": old_data, "after": item_in.model_dump(exclude_unset=True)},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="발송 품목이 수정되었습니다.", data=SendItemResponse.model_validate(item))


@router.delete("/send-items/{send_item_id}", response_model=ResponseModel)
def delete_send_item(
    send_item_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """발송 품목 삭제"""
    item = send_item_service.get_send_item_by_id(db, send_item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="발송 품목을 찾을 수 없습니다.")
    
    product_name = item.product_name
    send_id = item.send_id
    send_item_service.delete_send_item(db, item)
    
    activity_log_service.create_log(
        db=db,
        action="DELETE",
        target_type="SEND_ITEM",
        target_id=send_item_id,
        target_name=product_name,
        details={"send_id": send_id},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="발송 품목이 삭제되었습니다.")