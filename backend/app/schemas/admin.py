# 표준 라이브러리
from datetime import datetime
from typing import Optional

# 서드파티 라이브러리
from pydantic import BaseModel, EmailStr

# 로컬 애플리케이션
from app.models import admin as admin_model


# 생성 요청용 (클라이언트 → 서버)
class AdminCreate(BaseModel):
    email: EmailStr
    plain_password: str
    name: str
    role: admin_model.AdminRole
    is_active: bool
    

# 수정 요청용 - 부분 수정 가능 (클라이언트 → 서버)
class AdminUpdate(BaseModel):
    email: Optional[EmailStr] = None
    plain_password: Optional[str] = None
    name: Optional[str] = None
    role: Optional[admin_model.AdminRole] = None
    is_active: Optional[bool] = None


# 응답용 (서버 → 클라이언트)
class AdminResponse(BaseModel):
    id: int
    email: EmailStr
    name: str
    role: admin_model.AdminRole
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    # deleted_at: datetime

    class Config:
        from_attributes = True  # ORM 객체를 바로 넣어도 변환되도록
        # crud에서는 ORM 객체로 반환하고 router에서는 Pydantic 모델로 변환하도록 설정되어 있기 때문에 from_attributes = True 설정해줘야 함