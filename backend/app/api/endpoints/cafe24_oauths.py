import base64
import json
import logging
import secrets
import time
from typing import Any, Dict, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status as http_status
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin
from app.crud import cafe24_token as cafe24_token_crud
from app.db.session import get_db
from app.schemas import cafe24 as cafe24_schema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/cafe24/oauth", tags=["카페24 OAuth"])

STATE_TTL_MINUTES = 10
STATE_SALT = "cafe24-oauth-state"


def _get_state_signer() -> URLSafeSerializer:
    return URLSafeSerializer(settings.CAFE24_STATE_SECRET_KEY, salt=STATE_SALT)


def _sign_state(payload: dict) -> str:
    return _get_state_signer().dumps(payload)


def _verify_state(state: str) -> dict:
    return _get_state_signer().loads(state)


def _oauth_base_url(mall_id: str) -> str:
    return f"https://{mall_id}.cafe24api.com/api/v2/oauth"


def _build_authorize_url(*, mall_id: str, state: str, scopes: list[str]) -> str:
    """인증 코드 요청 URL 생성"""
    code_request_url = f"{_oauth_base_url(mall_id)}/authorize"
    params = {
        "response_type": "code",
        "client_id": settings.CAFE24_CLIENT_ID,
        "state": state,
        "redirect_uri": settings.CAFE24_REDIRECT_URI,
        "scope": " ".join(scopes),
    }
    return f"{code_request_url}?{urlencode(params)}"


def _basic_auth_header() -> str:
    raw = f"{settings.CAFE24_CLIENT_ID}:{settings.CAFE24_CLIENT_SECRET_KEY}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("utf-8")


async def _issue_access_token(*, mall_id: str, code: str, client: httpx.AsyncClient) -> Dict[str, Any]:
    """인증 코드와 교환하여 엑세스 토큰을 발급"""
    token_request_url = f"{_oauth_base_url(mall_id)}/token"
    headers = {
        "Authorization": _basic_auth_header(),
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.CAFE24_REDIRECT_URI,
    }
    r = await client.post(token_request_url, headers=headers, data=data)
    if r.is_error:
        body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 토큰 발급 실패: {body.get('error', 'unknown')} — {body.get('error_description', '')}",
        )
    return r.json()


async def _reissue_access_token(
    *, mall_id: str, refresh_token_value: str, client: httpx.AsyncClient
) -> Dict[str, Any]:
    """리프레시 토큰을 사용하여 엑세스 토큰을 재발급"""
    token_request_url = f"{_oauth_base_url(mall_id)}/token"
    headers = {
        "Authorization": _basic_auth_header(),
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
        # 사용된 refresh_token은 Cafe24 측에서 폐기되므로, 실패 시 토큰 유실 가능성 로깅
        logger.error(f"Cafe24 토큰 재발급 실패 (mall_id={mall_id}): {error_code} — {error_desc}")
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


def _resolve_mall_id(requested: Optional[str]) -> str:
    configured = settings.CAFE24_MALL_ID
    if requested and requested != configured:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid mall_id",
        )
    return configured


@router.post("/start")
def oauth_start(
    start_in: cafe24_schema.Cafe24OAuthStartRequest,
    _=Depends(require_admin),
):
    mall_id = _resolve_mall_id(start_in.mall_id)
    signed_state = _sign_state(
        {"mall_id": mall_id, "nonce": secrets.token_urlsafe(32), "ts": int(time.time())}
    )

    authorize_url = _build_authorize_url(
        mall_id=mall_id,
        state=signed_state,
        scopes=start_in.scopes,
    )
    return {"authorize_url": authorize_url}


@router.get("/callback", response_model=cafe24_schema.Cafe24TokenStatusResponse)
async def oauth_callback(
    request: Request,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    trace_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if error:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Cafe24 인증 실패: {error} (trace_id: {trace_id})",
        )
    if not code or not state:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Missing code/state",
        )
    try:
        state_payload = _verify_state(state)
    except BadSignature:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid state",
        )

    if not isinstance(state_payload, dict):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid state",
        )
    issued_at = state_payload.get("ts")
    if not isinstance(issued_at, int):
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid state",
        )
    if time.time() - issued_at > STATE_TTL_MINUTES * 60:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail="Invalid state",
        )

    mall_id = _resolve_mall_id(state_payload.get("mall_id"))
    token_payload = await _issue_access_token(
        mall_id=mall_id,
        code=code,
        client=request.app.state.http_client,
    )
    row = cafe24_token_crud.upsert_from_token_payload(payload=token_payload, db=db)

    scopes = json.loads(row.scopes or "[]")
    return cafe24_schema.Cafe24TokenStatusResponse(
        authorized=True,
        expires_at=row.expires_at,
        refresh_token_expires_at=row.refresh_token_expires_at,
        mall_id=row.mall_id,
        scopes=scopes,
    )


@router.get("/status/{mall_id}", response_model=cafe24_schema.Cafe24TokenStatusResponse)
def status(
    mall_id: str,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    mall_id = _resolve_mall_id(mall_id)
    row = cafe24_token_crud.get_by_mall_id(mall_id, db)
    if not row:
        return cafe24_schema.Cafe24TokenStatusResponse(mall_id=mall_id, authorized=False)

    scopes = json.loads(row.scopes or "[]")
    return cafe24_schema.Cafe24TokenStatusResponse(
        authorized=True,
        expires_at=row.expires_at,
        refresh_token_expires_at=row.refresh_token_expires_at,
        mall_id=mall_id,
        scopes=scopes,
    )


@router.post("/refresh/{mall_id}", response_model=cafe24_schema.Cafe24TokenStatusResponse)
async def oauth_refresh(
    mall_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    mall_id = _resolve_mall_id(mall_id)
    row = cafe24_token_crud.get_by_mall_id(mall_id, db)
    if not row or not row.refresh_token:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="No refresh_token stored")

    token_payload = await _reissue_access_token(
        mall_id=mall_id,
        refresh_token_value=row.refresh_token,
        client=request.app.state.http_client,
    )
    row = cafe24_token_crud.upsert_from_token_payload(
        payload=token_payload,
        db=db,
    )

    scopes = json.loads(row.scopes or "[]")
    return cafe24_schema.Cafe24TokenStatusResponse(
        authorized=True,
        expires_at=row.expires_at,
        refresh_token_expires_at=row.refresh_token_expires_at,
        mall_id=row.mall_id,
        scopes=scopes,
    )
