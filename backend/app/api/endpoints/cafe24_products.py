from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
import httpx

from app.core.config import settings

from app.db.session import get_db
from app.service import cafe24_admin as cafe24_admin_service

router = APIRouter(prefix="/cafe24/admin/products", tags=["카페24 Admin - Products"])

@router.get("/")
async def retrieve_products(
    mall_id: str = Query(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/products"
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
        )
    
    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),  # 보통 application/json
    )


@router.post("/")
async def create_product(
    mall_id: str = Query(...),
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/products"
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method="POST",
            url=admin_request_url,
            headers=headers,
            json=payload,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),
    )


@router.put("/{product_no}")
async def update_product(
    product_no: int,
    mall_id: str = Query(...),
    payload: dict = Body(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = (
        f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/products/{product_no}"
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


@router.delete("/{product_no}")
async def delete_product(
    product_no: int,
    mall_id: str = Query(...),
    db: Session = Depends(get_db),
):
    resolved_mall_id = cafe24_admin_service.resolve_mall_id(mall_id)
    row = cafe24_admin_service.get_token_row(resolved_mall_id, db)

    admin_request_url = (
        f"https://{resolved_mall_id}.cafe24api.com/api/v2/admin/products/{product_no}"
    )
    headers = {
        "Authorization": f"Bearer {row.access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }

    async with httpx.AsyncClient() as client:
        response = await client.request(
            method="DELETE",
            url=admin_request_url,
            headers=headers,
        )

    return Response(
        content=response.content,
        status_code=response.status_code,
        media_type=response.headers.get("content-type"),
    )
