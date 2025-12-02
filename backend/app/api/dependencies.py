# dependencies
# 의존성으로 인증된(토큰으로 검증된) 현재 사용자 가져오기 (OAuth2PasswordBearer)
# Access Token을 읽어서 현재 로그인 유저를 가져오는 부분.

# 서드파티 라이브러리
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.token import decode_access_token
from app.crud import crud_admin
from app.db.session import get_db
from app.models.model_admin import Admin, AdminRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # 요청 헤더에서 Bearer 토큰 파싱해줌

def get_current_admin(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> Admin:
    """인증된 현재 관리자 반환 (비활성/삭제된 계정 차단)"""
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 토큰 페이로드 검증
    if not payload.sub or payload.sub <= 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    admin = crud_admin.read_admin_by_id(admin_id=payload.sub, db=db)
    
    # 삭제된 계정 차단
    if admin.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="삭제된 계정입니다.",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    # 비활성 계정 차단
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성 계정입니다.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return admin

def require_super_admin(current_admin: Admin = Depends(get_current_admin)) -> Admin:
    """SUPER_ADMIN 권한이 필요한 엔드포인트용 의존성"""
    if current_admin.role != AdminRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 작업을 수행할 권한이 없습니다."
        )
    return current_admin
