# 표준 라이브러리
from datetime import datetime
from typing import List

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.password import get_password_hash, validate_password_strength
from app.models.model_admin import Admin
from app.schemas import schema_admin


def read_all_admins(db: Session) -> List[Admin]:
    return db.query(Admin).filter(Admin.deleted_at.is_(None)).all()   # 삭제되지 않은 모든 관리자 조회
    
def read_admin_by_id(admin_id: int, db: Session) -> Admin:
    admin = db.query(Admin).filter(Admin.id == admin_id, Admin.deleted_at.is_(None)).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"ID {admin_id}에 해당하는 관리자를 찾을 수 없습니다."
        )
    return admin

def read_admin_by_email(admin_email: str, db: Session) -> Admin:
    admin = db.query(Admin).filter(Admin.email == admin_email, Admin.deleted_at.is_(None)).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"이메일 {admin_email}에 해당하는 관리자를 찾을 수 없습니다."
        )
    return admin

def create_admin(admin_in: schema_admin.AdminCreate, db: Session) -> Admin:
    validate_password_strength(plain_password=admin_in.plain_password)
    hashed_password = get_password_hash(admin_in.plain_password)
    new_admin = Admin(
        email=admin_in.email,
        hashed_password=hashed_password,
        name=admin_in.name,
        role=admin_in.role,
        is_active=admin_in.is_active,
    )
    
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return new_admin

def update_admin(admin_id: int, admin_in: schema_admin.AdminUpdate, db: Session) -> Admin:
    existing_admin = read_admin_by_id(admin_id=admin_id, db=db)

    # None → 기존 값 유지 / Not None → 새 값으로 덮어씀
    if admin_in.plain_password is not None:
        validate_password_strength(plain_password=admin_in.plain_password)
        hashed_password = get_password_hash(admin_in.plain_password)
        existing_admin.hashed_password = hashed_password
    if admin_in.name is not None:
        existing_admin.name = admin_in.name
    if admin_in.role is not None:
        existing_admin.role = admin_in.role
    if admin_in.is_active is not None:
        existing_admin.is_active = admin_in.is_active
    # existing_admin.updated_at = datetime.now()
    
    db.commit() # 변경사항을 DB에 저장
    db.refresh(existing_admin)  # DB의 최신 상태로 ORM 객체를 다시 로딩
    return existing_admin

def delete_admin(admin_id: int, db: Session) -> None:
    admin = read_admin_by_id(admin_id=admin_id, db=db)
    if admin.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 삭제된 관리자입니다.")
    
    admin.deleted_at = datetime.now()
    db.commit()
    db.refresh(admin)