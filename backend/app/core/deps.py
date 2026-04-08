# dependencies
# 의존성으로 인증된(토큰으로 검증된) 현재 사용자 가져오기 (OAuth2PasswordBearer)
# Access Token을 읽어서 현재 로그인 유저를 가져오는 부분.

# 서드파티 라이브러리
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, ExpiredSignatureError
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.token import decode_access_token
from app.crud import admin as admin_crud
from app.db.session import get_db
from app.models import admin as admin_model
from app.models.admin import AdminRole

bearer_scheme = HTTPBearer() # 요청 헤더에서 Bearer access 토큰 파싱. Authorization 헤더가 없으면 자동 401.

def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> admin_model.Admin:
    access_token = credentials.credentials
    try:
        payload = decode_access_token(
            access_token,
            verify_exp=True
        )
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="이 Access Token이 만료되었습니다.",
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="유효하지 않은 Access Token입니다.",
        )

    try:
        admin_id = int(payload.sub)
        if admin_id <= 0:
            raise ValueError("Invalid Admin ID")
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="유효하지 않은 Access Token입니다."
        )

    admin = admin_crud.read_admin_by_id(
        admin_id=admin_id,
        db=db,
    )
    
    # 삭제된 계정 차단
    if admin.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="삭제된 계정입니다.",
        )
    
    # 비활성 계정 차단
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성 계정입니다.",
        )

    return admin


def require_roles(allowed_roles: list[str]):
    def checker(
        current_admin: admin_model.Admin = Depends(get_current_admin),
    ):
        if current_admin.admin_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="이 작업을 수행할 권한이 없습니다.",
            )
        return current_admin
    return checker

# Role shortcuts
require_super_admin = require_roles([AdminRole.SUPER_ADMIN])
require_admin = require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN])
require_manager = require_roles([AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.MANAGER])