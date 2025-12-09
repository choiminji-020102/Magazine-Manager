# 표준 라이브러리
from datetime import datetime
from typing import Optional

# 서드파티 라이브러리
from pydantic import BaseModel, EmailStr

# 로컬 애플리케이션
from app.models import admin as admin_model


# 로그인 요청용 (클라이언트 → 서버)
class LoginRequest(BaseModel):
    email: EmailStr
    plain_password: str

# Access/Refresh 동시 발급 응답
class TokenPairResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"  # 기본값 "bearer"

# 리프레시 요청
class RefreshRequest(BaseModel):
    access_token: str
    refresh_token: str


# 로그아웃 요청 (Refresh Token 기반 로그아웃)
class LogoutRequest(BaseModel):
    refresh_token: str


# JWT payload 구조 (내부용)
class TokenPayload(BaseModel):
    sub: str  # admin id (JWT 표준에 따라 문자열로 저장)
    type: str  # "access" or "refresh"
    exp: int   # 만료 시각 - timestamp라서 int로 저장됨. datetime 아님
    iat: int   # 발급 시각 - timestamp라서 int로 저장됨. datetime 아님

