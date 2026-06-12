import asyncio
import base64
import logging
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException, status as http_status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud import cafe24_token as cafe24_token_crud
from app.models.cafe24_token import Cafe24Token

logger = logging.getLogger(__name__)

MALL_ID = settings.CAFE24_MALL_ID
BASE_URL = f"https://{MALL_ID}.cafe24api.com/api/v2/admin"

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


# ── Shipments API ─────────────────────────────────────────────────────────────

async def _call_shipments(
    *,
    method: str,
    db: Session,
    client: httpx.AsyncClient,
    requests_payload: List[Dict],
) -> List[Dict]:
    """POST 또는 PUT /api/v2/admin/shipments 배치 호출. 응답 shipments 배열 반환.

    100건씩 나눠 호출. 배치 간 0.5초 지연으로 Bucket 소진 방지.
    429 수신 시 X-Cafe24-Call-Remain 헤더만큼 대기 후 1회 재시도.
    응답 errors 배열이 있으면 전체 실패로 처리 (HTTPException 400).
    """
    url = f"{BASE_URL}/shipments"
    batch_size = 100
    all_shipments: List[Dict] = []

    for i in range(0, len(requests_payload), batch_size):
        batch = requests_payload[i:i + batch_size]
        req_body = {"shop_no": 1, "requests": batch}

        r = await call_cafe24(method=method, url=url, db=db, client=client, json_body=req_body)

        if r.status_code == 429:
            call_remain = int(r.headers.get("X-Cafe24-Call-Remain", "0"))
            time_remain = int(r.headers.get("X-Cafe24-Time-Remain", "0"))
            wait = max(call_remain, time_remain, 2)  # 호출 횟수/처리 시간 제한 중 큰 값, 최소 2초
            await asyncio.sleep(wait)
            r = await call_cafe24(method=method, url=url, db=db, client=client, json_body=req_body)

        if r.status_code == 429:
            raise HTTPException(
                status_code=http_status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Cafe24 Shipments API Rate Limit 초과 — 잠시 후 다시 시도해주세요.",
            )
        if r.is_error:
            raise HTTPException(
                status_code=http_status.HTTP_502_BAD_GATEWAY,
                detail=f"Cafe24 Shipments API 오류 ({r.status_code}): {r.text[:200]}",
            )

        result = r.json()
        errors = result.get("errors") or []
        if errors:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Cafe24 Shipments API partial error: {errors}",
            )

        all_shipments.extend(result.get("shipments") or [])

        if i + batch_size < len(requests_payload):
            await asyncio.sleep(0.5)

    return all_shipments


async def post_shipments(
    *,
    db: Session,
    client: httpx.AsyncClient,
    requests_payload: List[Dict],
) -> List[Dict]:
    """POST /api/v2/admin/shipments — 배송 레코드 신규 생성. 응답 shipments 배열 반환.

    requests_payload 항목 형식:
      {
        "order_id": str,
        "tracking_no": str,
        "shipping_company_code": str,   # "0001"(자체배송) / "0006"(CJ대한통운)
        "status": "standby" | "shipping",
        "order_item_code": [str, ...]   # 품목 지정 시 사용
      }
    """
    return await _call_shipments(method="POST", db=db, client=client, requests_payload=requests_payload)


async def put_shipments(
    *,
    db: Session,
    client: httpx.AsyncClient,
    requests_payload: List[Dict],
) -> None:
    """PUT /api/v2/admin/shipments — 기존 배송 레코드 상태 전환.

    requests_payload 항목 형식:
      {
        "shipping_code": str,           # POST 응답으로 발급된 값 (필수)
        "status": "standby" | "shipping" | "shipped"
      }
    ⚠️ status와 tracking_no/shipping_company_code 동시 사용 불가 (Cafe24 API 제약).
    """
    await _call_shipments(method="PUT", db=db, client=client, requests_payload=requests_payload)
