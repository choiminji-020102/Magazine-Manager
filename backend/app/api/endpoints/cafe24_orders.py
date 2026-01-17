from fastapi import APIRouter, Body, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
import httpx

from app.core.config import settings
from app.db.session import get_db
from app.service import cafe24_admin as cafe24_admin_service

router = APIRouter(prefix="/cafe24/admin/orders", tags=["카페24 Admin - Orders"])


@router.get("/")
async def retrieve_orders(
    request: Request,
    mall_id: str = Query(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/orders"
    params = [
        (key, value)
        for key, value in request.query_params.multi_items()
        if key != "mall_id"
    ]
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method="GET",
            url=admin_request_url,
            headers=headers,
            params=params or None,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),
    )


@router.get("/count")
async def retrieve_orders_count(
    request: Request,
    mall_id: str = Query(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = (
        f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/orders/count"
    )
    params = [
        (key, value)
        for key, value in request.query_params.multi_items()
        if key != "mall_id"
    ]
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method="GET",
            url=admin_request_url,
            headers=headers,
            params=params or None,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),
    )


@router.get("/{order_id}")
async def retrieve_order(
    request: Request,
    order_id: str,
    mall_id: str = Query(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = (
        f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/orders/{order_id}"
    )
    params = [
        (key, value)
        for key, value in request.query_params.multi_items()
        if key != "mall_id"
    ]
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method="GET",
            url=admin_request_url,
            headers=headers,
            params=params or None,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),
    )


@router.put("/{order_id}")
async def update_order_status(
    order_id: str,
    payload: dict = Body(...),
    mall_id: str = Query(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = (
        f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/orders/{order_id}"
    )
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method="PUT",
            url=admin_request_url,
            headers=headers,
            json=payload,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),
    )


@router.put("/")
async def update_orders_status(
    payload: dict = Body(...),
    mall_id: str = Query(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/orders"
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method="PUT",
            url=admin_request_url,
            headers=headers,
            json=payload,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),
    )
