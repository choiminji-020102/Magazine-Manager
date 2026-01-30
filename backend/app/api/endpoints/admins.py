from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
import math

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.admin import AdminCreate, AdminUpdate, AdminResponse, AdminActivateRequest, AdminPasswordChange
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import admin_service, activity_log_service

router = APIRouter(prefix="/admins", tags=["관리자"])

require_super_admin = require_roles(["SUPER_ADMIN"])


@router.get("", response_model=PaginatedResponse[AdminResponse])
def get_admins(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 목록 조회"""
    items, total = admin_service.get_admins(db, page, limit, search, role)
    
    return PaginatedResponse(
        data=[AdminResponse.model_validate(item) for item in items],
        pagination=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    )


@router.get("/{admin_id}", response_model=ResponseModel[AdminResponse])
def get_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 상세 조회"""
    admin = admin_service.get_admin_by_id(db, admin_id)
    
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="관리자를 찾을 수 없습니다."
        )
    
    return ResponseModel(data=AdminResponse.model_validate(admin))


@router.post("", response_model=ResponseModel[AdminResponse], status_code=status.HTTP_201_CREATED)
def create_admin(
    admin_in: AdminCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 등록"""
    # 이메일 중복 체크 (get_admin_by_email은 관리자가 없으면 404를 발생시키므로 예외 처리)
    try:
        existing_admin = admin_service.get_admin_by_email(db, admin_in.email)
        if existing_admin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 이메일입니다."
            )
    except HTTPException as e:
        # 404 에러는 관리자가 없다는 의미이므로 정상적으로 진행
        if e.status_code == status.HTTP_404_NOT_FOUND:
            pass  # 관리자가 없으므로 계속 진행
        else:
            raise  # 다른 에러는 그대로 전달
    
    admin = admin_service.create_admin(db, admin_in)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.ADMIN,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        details={
            "reason": "관리자 등록 성공", 
            "email": admin.email, 
            "role": admin.admin_role
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="관리자가 등록되었습니다.",
        data=AdminResponse.model_validate(admin)
    )


@router.put("/{admin_id}", response_model=ResponseModel[AdminResponse])
def update_admin(
    admin_id: int,
    admin_in: AdminUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 수정"""
    admin = admin_service.get_admin_by_id(db, admin_id)
    
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="관리자를 찾을 수 없습니다."
        )
    
    old_data = {
        "email": admin.email,
        "admin_name": admin.admin_name,
        "admin_role": admin.admin_role,
        "is_active": admin.is_active
    }
    
    if admin_in.email and admin_in.email != admin.email:
        if admin_service.get_admin_by_email(db, admin_in.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 이메일입니다."
            )
    
    admin = admin_service.update_admin(db, admin, admin_in)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ADMIN,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        details={
            "reason": "관리자 수정 성공", 
            "before": old_data, 
            "after": admin_in.model_dump(exclude_unset=True)
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="관리자 정보가 수정되었습니다.",
        data=AdminResponse.model_validate(admin)
    )


@router.delete("/{admin_id}", response_model=ResponseModel)
def delete_admin(
    admin_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 삭제"""
    if admin_id == current_admin.admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다."
        )
    
    admin = admin_service.get_admin_by_id(db, admin_id)
    
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="관리자를 찾을 수 없습니다."
        )
    

    admin_service.delete_admin(db, admin)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.ADMIN,
        target_id=admin_id,
        target_name=admin.admin_name,
        details={
            "reason": "관리자 삭제 성공", 
            "email": admin.email
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="관리자가 삭제되었습니다.")


@router.patch("/{admin_id}/activate", response_model=ResponseModel)
def activate_admin(
    admin_id: int,
    req: AdminActivateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 활성화/비활성화"""
    admin = admin_service.get_admin_by_id(db, admin_id)
    
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="관리자를 찾을 수 없습니다."
        )
    
    is_active = req.is_active if req.is_active is not None else not admin.is_active
    admin_service.update_admin(db, admin, AdminUpdate(is_active=is_active))
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.ACTIVATE if is_active else ActivityAction.DEACTIVATE,
        target_type=ActivityTargetType.ADMIN,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        details={
            "reason": "관리자 활성화/비활성화 성공", 
            "is_active": is_active
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    message = "관리자가 활성화되었습니다." if is_active else "관리자가 비활성화되었습니다."
    return ResponseModel(message=message, data={"is_active": is_active})


@router.patch("/{admin_id}/password", response_model=ResponseModel)
def change_admin_password(
    admin_id: int,
    req: AdminPasswordChange,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 비밀번호 변경 (SUPER_ADMIN 전용)"""
    admin = admin_service.get_admin_by_id(db, admin_id)
    
    if admin is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="관리자를 찾을 수 없습니다."
        )
    
    admin_service.change_password(db, admin, req.new_password)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ADMIN,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        details={"reason": "비밀번호 변경 성공"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="비밀번호가 변경되었습니다.")