from datetime import datetime, timezone, timedelta
import json
from typing import Optional, Union

from sqlalchemy.orm import Session

from app.models.cafe24_token import Cafe24Token

def _parse_dt(value: Optional[Union[str, datetime]]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)  # 2026-01-12 12:50:00+00:00


def get_by_mall_id(mall_id: str, db: Session) -> Optional[Cafe24Token]:
    return db.query(Cafe24Token).filter(Cafe24Token.mall_id == mall_id).first()


def upsert_from_token_payload(*, payload: dict, db: Session) -> Cafe24Token:
    """
    payload는 카페24 토큰 응답(JSON).
    refresh_token 재발급 시 새 refresh_token이 내려오므로, 있으면 항상 교체 저장한다.
    """
    mall_id = payload.get("mall_id")
    row = get_by_mall_id(mall_id, db)
    if row is None:
        row = Cafe24Token(mall_id=mall_id)
        db.add(row)

    expires_at = _parse_dt(payload.get("expires_at"))
    if expires_at is None:
        raise ValueError("Token payload missing expires_at")

    row.access_token = payload["access_token"]
    row.expires_at = expires_at
    new_refresh_token = payload.get("refresh_token")
    if new_refresh_token is not None:
        row.refresh_token = new_refresh_token
    refresh_expires_at = _parse_dt(payload.get("refresh_token_expires_at"))
    if refresh_expires_at is not None:
        row.refresh_token_expires_at = refresh_expires_at

    if "client_id" in payload:
        row.client_id = payload.get("client_id")
    if "mall_id" in payload:
        row.mall_id = payload.get("mall_id")
    elif row.mall_id is None:
        row.mall_id = mall_id
    if "user_id" in payload:
        row.user_id = payload.get("user_id")

    scopes = payload.get("scopes")
    scope_value = payload.get("scope")
    if scopes is not None or scope_value is not None:
        if isinstance(scopes, str):
            scopes = [s.strip() for s in scopes.split(",") if s.strip()]
        if scopes is None and isinstance(scope_value, str):
            scopes = [s.strip() for s in scope_value.split(",") if s.strip()]
        if not isinstance(scopes, list):
            scopes = list(scopes) if scopes else []
        row.scopes = json.dumps(scopes, ensure_ascii=False)
    elif row.scopes is None:
        row.scopes = "[]"

    issued_at = _parse_dt(payload.get("issued_at"))
    if issued_at is not None:
        row.issued_at = issued_at
    if "shop_no" in payload:
        row.shop_no = payload.get("shop_no")
    if "token_type" in payload:
        row.token_type = payload.get("token_type")

    db.commit()
    db.refresh(row)
    return row
