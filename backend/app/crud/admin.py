# 표준 라이브러리
from datetime import datetime, timezone
from typing import List

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.password import get_password_hash, validate_password_strength
from app.models import admin as admin_model
from app.schemas import admin as admin_schema


def read_all_admins(db: Session) -> List[admin_model.Admin]:
    return db.query(admin_model.Admin).filter(admin_model.Admin.deleted_at.is_(None)).all()   # 삭제되지 않은 모든 관리자 조회
    
def read_admin_by_id(admin_id: int, db: Session) -> admin_model.Admin:
    admin = db.query(admin_model.Admin).filter(admin_model.Admin.id == admin_id, admin_model.Admin.deleted_at.is_(None)).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"ID {admin_id}에 해당하는 관리자를 찾을 수 없습니다."
        )
    return admin

def read_admin_by_email(admin_email: str, db: Session) -> admin_model.Admin:
    admin = db.query(admin_model.Admin).filter(admin_model.Admin.email == admin_email, admin_model.Admin.deleted_at.is_(None)).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, 
            detail=f"이메일 {admin_email}에 해당하는 관리자를 찾을 수 없습니다."
        )
    return admin

def check_email_duplicate(admin_email: str, db: Session, exclude_admin_id: int = None) -> None:
    query = db.query(admin_model.Admin).filter(
        admin_model.Admin.email == admin_email,
        admin_model.Admin.deleted_at.is_(None)
    )
    
    # 업데이트 시 자기 자신 제외
    if exclude_admin_id is not None:
        query = query.filter(admin_model.Admin.id != exclude_admin_id)
    
    existing_admin = query.first()
    
    if existing_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"이메일 {admin_email}은(는) 이미 사용 중입니다."
        )

def create_admin(admin_in: admin_schema.AdminCreate, db: Session) -> admin_model.Admin:
    check_email_duplicate(admin_email=admin_in.email, db=db, exclude_admin_id=None) # 이메일 중복 체크
    
    validate_password_strength(plain_password=admin_in.plain_password)
    hashed_password = get_password_hash(admin_in.plain_password)
    
    try:
        new_admin = admin_model.Admin(
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
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"관리자 생성 중 오류가 발생했습니다: {str(e)}"
        )

def update_admin(admin_id: int, admin_in: admin_schema.AdminUpdate, db: Session) -> admin_model.Admin:
    existing_admin = read_admin_by_id(admin_id=admin_id, db=db)

    # None → 기존 값 유지 / Not None → 새 값으로 덮어씀
    if admin_in.email is not None:
        check_email_duplicate(admin_email=admin_in.email, db=db, exclude_admin_id=admin_id) # 이메일 중복 체크
        existing_admin.email = admin_in.email
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
    
    try:
        db.commit() # 변경사항을 DB에 저장
        db.refresh(existing_admin)  # DB의 최신 상태로 ORM 객체를 다시 로딩
        return existing_admin
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"관리자 정보 수정 중 오류가 발생했습니다: {str(e)}"
        )

def delete_admin(admin_id: int, db: Session) -> None:
    admin = read_admin_by_id(admin_id=admin_id, db=db)
    if admin.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 삭제된 관리자입니다.")
    
    try:
        now_utc = datetime.now(timezone.utc)
        admin.deleted_at = now_utc

        admin.is_active = False
        db.commit()
        db.refresh(admin)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"관리자 삭제 중 오류가 발생했습니다: {str(e)}"
        )