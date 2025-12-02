# 표준 라이브러리
from datetime import datetime, timedelta
from typing import Any, Dict

# 서드파티 라이브러리
from fastapi import HTTPException, status
from jose import JWTError, jwt

# 로컬 애플리케이션
from app.core.config import settings
from app.schemas.schema_auth import TokenPayload

# 발급
def encode_access_token(admin_id: int) -> str:
    # 토큰 만료시간 설정
    now = datetime.now()
    expire_at = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # JWT exp는 epoch timestamp(정수)여야 함
    payload: Dict[str, Any] = {
        "sub": admin_id,    
        "type": "access",
        "exp": int(expire_at.timestamp()),
        "iat": int(now.timestamp()),
    }
    # JWT 토큰 생성
    encoded_jwt = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def encode_refresh_token(admin_id: int) -> str:
    # 토큰 만료시간 설정
    now = datetime.now()
    expire_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    # JWT exp는 epoch timestamp(정수)여야 함
    payload: Dict[str, Any] = {
        "sub": admin_id,    
        "type": "refresh",
        "exp": int(expire_at.timestamp()),
        "iat": int(now.timestamp()),
    }
    # JWT 토큰 생성
    encoded_jwt = jwt.encode(payload, settings.JWT_REFRESH_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt


# 검증
def decode_access_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        token_payload = TokenPayload(**payload)
        if token_payload.type != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="잘못된 토큰 유형입니다.")
        # exp는 epoch timestamp이므로 현재 시간의 timestamp와 비교
        if token_payload.exp < int(datetime.now().timestamp()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 만료되었습니다.")
        return token_payload
    except JWTError as e:
        # JWTError는 만료, 서명 오류 등 모든 JWT 관련 오류를 포함
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.")

def decode_refresh_token(token: str) -> TokenPayload:
    try:
        payload = jwt.decode(token, settings.JWT_REFRESH_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        token_payload = TokenPayload(**payload)
        if token_payload.type != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="잘못된 토큰 유형입니다.")
        # exp는 epoch timestamp이므로 현재 시간의 timestamp와 비교
        if token_payload.exp < int(datetime.now().timestamp()):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰이 만료되었습니다.")
        return token_payload
    except JWTError as e:
        # JWTError는 만료, 서명 오류 등 모든 JWT 관련 오류를 포함
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다.")