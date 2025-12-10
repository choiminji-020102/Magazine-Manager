# 표준 라이브러리
from datetime import datetime, timedelta
from typing import Any, Callable, Dict, Optional

# 서드파티 라이브러리
from fastapi import HTTPException, status
from jose import JWTError, ExpiredSignatureError, jwt

# 로컬 애플리케이션
from app.core.config import settings
from app.schemas import auth as auth_schema

# 발급
def encode_token(admin_id: int, expires_delta: timedelta, jwt_secret_key: str, token_type: str) -> str:
    # UTC 시간 사용 (JWT 표준)
    # now = datetime.utcnow() # tzinfo가 없는 naive datetime
    now = datetime.now(timezone.utc) # tzinfo가 있는 aware datetime

    payload: Dict[str, Any] = {
        "sub": str(admin_id),
        "type": token_type,
        "exp": now + expires_delta, # datetime을 넣어도 jwt.encode() 안에서 자동으로 int timestamp로 변환됨.
        "iat": now,
    }
    return jwt.encode(payload, jwt_secret_key, algorithm=settings.JWT_ALGORITHM)

def encode_access_token(admin_id: int) -> str:
    return encode_token(admin_id, timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES), settings.JWT_ACCESS_SECRET_KEY, "access")

def encode_refresh_token(admin_id: int) -> str:
    return encode_token(admin_id, timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS), settings.JWT_REFRESH_SECRET_KEY, "refresh")


# 검증
def decode_access_token(token: str, verify_exp: bool = True) -> auth_schema.TokenPayload:
    payload = jwt.decode(
        token,
        settings.JWT_ACCESS_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"verify_exp": verify_exp},
    )
    if payload["type"] != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="잘못된 토큰 유형입니다.")
    return auth_schema.TokenPayload(**payload)

def decode_refresh_token(token: str, verify_exp: bool = True) -> auth_schema.TokenPayload:
    payload = jwt.decode(   # payload는 pydantic 모델이 아닌 dict임
        token,
        settings.JWT_REFRESH_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"verify_exp": verify_exp},
    )
    if payload["type"] != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="잘못된 토큰 유형입니다.")
    return auth_schema.TokenPayload(**payload)


# 유틸리티 함수
def is_token_valid(decode_func: Callable, token: str) -> bool:
    """만료 여부 포함한 전체 검증"""
    try:
        decode_func(token, verify_exp=True)
        return True
    except ExpiredSignatureError:
        return False
    except JWTError:
        return False


def decode_token_safely(decode_func: Callable, token: str) -> Optional[Dict[str, Any]]:
    """verify_exp=False로 디코딩해서 sub 읽을 수 있게 한다."""
    try:
        payload = decode_func(token, verify_exp=False)
        # TokenPayload 객체를 dict로 변환
        return {
            "sub": payload.sub,
            "type": payload.type,
            "exp": payload.exp,
            "iat": payload.iat,
        }
    except JWTError:
        return None


def extract_admin_id_from_payloads(access_payload: Optional[Dict[str, Any]], refresh_payload: Optional[Dict[str, Any]]) -> Optional[int]:
    """access 또는 refresh payload에서 admin_id 추출"""
    if access_payload and "sub" in access_payload:
        return int(access_payload["sub"])
    if refresh_payload and "sub" in refresh_payload:
        return int(refresh_payload["sub"])
    return None