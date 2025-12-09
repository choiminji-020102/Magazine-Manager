# dependencies
# 의존성으로 인증된(토큰으로 검증된) 현재 사용자 가져오기 (OAuth2PasswordBearer)
# Access Token을 읽어서 현재 로그인 유저를 가져오는 부분.

# 서드파티 라이브러리
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, ExpiredSignatureError
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.token import decode_access_token
from app.crud import admin as admin_crud
from app.db.session import get_db
from app.models import admin as admin_model

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login") # 요청 헤더에서 Bearer access 토큰 파싱해줌. Authorization 헤더가 없으면 FastAPI가 자동으로 401을 던짐. 

def get_current_admin(access_token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> admin_model.Admin:
    if not access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access Token이 필요합니다.")
    try:
        payload = decode_access_token(access_token, verify_exp=True)
    except ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="이 Access Token이 만료되었습니다.")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 Access Token입니다.")

    # 토큰 페이로드 검증 (sub는 문자열이므로 정수로 변환)
    try:
        admin_id = int(payload.sub)
        if admin_id <= 0:
            raise ValueError("Invalid Admin ID")
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 Access Token입니다.")

    admin = admin_crud.read_admin_by_id(admin_id=admin_id, db=db)
    
    # 삭제된 계정 차단 (read_admin_by_id에서 이미 deleted_at 확인하지만 명시적으로 체크)
    if admin.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="삭제된 계정입니다.")
    
    # 비활성 계정 차단
    if not admin.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성 계정입니다.")

    return admin

def require_super_admin(current_admin: admin_model.Admin = Depends(get_current_admin)) -> admin_model.Admin:
    if current_admin.role != admin_model.AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="이 작업을 수행할 권한이 없습니다.")
    return current_admin
