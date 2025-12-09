# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.api.dependencies import get_current_admin
from app.crud import admin as admin_crud
from app.service import auth as auth_service
from app.db.session import get_db
from app.schemas import auth as auth_schema, admin as admin_schema
from app.models import admin as admin_model

router = APIRouter(prefix="/auth", tags=["인증"])

@router.post("/login", response_model=auth_schema.TokenPairResponse)
def login(
    login_in: auth_schema.LoginRequest, 
    db: Session = Depends(get_db)
):
    return auth_service.login(login_in=login_in, db=db)

@router.post("/refresh", response_model=auth_schema.TokenPairResponse)
def refresh_token(
    refresh_in: auth_schema.RefreshRequest, 
    db: Session = Depends(get_db)
):
    return auth_service.refresh(refresh_in=refresh_in, db=db)

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(logout_in: auth_schema.LogoutRequest, 
    current_admin: admin_model.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return auth_service.logout(logout_in=logout_in, db=db)

@router.post("/signup/init", response_model=admin_schema.AdminResponse, status_code=status.HTTP_201_CREATED)
def init_first_admin(
    admin_in: admin_schema.AdminCreate,
    db: Session = Depends(get_db)
):
    return auth_service.init_first_admin(admin_in=admin_in, db=db)

