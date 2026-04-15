from typing import Optional

from fastapi import HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud import cafe24_token as cafe24_token_crud
from app.models.cafe24_token import Cafe24Token


def resolve_mall_id(requested: Optional[str]) -> str:
    configured = settings.CAFE24_MALL_ID
    if requested and requested != configured:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid mall_id",
        )
    return configured

def get_token_row(mall_id: str, db: Session) -> Cafe24Token:
    row = cafe24_token_crud.get_by_mall_id(mall_id, db)
    if not row:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="No token stored",
        )
    return row
