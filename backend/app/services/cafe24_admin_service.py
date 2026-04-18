import asyncio
import base64
import logging
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud import cafe24_token as cafe24_token_crud
from app.models.cafe24_token import Cafe24Token

logger = logging.getLogger(__name__)

# 동일 프로세스 내에서 refresh_token 재발급 요청을 직렬화하기 위한 락.
# 여러 요청이 동시에 401을 받아 각자 같은 refresh_token으로 재발급을 시도하면
# Cafe24가 rotation 정책에 따라 일부를 invalid_grant로 거절할 수 있다.
_reissue_lock = asyncio.Lock()


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


def oauth_base_url() -> str:
    return f"https://{settings.CAFE24_MALL_ID}.cafe24api.com/api/v2/oauth"


def basic_auth_header() -> str:
    raw = f"{settings.CAFE24_CLIENT_ID}:{settings.CAFE24_CLIENT_SECRET_KEY}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("utf-8")


def cafe24_api_headers(access_token: str) -> dict:
    return {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "X-Cafe24-Api-Version": settings.CAFE24_API_VERSION,
    }


async def reissue_access_token(
    *, refresh_token_value: str, client: httpx.AsyncClient
) -> Dict[str, Any]:
    """리프레시 토큰을 사용하여 엑세스 토큰을 재발급"""
    token_request_url = f"{oauth_base_url()}/token"
    headers = {
        "Authorization": basic_auth_header(),
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "refresh_token",
        "refresh_token": refresh_token_value,
    }
    r = await client.post(token_request_url, headers=headers, data=data)
    if r.is_error:
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        error_code = body.get("error", "unknown")
        error_desc = body.get("error_description", "")
        logger.error(
            f"Cafe24 토큰 재발급 실패 (mall_id={settings.CAFE24_MALL_ID}): {error_code} — {error_desc}"
        )
        if error_code == "invalid_grant":
            raise HTTPException(
                status_code=r.status_code,
                detail="리프레시 토큰이 만료되었거나 이미 사용되었습니다. 인증 코드 요청부터 다시 시작해주세요.",
            )
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 토큰 재발급 실패: {error_code} — {error_desc}",
        )
    return r.json()


async def force_reissue(
    *, db: Session, client: httpx.AsyncClient
) -> Cafe24Token:
    """
    수동 재발급 (관리자가 설정 화면에서 직접 트리거하는 경우).
    call_cafe24의 자동 재발급과 동일한 락을 공유하므로 동시 재발급 충돌이 없다.
    """
    mall_id = settings.CAFE24_MALL_ID
    row = get_token_row(mall_id, db)
    if not row.refresh_token:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="No refresh_token stored",
        )

    async with _reissue_lock:
        db.refresh(row)
        if not row.refresh_token:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="No refresh_token stored",
            )
        payload = await reissue_access_token(
            refresh_token_value=row.refresh_token, client=client
        )
        row = cafe24_token_crud.upsert_from_token_payload(payload=payload, db=db)
    return row


async def call_cafe24(
    *,
    method: str,
    url: str,
    db: Session,
    client: httpx.AsyncClient,
    params: Optional[dict] = None,
    json_body: Optional[dict] = None,
) -> httpx.Response:
    """
    Cafe24 API 호출 공통 헬퍼.
    - 저장된 access_token으로 요청
    - 401 응답 시 refresh_token으로 access_token 재발급 후 1회 재시도
    - 동시 재발급 방지를 위해 _reissue_lock + double-check 패턴 사용
    - 재발급 자체가 실패하면 HTTPException (리프레시 토큰 만료 → 재연결 필요)
    """
    mall_id = settings.CAFE24_MALL_ID
    row = get_token_row(mall_id, db)
    used_access_token = row.access_token

    r = await client.request(
        method, url, headers=cafe24_api_headers(used_access_token), params=params, json=json_body
    )
    if r.status_code != 401:
        return r

    # 401 → 재발급 필요. 락으로 직렬화하여 한 번만 수행하도록 함.
    async with _reissue_lock:
        # 락 획득 후 최신 토큰 재조회. 다른 task가 이미 갱신했다면 그 토큰으로 재시도만.
        db.refresh(row)
        if row.access_token != used_access_token:
            logger.debug(f"Cafe24 access_token이 이미 다른 요청에서 갱신됨 (mall_id={mall_id}) — 재발급 스킵")
        else:
            if not row.refresh_token:
                raise HTTPException(
                    status_code=http_status.HTTP_401_UNAUTHORIZED,
                    detail="Cafe24 refresh_token이 없습니다. 재연결이 필요합니다.",
                )
            logger.info(f"Cafe24 access_token 만료 감지, 재발급 시도 (mall_id={mall_id})")
            payload = await reissue_access_token(
                refresh_token_value=row.refresh_token, client=client
            )
            cafe24_token_crud.upsert_from_token_payload(payload=payload, db=db)
            db.refresh(row)

    # 새 토큰으로 1회 재시도
    return await client.request(
        method, url, headers=cafe24_api_headers(row.access_token), params=params, json=json_body
    )
