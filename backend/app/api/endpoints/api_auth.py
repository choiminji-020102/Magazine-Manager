# 서드파티 라이브러리
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.api.dependencies import get_current_admin
from app.crud import crud_auth
from app.db.session import get_db
from app.schemas import schema_auth

router = APIRouter(prefix="/auth", tags=["인증"])

@router.post("/login", response_model=schema_auth.TokenPairResponse)
def login(login_in: schema_auth.LoginRequest, db: Session = Depends(get_db)):
    """
    1. 이메일/비밀번호로 사용자 인증
    2. Access + Refresh Token 동시 발급
    3. Refresh Token은 DB에 저장 (로그아웃/탈취 대응 가능)
    """
    return crud_auth.login(login_in=login_in, db=db)

@router.post("/refresh", response_model=schema_auth.TokenPairResponse)
def refresh_token(refresh_in: schema_auth.RefreshRequest, db: Session = Depends(get_db)):
    """
    Refresh Token으로 새로운 Access + Refresh 토큰을 재발급.

    - 1) JWT 서명/만료 검증
    - 2) DB에 해당 refresh token이 존재하는지 확인
    - 3) 이미 폐기된 토큰인지, 만료된 토큰인지 확인
    - 4) 유효하면:
        - 기존 refresh token은 revoke(회전)
        - 새 refresh token을 발급 및 저장
    """
    return crud_auth.refresh_token(refresh_in=refresh_in, db=db)

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(logout_in: schema_auth.LogoutRequest, db: Session = Depends(get_db)):
    """
    클라이언트에서 보유한 Refresh Token을 서버에 전달하여 로그아웃 처리.

    - DB에 해당 토큰이 있으면 revoked = True로 변경
    - Access Token은 짧은 만료시간으로 자연스럽게 무효화된다고 가정
    """
    return crud_auth.logout(logout_in=logout_in, db=db)

