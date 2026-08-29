import asyncio
import base64
import logging
from typing import Any, Dict, List, Optional, Tuple

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

def _header_int(r: httpx.Response, name: str) -> int:
    """Rate Limit 헤더를 초 단위 정수로. 값이 없거나 이상하면 0.

    카페24가 소수("1.5")로 줄 가능성까지 감안해 float 를 거쳐 변환한다.
    """
    try:
        return int(float(r.headers.get(name) or 0))
    except (TypeError, ValueError):
        return 0


async def _call_with_429_retry(
    *,
    method: str,
    url: str,
    db: Session,
    client: httpx.AsyncClient,
    params: Optional[dict] = None,
    json_body: Optional[dict] = None,
) -> httpx.Response:
    """카페24 호출 + 429(Bucket 초과) 1회 재시도.

    Shipments 관련 호출은 Bucket 40 을 **POST·PUT·조회가 함께** 소진한다(§1). 발송완료
    처리는 사전 조회(GET) → POST → PUT 순으로 연달아 호출하므로, 어느 단계든 429 를
    만날 수 있다. 그래서 재시도 로직을 한 곳에 두고 모든 호출이 공유한다.

    대기 시간은 X-Cafe24-Call-Remain / X-Cafe24-Time-Remain 중 큰 값(최소 2초).
    호출 횟수 초과인지 처리 시간 초과인지 불문하고 동일 처리한다(§1 권장 전략).
    재시도해도 429 면 그대로 반환 — 판단은 호출자 몫이다.
    """
    r = await call_cafe24(method=method, url=url, db=db, client=client,
                          params=params, json_body=json_body)
    if r.status_code != 429:
        return r

    wait = max(_header_int(r, "X-Cafe24-Call-Remain"),
               _header_int(r, "X-Cafe24-Time-Remain"), 2)
    logger.warning("Cafe24 429 (%s %s) — %d초 대기 후 1회 재시도", method, url, wait)
    await asyncio.sleep(wait)
    return await call_cafe24(method=method, url=url, db=db, client=client,
                             params=params, json_body=json_body)



def _extract_errors(r: httpx.Response) -> List[Dict]:
    """응답 본문에서 카페24 errors 배열을 꺼낸다. 파싱 불가하면 빈 리스트.

    카페24는 배치 일부가 실패했을 때 HTTP 200 + errors 로 주기도 하고 HTTP 422 + errors 로
    주기도 한다(둘 다 실제 관측). 그래서 HTTP 에러여도 본문을 열어봐야 "어느 항목이 왜
    실패했는지"를 알 수 있다. 각 error 의 more_info 에 order_id / shipping_code 가 들어 있어
    요청 항목과 역매칭할 수 있다.

    성패 판정은 shipments 배열이 아니라 **errors 를 기준으로** 한다 — errors 에 없는 요청
    항목은 성공으로 본다. 2026-08-25 에 관측한 422 응답에는 성공분 shipments 가 함께 오지
    않았기 때문이다(설계 문서 §5-3 의 404 예시에는 함께 오는 것으로 기록돼 있어, 오류 종류에
    따라 다를 수 있다). shipments 유무에 의존하지 않는 이 방식이 양쪽 모두에서 성립한다.
    """
    body = _parse_json_object(r)
    if body is None:
        return []
    errors = body.get("errors")
    return errors if isinstance(errors, list) else []


def _extract_shipments(r: httpx.Response) -> List[Dict]:
    """응답 본문에서 shipments 배열을 꺼낸다. 없으면 빈 리스트.

    **실패 응답에서도 호출한다.** CAFE24_STATUS_SYNC_PLAN.md §5-3 에 부분 실패 응답이
    성공분 shipments 와 errors 를 함께 담는 예시(404 Shipment number cannot be found)가
    기록돼 있다. 반면 2026-08-25 에 관측한 422(상태 전환 거부) 응답에는 shipments 가 없었다.
    오류 종류에 따라 다를 수 있으므로 "오면 쓰고 없으면 만다".

    MONTHLY 는 이 배열에서 shipping_code 를 받아 OrderItem 에 저장한다. 부분 실패라고
    통째로 버리면 성공한 건의 shipping_code 를 잃고, 재시도 시 같은 주문을 다시 POST 해
    카페24에 중복 배송 레코드가 생긴다. (YEARLY 는 이 배열을 쓰지 않는다.)
    """
    body = _parse_json_object(r)
    if body is None:
        return []
    shipments = body.get("shipments")
    return shipments if isinstance(shipments, list) else []


