# 표준 라이브러리
from datetime import datetime
from typing import Optional

# 서드파티 라이브러리
from pydantic import BaseModel, EmailStr

# 로컬 애플리케이션
from app.models.model_admin import AdminRole


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
    refresh_token: str


# 로그아웃 요청 (Refresh Token 기반 로그아웃)
class LogoutRequest(BaseModel):
    refresh_token: str


# JWT payload 구조 (내부용)
class TokenPayload(BaseModel):
    sub: int  # admin id (정수로 저장)
    type: str  # "access" or "refresh"
    exp: int   # 만료 시각 (epoch)


# # 현재 로그인 관리자 응답 예시
# class UserMeResponse(BaseModel):
#     id: int
#     email: EmailStr
#     name: str   
#     role: str
#     is_active: bool
#     last_login_at: Optional[datetime] = None
#     created_at: datetime
#     updated_at: datetime

#     class Config:
#         from_attributes = True