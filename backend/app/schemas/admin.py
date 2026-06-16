# 표준 라이브러리
from datetime import datetime
from typing import Optional

# 서드파티 라이브러리
from pydantic import BaseModel, ConfigDict, EmailStr, Field

# 로컬 애플리케이션
from app.models.admin import AdminRole


class AdminCreate(BaseModel):
    admin_name: str                 # 필수
    admin_role: AdminRole = AdminRole.MANAGER
    email: EmailStr                 # 필수, unique
    is_active: bool = True
    plain_password: str             # 필수 (평문, 서버에서 해싱)


class AdminUpdate(BaseModel):
    # ※ admin_role 변경은 PATCH /role, 비밀번호 변경은 POST /change-password 로 처리
    email: Optional[EmailStr] = None
    admin_name: Optional[str] = None


class AdminRoleUpdate(BaseModel):
    admin_role: AdminRole           # 필수



class AdminResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    admin_id: int
    email: str = Field(validation_alias="admin_email")
    admin_name: str
    admin_role: str
    is_active: bool
    is_deleted: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None


class AdminListQuery(BaseModel):
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)
    admin_role: Optional[AdminRole] = None
    is_active: Optional[bool] = None
    is_deleted: Optional[bool] = None  # None = 전체, False = 활성만, True = 삭제만
    search: Optional[str] = None    # admin_name 검색
    sort_by: str = "created_at"
    sort_order: str = "desc"
