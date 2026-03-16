# 표준 라이브러리
from datetime import datetime, timezone
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.password import get_password_hash, validate_password_strength
from app.models import admin as admin_model
from app.schemas import admin as admin_schema


def list_admins(
    db: Session,
    page: int = 1,
    limit: int = 20,
    admin_role: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_deleted: bool = False,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[admin_model.Admin], int]:
    query = db.query(admin_model.Admin).filter(
        admin_model.Admin.is_deleted == is_deleted
    )
    if admin_role:
        query = query.filter(admin_model.Admin.admin_role == admin_role)
    if is_active is not None:
        query = query.filter(admin_model.Admin.is_active == is_active)
    if search:
        query = query.filter(
            admin_model.Admin.admin_name.like(f"%{search}%")
        )

    # 정렬
    sort_col = getattr(admin_model.Admin, sort_by, admin_model.Admin.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()
    return items, total


def read_admin_by_id(admin_id: int, db: Session) -> admin_model.Admin:
    admin = db.query(admin_model.Admin).filter(
        admin_model.Admin.admin_id == admin_id,
        admin_model.Admin.is_deleted == False,
    ).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {admin_id}에 해당하는 관리자를 찾을 수 없습니다."
        )
    return admin


def read_admin_by_email(admin_email: str, db: Session) -> admin_model.Admin:
    admin = db.query(admin_model.Admin).filter(
        admin_model.Admin.admin_email == admin_email,
        admin_model.Admin.is_deleted == False,
    ).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"이메일 {admin_email}에 해당하는 관리자를 찾을 수 없습니다."
        )
    return admin


def check_email_duplicate(admin_email: str, db: Session, exclude_admin_id: Optional[int] = None) -> None:
    query = db.query(admin_model.Admin).filter(
        admin_model.Admin.admin_email == admin_email,
        admin_model.Admin.is_deleted == False,
    )
    if exclude_admin_id is not None:
        query = query.filter(admin_model.Admin.admin_id != exclude_admin_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이메일 {admin_email}은(는) 이미 사용 중입니다."
        )


def create_admin(admin_in: admin_schema.AdminCreate, db: Session) -> admin_model.Admin:
    check_email_duplicate(admin_email=admin_in.admin_email, db=db)
    validate_password_strength(plain_password=admin_in.admin_password)

    new_admin = admin_model.Admin(
        admin_email=admin_in.admin_email,
        admin_password=get_password_hash(admin_in.admin_password),
        admin_name=admin_in.admin_name,
        admin_role=admin_in.admin_role,
        is_active=admin_in.is_active,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin


def update_admin(admin_id: int, admin_in: admin_schema.AdminUpdate, db: Session) -> admin_model.Admin:
    existing_admin = read_admin_by_id(admin_id=admin_id, db=db)

    if admin_in.admin_email is not None:
        check_email_duplicate(admin_email=admin_in.admin_email, db=db, exclude_admin_id=admin_id)
        existing_admin.admin_email = admin_in.admin_email
    if admin_in.admin_name is not None:
        existing_admin.admin_name = admin_in.admin_name

    db.commit()
    db.refresh(existing_admin)
    return existing_admin


def update_admin_role(admin_id: int, admin_role: str, db: Session) -> admin_model.Admin:
    admin = read_admin_by_id(admin_id=admin_id, db=db)
    admin.admin_role = admin_role
    db.commit()
    db.refresh(admin)
    return admin


def update_admin_active(admin_id: int, is_active: bool, db: Session) -> admin_model.Admin:
    admin = read_admin_by_id(admin_id=admin_id, db=db)
    admin.is_active = is_active
    db.commit()
    db.refresh(admin)
    return admin


def delete_admin(admin_id: int, db: Session) -> None:
    admin = read_admin_by_id(admin_id=admin_id, db=db)
    admin.is_deleted = True
    admin.is_active = False
    admin.deleted_at = datetime.now(timezone.utc)
    db.commit()


def restore_admin(admin_id: int, db: Session) -> admin_model.Admin:
    # 삭제된 관리자만 조회 (is_deleted == True)
    admin = db.query(admin_model.Admin).filter(
        admin_model.Admin.admin_id == admin_id,
        admin_model.Admin.is_deleted == True,
    ).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {admin_id}에 해당하는 삭제된 관리자를 찾을 수 없습니다."
        )
    admin.is_deleted = False
    admin.deleted_at = None
    db.commit()
    db.refresh(admin)
    return admin


def change_admin_password(admin_id: int, new_password: str, db: Session) -> None:
    admin = read_admin_by_id(admin_id=admin_id, db=db)
    validate_password_strength(plain_password=new_password)
    admin.admin_password = get_password_hash(new_password)
    db.commit()
