from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class Cafe24OAuthStartRequest(BaseModel):
    scopes: List[str] = Field(default_factory=list)

class Cafe24TokenStatusResponse(BaseModel):
    authorized: bool
    expires_at: Optional[datetime] = None
    refresh_token_expires_at: Optional[datetime] = None
    mall_id: str
    scopes: List[str] = Field(default_factory=list)