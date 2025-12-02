# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.api.dependencies import get_current_admin, require_super_admin
from app.crud import crud_admin
from app.db.session import get_db
from app.models.model_admin import Admin
from app.schemas import schema_admin

router = APIRouter(prefix="/admin", tags=["관리자"])

@router.get("", response_model=List[schema_admin.AdminResponse])
def get_all_admins(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """모든 관리자 조회 (인증 필요)"""
    return crud_admin.read_all_admins(db=db)

@router.get("/{admin_id}", response_model=schema_admin.AdminResponse)
def get_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """특정 관리자 조회 (인증 필요)"""
    return crud_admin.read_admin_by_id(admin_id=admin_id, db=db)

@router.post("", response_model=schema_admin.AdminResponse)
def register_admin(
    admin_in: schema_admin.AdminCreate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """새 관리자 등록 (SUPER_ADMIN 권한 필요)"""
    return crud_admin.create_admin(admin_in=admin_in, db=db)

@router.post("/{admin_id}", response_model=schema_admin.AdminResponse)
def update_admin(
    admin_id: int,
    admin_in: schema_admin.AdminUpdate,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """관리자 정보 수정 (인증 필요)"""
    return crud_admin.update_admin(admin_id=admin_id, admin_in=admin_in, db=db)

@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin(
    admin_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_super_admin)
):
    """관리자 삭제 (SUPER_ADMIN 권한 필요)"""
    # 자기 자신 삭제 방지
    if admin_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다."
        )
    crud_admin.delete_admin(admin_id=admin_id, db=db)

@router.get("/me", response_model=schema_admin.AdminResponse)
def read_admin_me(current_admin: Admin = Depends(get_current_admin)):
    return current_admin