def _parse_json_object(r: httpx.Response) -> Optional[dict]:
    """응답 본문을 dict 로 파싱. JSON 이 아니거나 dict 가 아니면 None."""
    try:
        body = r.json()
    except Exception:
        return None
    return body if isinstance(body, dict) else None


async def _call_shipments_batch_once(
    *,
    method: str,
    db: Session,
    client: httpx.AsyncClient,
    batch: List[Dict],
) -> Tuple[Optional[List[Dict]], Optional[str], Optional[int], List[Dict]]:
    """batch(최대 100건) 1회 호출 — 429는 1회 재시도까지 포함.

    반환: (shipments, reason, status_code, errors)
      - 성공:        (shipments, None, None, [])
      - 실패:        (shipments, 사유 문구, http 상태코드, errors)
                     · errors 는 항목별 판정용. 얻지 못했으면 빈 리스트이며, 이때는
                       소비자가 종래처럼 "배치 전체 실패"로 처리해야 한다.
                     · shipments 는 실패 응답에도 성공분이 실려 올 수 있어 함께 넘긴다.
                       (429 처럼 본문 자체가 없으면 None/빈 리스트)

    _call_shipments(기존, 실패 시 raise)와 _call_shipments_tolerant(부분 성공 허용) 둘 다
    이 함수를 공유해서 카페24 호출/재시도 로직이 두 곳에 따로 구현되지 않도록 함.
    """
    url = f"{BASE_URL}/shipments"
    req_body = {"shop_no": 1, "requests": batch}

    r = await _call_with_429_retry(method=method, url=url, db=db, client=client, json_body=req_body)

    if r.status_code == 429:
        return None, "Cafe24 Shipments API Rate Limit 초과 — 잠시 후 다시 시도해주세요.", http_status.HTTP_429_TOO_MANY_REQUESTS, []
    if r.is_error:
        # 카페24의 상태 전환 거부는 422(Unprocessable Entity)로 온다 — 요청 형식은 유효하지만
        # 지금 상태에서는 처리할 수 없다는 뜻. 예: 이미 배송중인 주문에 status="shipping" 을
        # 다시 보내면 "(Current order status: In transit)" 로 거부한다(In transit = 배송중/N30).
        #
        # 우리가 502(Bad Gateway)로 되돌리는 것은 이 API 소비자 입장에서 "외부 연동 실패"이기
        # 때문이다. 카페24의 422 를 그대로 흘리면 우리 요청이 잘못된 것처럼 읽힌다.
        #
        # 응답 본문은 자르지 않고 전부 전달하고, errors 도 함께 넘겨 항목별 판정이 가능하게 한다.
        # shipments 도 (있으면) 함께 넘긴다 — MONTHLY 가 성공분의 shipping_code 를 저장해야 한다.
        return (
            _extract_shipments(r),
            f"Cafe24 Shipments API 오류 ({r.status_code}): {r.text}",
            http_status.HTTP_502_BAD_GATEWAY,
            _extract_errors(r),
        )

    result = r.json()
    errors = result.get("errors") or []
    if errors:
        # 성공분 shipments 가 함께 올 수 있다(§5-3). 버리지 않고 넘긴다.
        return (
            result.get("shipments") or [],
            f"Cafe24 Shipments API partial error: {r.text}",
            http_status.HTTP_400_BAD_REQUEST,
            errors,
        )

    return result.get("shipments") or [], None, None, []


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
    응답 errors 배열이 있으면 전체 실패로 처리 (HTTPException). 기존 소비자(Cafe24 주문
    가져오기 등)가 "실패하면 예외로 전체 중단"을 기대하므로 이 동작은 절대 바꾸지 않음 —
    부분 성공을 허용해야 하는 새 소비자는 아래 _call_shipments_tolerant를 사용할 것.
    """
    batch_size = 100
    all_shipments: List[Dict] = []

    for i in range(0, len(requests_payload), batch_size):
        batch = requests_payload[i:i + batch_size]
        shipments, reason, status_code, _errors = await _call_shipments_batch_once(
            method=method, db=db, client=client, batch=batch
        )
        if reason:
            # 기존 소비자(주문 가져오기 등)는 "실패하면 예외로 전체 중단"을 기대하므로
            # errors 를 항목별로 풀지 않고 종래대로 즉시 raise 한다.
            raise HTTPException(status_code=status_code, detail=reason)
        all_shipments.extend(shipments or [])

        if i + batch_size < len(requests_payload):
            await asyncio.sleep(0.5)

    return all_shipments


def _match_errors_to_requests(
    batch: List[Dict], errors: List[Dict], reason: str
) -> Optional[List[Dict]]:
    """카페24 errors 를 요청 항목에 1:1 로 붙인다. 붙이지 못하면 None.

    반환 형식: [{"item": 원본 요청 항목, "reason": str, "code": int|None,
                 "message": str|None, "more_info": dict|None}, ...]

    매칭 키는 more_info 의 shipping_code(YEARLY PUT) → order_id(MONTHLY POST) 순.
    order_id 는 한 배치 안에서 중복될 수 있어(박스 분할 시 같은 주문이 여러 요청으로 나뉨)
    중복된 값은 매칭 키로 쓰지 않는다.

    **errors 전부를 매칭하지 못하면 None 을 반환한다.** 일부만 붙이고 나머지를 성공으로
    넘기면, 매칭 못 한 오류에 해당하는 요청이 성공으로 오판된다. 판정 근거가 불완전할 때는
    "배치 전체 실패"라는 안전한 종래 동작으로 떨어지는 편이 낫다.
    """
    if not errors:
        return None

    by_shipping_code: Dict[str, Dict] = {}
    by_order_id: Dict[str, Dict] = {}
    dup_order_ids: set = set()

    for item in batch:
        code = item.get("shipping_code")
        if code:
            by_shipping_code[code] = item
        oid = item.get("order_id")
        if oid:
            if oid in by_order_id:
                dup_order_ids.add(oid)
            else:
                by_order_id[oid] = item

    matched: List[Dict] = []
    for err in errors:
        if not isinstance(err, dict):
            return None
        more_info = err.get("more_info") or {}
        item = by_shipping_code.get(more_info.get("shipping_code"))
        if item is None:
            oid = more_info.get("order_id")
            if oid in dup_order_ids:
                return None  # 어느 요청의 오류인지 특정 불가
            item = by_order_id.get(oid)
        if item is None:
            return None  # 이 오류를 어떤 요청에도 붙이지 못함
        matched.append({
            "item": item,
            "reason": reason,
            "code": err.get("code"),
            "message": err.get("message"),
            "more_info": more_info,
        })

    return matched


async def _call_shipments_tolerant(
    *,
    method: str,
    db: Session,
    client: httpx.AsyncClient,
    requests_payload: List[Dict],
) -> Tuple[List[Dict], List[Dict]]:
    """_call_shipments와 동일하게 100건씩 호출하지만, 배치 하나가 실패해도 예외를 던지지 않고
    나머지 배치를 계속 진행함. 반환: (성공한 shipments 응답 리스트, 실패 '항목' 목록).

    실패 항목 형식: {"item": 원본 payload 항목, "reason": str,
                     "code": int|None, "message": str|None, "more_info": dict|None}

    카페24가 errors 를 줬고 그 전부를 요청 항목에 매칭할 수 있으면 **실패한 항목만** 담는다.
    (errors 에 없는 항목은 성공으로 간주 — 성공분 shipments 는 응답에 오지 않는다.)
    매칭에 실패했거나 errors 자체를 못 얻은 경우에는 배치의 모든 항목을 실패로 담아
    종래의 "배치 전체 실패"와 동일하게 동작한다.

    발송완료 처리처럼 "일부 성공은 그대로 반영하고 실패분만 알려줘야" 하는 소비자용.
    """
    batch_size = 100
    all_shipments: List[Dict] = []
    failed_items: List[Dict] = []

    for i in range(0, len(requests_payload), batch_size):
        batch = requests_payload[i:i + batch_size]
        shipments, reason, _status_code, errors = await _call_shipments_batch_once(
            method=method, db=db, client=client, batch=batch
        )
        # 성공분 shipments 는 실패 배치에서도 (있으면) 챙긴다 — MONTHLY 가 shipping_code 를
        # 저장하는 데 쓴다. 성패 판정 자체는 아래 errors 기준으로만 한다.
        all_shipments.extend(shipments or [])

        if reason:
            matched = _match_errors_to_requests(batch, errors, reason)
            if matched is None:
                logger.warning(
                    "Shipments %s: errors 를 요청 항목에 매칭하지 못해 배치 %d건 전체를 "
                    "실패 처리함 — reason=%s",
                    method, len(batch), reason,
                )
                failed_items.extend(
                    {"item": it, "reason": reason, "code": None, "message": None, "more_info": None}
                    for it in batch
                )
            else:
                failed_items.extend(matched)

        if i + batch_size < len(requests_payload):
            await asyncio.sleep(0.5)

    return all_shipments, failed_items


async def fetch_shipment_statuses(
    *,
    db: Session,
    client: httpx.AsyncClient,
    order_ids: List[str],
) -> Dict[str, Optional[str]]:
    """주문별 배송 레코드를 조회해 {shipping_code: status} 를 만든다.

    status 는 카페24가 items[] 안에 담아주는 값 — "standby"(배송대기) / "shipping"(배송중) /
    "shipped"(배송완료). shipment 최상위가 아니라 items[] 안에 있다는 점에 주의.

    한 shipment 의 items 상태가 섞여 있으면 **"shipped" 를 우선** 반환한다. 배송완료가
    하나라도 섞인 박스에 상태 전환을 보내지 않기 위한 보수적 선택이다.

    429(Bucket 초과)는 _call_with_429_retry 가 헤더가 알려준 만큼 기다렸다 1회 재시도한다.
    그래도 실패하면 아래 is_error 로 떨어져 그 주문만 건너뛴다.

    조회에 실패한 주문의 shipping_code 는 값이 채워지지 않는다(호출자가 None 으로 간주).
    "모르면 건드리지 않는다"를 호출자가 판단할 수 있게 하기 위함 — 여기서 임의로
    기본값을 넣지 않는다.
    """
    statuses: Dict[str, Optional[str]] = {}
    unique_order_ids = list(dict.fromkeys(order_ids))  # 순서 유지 중복 제거

    for idx, order_id in enumerate(unique_order_ids):
        url = f"{BASE_URL}/orders/{order_id}/shipments"
        try:
            r = await _call_with_429_retry(method="GET", url=url, db=db, client=client)
        except HTTPException:
            # 토큰 만료·재연결 필요 같은 인증 문제는 개별 주문의 문제가 아니라 작업 전체를
            # 멈춰야 할 사안이다. 여기서 삼키면 전 건이 "상태를 확인하지 못했습니다 —
            # 잠시 후 다시 시도해주세요"로 실패해, 실제로는 카페24 재연결이 필요한 상황에
            # 관리자에게 틀린 안내가 나간다.
            raise
        except Exception:
            logger.warning("배송상태 조회 실패 (order_id=%s) — 호출 예외", order_id, exc_info=True)
            continue
        if r.is_error:
            logger.warning(
                "배송상태 조회 실패 (order_id=%s) — HTTP %s: %s",
                order_id, r.status_code, r.text,
            )
            continue

        body = _parse_json_object(r)
        for shipment in (body.get("shipments") or []) if body else []:
            code = shipment.get("shipping_code")
            if not code:
                continue
            item_statuses = [
                i.get("status") for i in (shipment.get("items") or []) if i.get("status")
            ]
            if not item_statuses:
                continue
            statuses[code] = "shipped" if "shipped" in item_statuses else item_statuses[0]

        if idx + 1 < len(unique_order_ids):
            # Bucket 회복이 초당 2회라 0.5초 간격이면 순소비가 0 — 건수가 늘어도 소진되지
            # 않는다. 0.2초(초당 5회)로 두면 약 13초 만에 Bucket 40 이 비고, 뒤이어 나가는
            # POST/PUT 까지 429 를 맞는다. 마지막 건 뒤에는 쉬지 않는다.
            await asyncio.sleep(0.5)

    return statuses


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


async def post_shipments_tolerant(
    *,
    db: Session,
    client: httpx.AsyncClient,
    requests_payload: List[Dict],
) -> Tuple[List[Dict], List[Dict]]:
    """post_shipments의 부분성공 허용 버전. 반환: (성공 shipments, 실패 항목 목록).

    실패 항목 형식은 _call_shipments_tolerant 참조 — 배치가 아니라 요청 '항목' 단위다.
    """
    return await _call_shipments_tolerant(method="POST", db=db, client=client, requests_payload=requests_payload)


async def put_shipments_tolerant(
    *,
    db: Session,
    client: httpx.AsyncClient,
    requests_payload: List[Dict],
) -> Tuple[List[Dict], List[Dict]]:
    """put_shipments의 부분성공 허용 버전. 반환: (성공 shipments, 실패 항목 목록).

    실패 항목 형식은 _call_shipments_tolerant 참조 — 배치가 아니라 요청 '항목' 단위다.
    """
    return await _call_shipments_tolerant(method="PUT", db=db, client=client, requests_payload=requests_payload)
