from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, Tuple, List
from datetime import datetime

from app.models.admin import Admin
from app.schemas.admin import AdminCreate, AdminUpdate
from app.core.security import get_password_hash


def get_admin_by_id(db: Session, admin_id: int) -> Optional[Admin]:
    return db.query(Admin).filter(
        Admin.admin_id == admin_id,
        Admin.deleted_at.is_(None)
    ).first()


def get_admin_by_email(db: Session, email: str) -> Optional[Admin]:
    return db.query(Admin).filter(
        Admin.email == email,
        Admin.deleted_at.is_(None)
    ).first()


def get_admins(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    role: Optional[str] = None
) -> Tuple[List[Admin], int]:
    query = db.query(Admin).filter(Admin.deleted_at.is_(None))
    
    if search:
        query = query.filter(
            or_(
                Admin.admin_name.like(f"%{search}%"),
                Admin.email.like(f"%{search}%")
            )
        )
    
    if role:
        query = query.filter(Admin.admin_role == role)
    
    total = query.count()
    
    offset = (page - 1) * limit
    items = query.order_by(Admin.created_at.desc()).offset(offset).limit(limit).all()
    
    return items, total


def create_admin(db: Session, admin_in: AdminCreate) -> Admin:
    admin = Admin(
        email=admin_in.email,
        hashed_password=get_password_hash(admin_in.password),
        admin_name=admin_in.admin_name,
        admin_role=admin_in.admin_role,
        is_active=admin_in.is_active
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def update_admin(db: Session, admin: Admin, admin_in: AdminUpdate) -> Admin:
    update_data = admin_in.model_dump(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(admin, field, value)
    
    db.commit()
    db.refresh(admin)
    return admin


def delete_admin(db: Session, admin: Admin) -> None:
    admin.deleted_at = datetime.now()
    db.commit()


def update_last_login(db: Session, admin: Admin) -> None:
    admin.last_login_at = datetime.now()
    db.commit()


def change_password(db: Session, admin: Admin, new_password: str) -> None:
    admin.hashed_password = get_password_hash(new_password)
    db.commit()
