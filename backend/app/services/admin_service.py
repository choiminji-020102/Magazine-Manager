# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.password import verify_password
from app.crud import admin as admin_crud
from app.models.admin import Admin
from app.schemas.admin import AdminCreate, AdminListQuery, AdminUpdate


def get_admins(db: Session, query: AdminListQuery) -> Tuple[List[Admin], int]:
    return admin_crud.list_admins(
        db=db,
        page=query.page,
        limit=query.limit,
        admin_role=query.admin_role,
        is_active=query.is_active,
        is_deleted=query.is_deleted,
        search=query.search,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


def get_admin_by_id(db: Session, admin_id: int) -> Admin:
    return admin_crud.read_admin_by_id(admin_id=admin_id, db=db)


def create_admin(db: Session, admin_in: AdminCreate) -> Admin:
    return admin_crud.create_admin(admin_in=admin_in, db=db)


def update_admin(db: Session, admin_id: int, admin_in: AdminUpdate) -> Admin:
    return admin_crud.update_admin(admin_id=admin_id, admin_in=admin_in, db=db)


def update_role(db: Session, admin_id: int, admin_role: str) -> Admin:
    return admin_crud.update_admin_role(admin_id=admin_id, admin_role=admin_role, db=db)


def activate(db: Session, admin_id: int) -> Admin:
    return admin_crud.update_admin_active(admin_id=admin_id, is_active=True, db=db)


def deactivate(db: Session, admin_id: int) -> Admin:
    return admin_crud.update_admin_active(admin_id=admin_id, is_active=False, db=db)


def delete_admin(db: Session, admin_id: int) -> None:
    admin_crud.delete_admin(admin_id=admin_id, db=db)


def restore_admin(db: Session, admin_id: int) -> Admin:
    return admin_crud.restore_admin(admin_id=admin_id, db=db)


def change_password(
    db: Session,
    admin: Admin,
    current_password: str,
    new_password: str,
) -> None:
    if not verify_password(current_password, admin.admin_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 비밀번호가 올바르지 않습니다."
        )
    admin_crud.change_admin_password(admin_id=admin.admin_id, new_password=new_password, db=db)
