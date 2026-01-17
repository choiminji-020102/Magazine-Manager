import base64
from typing import Any, Dict
from urllib.parse import urlencode

import httpx
from itsdangerous import URLSafeSerializer

from app.core.config import settings


STATE_SALT = "cafe24-oauth-state"

def _get_state_signer() -> URLSafeSerializer:
    return URLSafeSerializer(settings.CAFE24_STATE_SECRET_KEY, salt=STATE_SALT)


def sign_state(payload: dict) -> str:
    return _get_state_signer().dumps(payload)


def verify_state(state: str) -> dict:
    return _get_state_signer().loads(state)


def _oauth_base_url(mall_id: str) -> str:
    return f"https://{mall_id}.cafe24api.com/api/v2/oauth"


def build_authorize_url(*, mall_id: str, state: str, scopes: list[str]) -> str:
    """인증 코드 요청 URL 생성"""
    code_request_url = f"{_oauth_base_url(mall_id)}/authorize"
    params = {
        "response_type": "code",
        "client_id": settings.CAFE24_CLIENT_ID,
        "state": state,
        "redirect_uri": settings.CAFE24_REDIRECT_URI,
        "scope": ",".join(scopes),
    }
    return f"{code_request_url}?{urlencode(params)}"

def _basic_auth_header() -> str:
    raw = f"{settings.CAFE24_CLIENT_ID}:{settings.CAFE24_CLIENT_SECRET_KEY}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("utf-8")

async def issue_access_token(*, mall_id: str, code: str, client: httpx.AsyncClient) -> Dict[str, Any]:
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
    r.raise_for_status()
    return r.json()


async def reissue_access_token(
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
    r.raise_for_status()
    return r.json()
