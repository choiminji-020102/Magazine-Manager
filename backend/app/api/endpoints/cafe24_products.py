from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.services import cafe24_admin_service

router = APIRouter(prefix="/cafe24/products", tags=["카페24 상품"])

MALL_ID = settings.CAFE24_MALL_ID


@router.get("/")
async def list_cafe24_products(
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 상품 목록 조회 — 응답을 그대로 반환"""
    row = cafe24_admin_service.get_token_row(MALL_ID, db)

    url = f"https://{MALL_ID}.cafe24api.com/api/v2/admin/products"
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    r = await request.app.state.http_client.get(url, headers=headers)
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 상품 조회 실패: {r.text}",
        )
    return r.json()
