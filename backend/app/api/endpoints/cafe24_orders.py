from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.services import cafe24_admin_service

router = APIRouter(prefix="/cafe24/orders", tags=["카페24 주문"])

MALL_ID = settings.CAFE24_MALL_ID


@router.get("/")
async def list_cafe24_orders(
    request: Request,
    start_date: str = Query(..., description="검색 시작일 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="검색 종료일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 주문 목록 조회 — 응답을 그대로 반환"""
    # 검색기간 3개월 제한 검증
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")
    if (end - start).days > 89:
        raise HTTPException(status_code=400, detail="검색기간은 3개월을 초과할 수 없습니다.")
    if end < start:
        raise HTTPException(status_code=400, detail="종료일이 시작일보다 이전일 수 없습니다.")

    row = cafe24_admin_service.get_token_row(MALL_ID, db)

    url = f"https://{MALL_ID}.cafe24api.com/api/v2/admin/orders"
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }
    params = {
        "start_date": start_date,
        "end_date": end_date,
        "limit": 1000,
    }

    r = await request.app.state.http_client.get(url, headers=headers, params=params)
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 주문 조회 실패: {r.text}",
        )
    return r.json()
