# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
# 로컬 애플리케이션
from app.core.deps import get_current_admin
from app.crud import admin as admin_crud
from app.services import auth_service, activity_log_service
from app.db.session import get_db
from app.schemas import auth as auth_schema, admin as admin_schema
from app.models import admin as admin_model

router = APIRouter(prefix="/auth", tags=["인증"])

@router.post("/login", response_model=auth_schema.TokenPairResponse)
def login(
    login_in: auth_schema.LoginRequest, 
    req: Request,
    db: Session = Depends(get_db)
):
    activity_log_service.create_log(
        db=db,
        action="LOGIN_SUCCESS",
        target_type="AUTH",
        details={"reason": "로그인 성공", "email": login_in.email},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent")
    )
    return auth_service.login(login_in=login_in, req=req, db=db)

@router.post("/refresh", response_model=auth_schema.TokenPairResponse)
def refresh_token(
    refresh_in: auth_schema.RefreshRequest,
    req: Request,
    db: Session = Depends(get_db)
):
    return auth_service.refresh(refresh_in=refresh_in, req=req, db=db)

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    logout_in: auth_schema.LogoutRequest, 
    req: Request,
    current_admin: admin_model.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    activity_log_service.create_log(
        db=db,
        action="LOGOUT_SUCCESS",
        target_type="AUTH",
        details={"reason": "로그아웃 성공", "email": current_admin.email},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent")
    )
    return auth_service.logout(logout_in=logout_in, admin=current_admin, req=req, db=db)

@router.post("/signup/init", response_model=admin_schema.AdminResponse, status_code=status.HTTP_201_CREATED)
def init_first_admin(
    admin_in: admin_schema.AdminCreate,
    req: Request,
    db: Session = Depends(get_db)
):
    activity_log_service.create_log(
        db=db,
        action="SIGNUP_SUCCESS",
        target_type="AUTH",
        target_name=admin_in.name,
        details={"reason": "최초 관리자 생성", "email": admin_in.email},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent")
    )
    return auth_service.init_first_admin(admin_in=admin_in, req=req, db=db)

@router.get("/me", response_model=admin_schema.AdminResponse)
def get_current_admin(
    current_admin: admin_model.Admin = Depends(get_current_admin),
):
    """현재 로그인한 관리자 정보 조회"""
    return admin_schema.AdminResponse.model_validate(current_admin)

@router.put("/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    password_change_in: auth_schema.PasswordChangeRequest,
    req: Request,
    current_admin: admin_model.Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    return auth_service.change_password(
        password_change_in=password_change_in,
        admin=current_admin,
        req=req,
        db=db
    )
