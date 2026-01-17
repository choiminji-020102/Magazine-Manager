from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/", summary="Liveness check")
def health_check() -> Dict[str, Any]:
    # 프로세스가 살아있는지(앱 자체)만 확인
    return {"status": "healthy"}


@router.get("/db", summary="Readiness check (DB)")
def db_health() -> Dict[str, Any]:
    """
    DB 연결/쿼리 가능 여부를 확인한다.
    - 성공: 200
    - 실패: 503 (DB 불가로 서비스 준비 안 됨)
    """
    try:
        with engine.connect() as conn:
            # 트랜잭션 불필요. 단순 1회 실행
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "checks": {"db": "ok"}}

    except SQLAlchemyError as e:
        # 운영에서 detail로 내부정보 노출하지 않는 편이 안전함
        logger.exception("DB health check failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        )
