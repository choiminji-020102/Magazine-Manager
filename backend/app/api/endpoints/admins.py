# 서드파티 라이브러리
import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.deps import require_admin, require_super_admin
from app.db.session import get_db
from app.models import admin as admin_model
from app.models.activity_log import ActivityAction, ActivityTargetType
from app.schemas.admin import (
    AdminCreate, AdminListQuery,
    AdminResponse, AdminRoleUpdate, AdminUpdate,
)
from app.schemas.common import PaginatedResponse, ResponseModel
from app.services import activity_log_service, admin_service

router = APIRouter(prefix="/admins", tags=["관리자"])


@router.get("", response_model=PaginatedResponse[AdminResponse])
def get_admins(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin_role: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_deleted: bool = False,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),  # SUPER_ADMIN, ADMIN
):
    """관리자 목록 조회"""
    query = AdminListQuery(
        page=page, limit=limit,
        admin_role=admin_role, is_active=is_active, is_deleted=is_deleted,
        search=search, sort_by=sort_by, sort_order=sort_order,
    )
    items, total = admin_service.get_admins(db=db, query=query)
    return PaginatedResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if total > 0 else 0,
        items=items,
    )


@router.get("/{admin_id}", response_model=ResponseModel[AdminResponse])
def get_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),  # SUPER_ADMIN, ADMIN
):
    """관리자 상세 조회"""
    admin = admin_service.get_admin_by_id(db=db, admin_id=admin_id)
    return ResponseModel(data=admin)


@router.post("", response_model=ResponseModel[AdminResponse], status_code=status.HTTP_201_CREATED)
def create_admin(
    admin_in: AdminCreate,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """관리자 등록 (SUPER_ADMIN 전용)"""
    admin = admin_service.create_admin(db=db, admin_in=admin_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.ADMIN,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        details={"admin_email": admin.admin_email, "admin_role": admin.admin_role},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="관리자가 등록되었습니다.", data=admin)


@router.put("/{admin_id}", response_model=ResponseModel[AdminResponse])
def update_admin(
    admin_id: int,
    admin_in: AdminUpdate,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """관리자 수정 - 이메일·이름만 (SUPER_ADMIN 전용)"""
    existing = admin_service.get_admin_by_id(db=db, admin_id=admin_id)
    old_data = {"admin_email": existing.admin_email, "admin_name": existing.admin_name}

    admin = admin_service.update_admin(db=db, admin_id=admin_id, admin_in=admin_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ADMIN,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        details={"before": old_data, "after": admin_in.model_dump(exclude_unset=True)},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="관리자 정보가 수정되었습니다.", data=admin)


@router.patch("/{admin_id}/activate", response_model=ResponseModel[AdminResponse])
def activate_admin(
    admin_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """관리자 활성화 (SUPER_ADMIN 전용)"""
    admin = admin_service.activate(db=db, admin_id=admin_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.ACTIVATE,
        target_type=ActivityTargetType.ADMIN,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="관리자가 활성화되었습니다.", data=admin)


@router.patch("/{admin_id}/deactivate", response_model=ResponseModel[AdminResponse])
def deactivate_admin(
    admin_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """관리자 비활성화 (SUPER_ADMIN 전용, 자기 자신 불가)"""
    if admin_id == current_admin.admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 비활성화할 수 없습니다.",
        )
    admin = admin_service.deactivate(db=db, admin_id=admin_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DEACTIVATE,
        target_type=ActivityTargetType.ADMIN,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="관리자가 비활성화되었습니다.", data=admin)


@router.patch("/{admin_id}/role", response_model=ResponseModel[AdminResponse])
def change_admin_role(
    admin_id: int,
    role_in: AdminRoleUpdate,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """관리자 권한 변경 (SUPER_ADMIN 전용, 자기 자신 불가)"""
    if admin_id == current_admin.admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신의 권한은 변경할 수 없습니다.",
        )
    existing = admin_service.get_admin_by_id(db=db, admin_id=admin_id)
    old_role = existing.admin_role

    admin = admin_service.update_role(db=db, admin_id=admin_id, admin_role=role_in.admin_role)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ADMIN,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        details={"before": {"admin_role": old_role}, "after": {"admin_role": admin.admin_role}},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="관리자 권한이 변경되었습니다.", data=admin)


@router.delete("/{admin_id}", response_model=ResponseModel, status_code=status.HTTP_200_OK)
def delete_admin(
    admin_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """관리자 삭제 (소프트 삭제, SUPER_ADMIN 전용, 자기 자신 불가)"""
    if admin_id == current_admin.admin_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다.",
        )
    admin = admin_service.get_admin_by_id(db=db, admin_id=admin_id)
    admin_service.delete_admin(db=db, admin_id=admin_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.ADMIN,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=admin_id,
        target_name=admin.admin_name,
        details={"admin_email": admin.admin_email},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="관리자가 삭제되었습니다.")


@router.post("/{admin_id}/restore", response_model=ResponseModel[AdminResponse])
def restore_admin(
    admin_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_super_admin),
):
    """관리자 복구 (SUPER_ADMIN 전용)"""
    admin = admin_service.restore_admin(db=db, admin_id=admin_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.RESTORE,
        target_type=ActivityTargetType.ADMIN,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=admin.admin_id,
        target_name=admin.admin_name,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="관리자가 복구되었습니다.", data=admin)


