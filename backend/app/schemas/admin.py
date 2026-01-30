from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Literal
from datetime import datetime


class AdminBase(BaseModel):
    email: EmailStr
    admin_name: str = Field(..., max_length=50)
    admin_role: Literal["SUPER_ADMIN", "ADMIN", "MANAGER"] = "MANAGER"
    is_active: bool = True


class AdminCreate(AdminBase):
    plain_password: str = Field(..., min_length=8)


class AdminUpdate(BaseModel):
    email: Optional[EmailStr] = None
    admin_name: Optional[str] = Field(None, max_length=50)
    admin_role: Optional[Literal["SUPER_ADMIN", "ADMIN", "MANAGER"]] = None
    is_active: Optional[bool] = None


class AdminResponse(BaseModel):
    admin_id: int
    email: str
    admin_name: str
    admin_role: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class AdminActivateRequest(BaseModel):
    is_active: Optional[bool] = None


class AdminPasswordChange(BaseModel):
    new_password: str = Field(..., min_length=8)
