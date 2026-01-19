from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.core.security import verify_password, verify_refresh_token
from app.models.admin import Admin
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshRequest,
    TokenResponse,
    PasswordChangeRequest,
    LogoutRequest,
    AdminInfo
)
from app.schemas.common import ResponseModel
from app.services import auth_service, admin_service, activity_log_service

router = APIRouter(prefix="/auth", tags=["인증"])


@router.post("/login", response_model=ResponseModel[LoginResponse])
def login(request: LoginRequest, req: Request, db: Session = Depends(get_db)):
    """관리자 로그인"""
    admin = auth_service.authenticate_admin(db, request.email, request.password)
    
    if admin is None:
        # 실패 로그
        activity_log_service.create_log(
            db=db,
            action="LOGIN_FAILED",
            target_type="AUTH",
            target_name=request.email,
            details={"reason": "잘못된 이메일 또는 비밀번호"},
            ip_address=req.client.host if req.client else None,
            user_agent=req.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다."
        )
    
    if not admin.is_active:
        activity_log_service.create_log(
            db=db,
            action="LOGIN_FAILED",
            target_type="AUTH",
            target_id=admin.admin_id,
            target_name=admin.email,
            details={"reason": "비활성화된 계정"},
            ip_address=req.client.host if req.client else None,
            user_agent=req.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비활성화된 계정입니다."
        )
    
    access_token, refresh_token = auth_service.create_tokens(db, admin)
    admin_service.update_last_login(db, admin)
    
    # 성공 로그
    activity_log_service.create_log(
        db=db,
        action="LOGIN",
        target_type="AUTH",
        target_id=admin.admin_id,
        target_name=admin.email,
        admin=admin,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="로그인 성공",
        data=LoginResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            admin=AdminInfo(
                admin_id=admin.admin_id,
                email=admin.email,
                admin_name=admin.admin_name,
                admin_role=admin.admin_role
            )
        )
    )


@router.post("/logout", response_model=ResponseModel)
def logout(
    request: LogoutRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """로그아웃"""
    if request.refresh_token:
        auth_service.revoke_refresh_token(db, request.refresh_token)
    
    activity_log_service.create_log(
        db=db,
        action="LOGOUT",
        target_type="AUTH",
        target_id=current_admin.admin_id,
        target_name=current_admin.email,
        admin=current_admin,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent")
    )
    
    return ResponseModel(message="로그아웃 성공")


@router.post("/refresh", response_model=ResponseModel[TokenResponse])
def refresh_token(request: RefreshRequest, req: Request, db: Session = Depends(get_db)):
    """토큰 갱신"""
    payload = verify_refresh_token(request.refresh_token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않거나 만료된 리프레시 토큰입니다."
        )
    
    token_record = auth_service.get_refresh_token(db, request.refresh_token)
    
    if token_record is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="리프레시 토큰이 존재하지 않거나 폐기되었습니다."
        )
    
    admin = admin_service.get_admin_by_id(db, payload.get("admin_id"))
    
    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="비활성화된 계정입니다."
        )
    
    auth_service.revoke_refresh_token(db, request.refresh_token)
    new_access_token, new_refresh_token = auth_service.create_tokens(db, admin)
    
    activity_log_service.create_log(
        db=db,
        action="TOKEN_REFRESH",
        target_type="AUTH",
        target_id=admin.admin_id,
        target_name=admin.email,
        admin=admin,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="토큰 갱신 성공",
        data=TokenResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token
        )
    )


@router.put("/password", response_model=ResponseModel)
def change_password(
    request: PasswordChangeRequest,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(get_current_admin)
):
    """비밀번호 변경"""
    if not verify_password(request.current_password, current_admin.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="현재 비밀번호가 올바르지 않습니다."
        )
    
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="비밀번호는 최소 8자 이상이어야 합니다."
        )
    
    admin_service.change_password(db, current_admin, request.new_password)
    auth_service.revoke_all_tokens_for_admin(db, current_admin.admin_id)
    
    activity_log_service.create_log(
        db=db,
        action="PASSWORD_CHANGE",
        target_type="AUTH",
        target_id=current_admin.admin_id,
        target_name=current_admin.email,
        admin=current_admin,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent")
    )
    
    return ResponseModel(message="비밀번호가 변경되었습니다. 다시 로그인해주세요.")