from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ActivityLogCreate(BaseModel):
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None


class ActivityLogResponse(BaseModel):
    log_id: int
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    action: str
    target_type: str
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    details: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True