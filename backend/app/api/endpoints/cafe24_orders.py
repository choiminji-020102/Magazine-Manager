import asyncio
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

    r = await cafe24_admin_service.call_cafe24(
        method="GET",
        url=f"https://{MALL_ID}.cafe24api.com/api/v2/admin/orders",
        db=db,
        client=request.app.state.http_client,
        params={
            "start_date": start_date,
            "end_date": end_date,
            "limit": 1000,
        },
    )
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 주문 조회 실패: {r.text}",
        )
    return r.json()


@router.get("/{order_id}/buyer")
async def get_cafe24_order_buyer(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 주문자(buyer) 정보 조회"""
    r = await cafe24_admin_service.call_cafe24(
        method="GET",
        url=f"https://{MALL_ID}.cafe24api.com/api/v2/admin/orders/{order_id}/buyer",
        db=db,
        client=request.app.state.http_client,
    )
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 주문자 조회 실패 (order_id={order_id}): {r.text}",
        )
    return r.json()


@router.get("/{order_id}/receivers")
async def get_cafe24_order_receivers(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 수령자(배송지) 정보 조회"""
    r = await cafe24_admin_service.call_cafe24(
        method="GET",
        url=f"https://{MALL_ID}.cafe24api.com/api/v2/admin/orders/{order_id}/receivers",
        db=db,
        client=request.app.state.http_client,
    )
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 수령자 조회 실패 (order_id={order_id}): {r.text}",
        )
    return r.json()


@router.get("/{order_id}/items")
async def get_cafe24_order_items(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 주문 품목 조회"""
    r = await cafe24_admin_service.call_cafe24(
        method="GET",
        url=f"https://{MALL_ID}.cafe24api.com/api/v2/admin/orders/{order_id}/items",
        db=db,
        client=request.app.state.http_client,
    )
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 주문 품목 조회 실패 (order_id={order_id}): {r.text}",
        )
    return r.json()


@router.get("/{order_id}/detail")
async def get_cafe24_order_detail(
    order_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 주문 상세 통합 조회 (buyer + receivers + items)"""
    client = request.app.state.http_client
    base = f"https://{MALL_ID}.cafe24api.com/api/v2/admin/orders/{order_id}"

    # buyer, receivers, items 병렬 호출 (각각 call_cafe24로 감싸져 401 자동 재발급)
    buyer_r, receivers_r, items_r = await asyncio.gather(
        cafe24_admin_service.call_cafe24(
            method="GET", url=f"{base}/buyer", db=db, client=client
        ),
        cafe24_admin_service.call_cafe24(
            method="GET", url=f"{base}/receivers", db=db, client=client
        ),
        cafe24_admin_service.call_cafe24(
            method="GET", url=f"{base}/items", db=db, client=client
        ),
    )

    result = {}

    if buyer_r.is_error:
        result["buyer"] = None
    else:
        result["buyer"] = buyer_r.json().get("buyer")

    if receivers_r.is_error:
        result["receivers"] = []
    else:
        result["receivers"] = receivers_r.json().get("receivers", [])

    if items_r.is_error:
        result["items"] = []
    else:
        result["items"] = items_r.json().get("items", [])

    return result
