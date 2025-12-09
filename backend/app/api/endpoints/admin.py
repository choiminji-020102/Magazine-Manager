# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.api.dependencies import get_current_admin, require_super_admin
from app.crud import admin as admin_crud
from app.db.session import get_db
from app.models import admin as admin_model
from app.schemas import admin as admin_schema

router = APIRouter(prefix="/admin", tags=["관리자"])

@router.get("", response_model=List[admin_schema.AdminResponse])
def get_all_admins(
    current_admin: admin_model.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return admin_crud.read_all_admins(db=db)

@router.get("/me", response_model=admin_schema.AdminResponse)
def read_admin_me(current_admin: admin_model.Admin = Depends(get_current_admin)):
    return current_admin

@router.get("/{admin_id}", response_model=admin_schema.AdminResponse)
def get_admin(
    admin_id: int,
    current_admin: admin_model.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return admin_crud.read_admin_by_id(admin_id=admin_id, db=db)

@router.post("", response_model=admin_schema.AdminResponse)
def register_admin(
    admin_in: admin_schema.AdminCreate,
    current_admin: admin_model.Admin = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return admin_crud.create_admin(admin_in=admin_in, db=db)

@router.post("/{admin_id}", response_model=admin_schema.AdminResponse)
def update_admin(
    admin_id: int,
    admin_in: admin_schema.AdminUpdate,
    current_admin: admin_model.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    # 자기 자신이 아니고, SUPER_ADMIN이 아닌 경우 권한 없음
    if admin_id != current_admin.id and current_admin.role != admin_model.AdminRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="다른 관리자의 정보를 수정할 권한이 없습니다."
        )
    
    # 자기 자신의 role을 변경하려는 경우 SUPER_ADMIN만 가능
    if admin_id == current_admin.id and admin_in.role is not None and admin_in.role != current_admin.role:
        if current_admin.role != admin_model.AdminRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="자신의 역할을 변경할 권한이 없습니다."
            )
    
    # 다른 관리자의 role을 변경하려는 경우 SUPER_ADMIN만 가능
    if admin_id != current_admin.id and admin_in.role is not None:
        if current_admin.role != admin_model.AdminRole.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="다른 관리자의 역할을 변경할 권한이 없습니다."
            )
    
    return admin_crud.update_admin(admin_id=admin_id, admin_in=admin_in, db=db)

@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin(
    admin_id: int,
    current_admin: admin_model.Admin = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    # 자기 자신 삭제 방지
    if admin_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신은 삭제할 수 없습니다."
        )
    admin_crud.delete_admin(admin_id=admin_id, db=db)
