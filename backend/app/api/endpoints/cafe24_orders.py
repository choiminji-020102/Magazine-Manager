from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.admin import Admin
from app.services import cafe24_import_service

router = APIRouter(prefix="/cafe24/orders", tags=["카페24 주문"])


class Cafe24OrderImportRequest(BaseModel):
    external_order_ids: List[str] = Field(..., min_length=1, description="가져올 Cafe24 주문번호 배열")
    dry_run: bool = Field(False, description="True면 매핑·검증만 수행하고 저장하지 않음 (미리보기)")


@router.get("/")
async def list_cafe24_orders(
    request: Request,
    start_date: str = Query(..., description="검색 시작일 (YYYY-MM-DD)"),
    end_date: str = Query(..., description="검색 종료일 (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 주문 목록 조회 — 매핑 문서 규칙대로 변환된 응답 반환.

    Cafe24 GET /orders를 embed=items,receivers,buyer + order_status=N20으로 단일 호출
    (배송준비중 주문만, buyer/receivers/items 동봉).
    상품 매칭(external_product_code_cafe24)도 수행하여 내부 product_code/product_name까지 포함.
    응답에 already_imported 플래그 포함.
    """
    # 검색기간 3개월 제한 검증
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)")
    if end < start:
        raise HTTPException(status_code=400, detail="종료일이 시작일보다 이전일 수 없습니다.")
    if (end - start).days > 89:
        raise HTTPException(status_code=400, detail="검색기간은 3개월을 초과할 수 없습니다.")

    return await cafe24_import_service.list_mapped_orders(
        db=db,
        start_date=start_date,
        end_date=end_date,
        client=request.app.state.http_client,
    )


@router.post("/import")
async def import_cafe24_orders(
    payload: Cafe24OrderImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """선택한 Cafe24 주문들을 내부 DB로 가져옴.

    각 주문 단위 트랜잭션 (실패 시 그 주문만 skip).
    dry_run=True인 경우 매핑·검증만 수행하고 DB에 저장하지 않음 (미리보기 용도).
    응답: imported_count / skipped_count / imported_order_ids / skipped_orders / warnings
    매핑·검증 규칙은 CAFE24_ORDER_IMPORT_MAPPING.md 참조.
    """
    return await cafe24_import_service.import_orders(
        db=db,
        external_order_ids=payload.external_order_ids,
        client=request.app.state.http_client,
        current_admin=current_admin,
        request=request,
        dry_run=payload.dry_run,
    )
