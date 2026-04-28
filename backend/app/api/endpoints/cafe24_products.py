from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_admin
from app.db.session import get_db
from app.models.admin import Admin
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductResponse
from app.services import cafe24_admin_service, product_service, activity_log_service
from app.schemas.activity_log import ActivityAction, ActivityTargetType

router = APIRouter(prefix="/cafe24/products", tags=["카페24 상품"])

MALL_ID = settings.CAFE24_MALL_ID


PRODUCT_PICK_FIELDS = {
    "product_no",
    "product_code",
    "product_name",
    "retail_price",
    "price",
    "selling",
    "list_image",
    "product_weight",
    "created_date",
    "updated_date",
}


@router.get("/")
async def list_cafe24_products(
    request: Request,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    """Cafe24 상품 목록 조회 — 프론트엔드에서 사용하는 필드만 반환"""
    r = await cafe24_admin_service.call_cafe24(
        method="GET",
        url=f"https://{MALL_ID}.cafe24api.com/api/v2/admin/products",
        db=db,
        client=request.app.state.http_client,
        params={"limit": 100},
    )
    if r.is_error:
        raise HTTPException(
            status_code=r.status_code,
            detail=f"Cafe24 상품 조회 실패: {r.text}",
        )
    data = r.json()
    raw_products = data.get("products", [])

    # 이미 DB에 등록된 Cafe24 상품코드 일괄 조회
    cafe24_codes = [p.get("product_code") for p in raw_products if p.get("product_code")]
    imported_codes = set()
    if cafe24_codes:
        imported_codes = {
            row[0]
            for row in db.query(Product.external_product_code_cafe24)
            .filter(Product.external_product_code_cafe24.in_(cafe24_codes))
            .all()
        }

    # 필요한 필드만 필터링 + already_imported 주입
    data["products"] = [
        {
            **{k: v for k, v in p.items() if k in PRODUCT_PICK_FIELDS},
            "already_imported": p.get("product_code") in imported_codes,
        }
        for p in raw_products
    ]
    return data


# ── Cafe24 상품 → DB 저장 ────────────────────────────────────────────────────


class Cafe24ProductImportItem(BaseModel):
    cafe24_product_code: str          # Cafe24 상품코드 → external_product_code_cafe24
    product_code: str                 # 내부 상품코드 (예: W0+202606)
    product_kind: str                 # YEARLY | MONTHLY
    product_name: str
    list_price: int = 0
    sale_price: int = 0
    cost_price: int = 0
    stock_quantity: int = 0
    unit_weight: Optional[float] = None


class Cafe24ProductImportRequest(BaseModel):
    items: List[Cafe24ProductImportItem]


class Cafe24ProductImportResultItem(BaseModel):
    cafe24_product_code: str
    product_code: str
    status: str                       # "created" | "skipped" | "failed"
    message: Optional[str] = None


class Cafe24ProductImportResponse(BaseModel):
    created_count: int
    skipped_count: int
    failed_count: int
    results: List[Cafe24ProductImportResultItem]


@router.post("/import", status_code=status.HTTP_201_CREATED)
def import_cafe24_products(
    import_in: Cafe24ProductImportRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """Cafe24 상품을 선택하여 DB에 저장"""
    results: List[Cafe24ProductImportResultItem] = []

    for item in import_in.items:
        # 이미 등록된 Cafe24 상품코드인지 확인
        existing = product_service.get_product_by_external_code(
            db, item.cafe24_product_code, "CAFE24"
        )
        if existing:
            results.append(Cafe24ProductImportResultItem(
                cafe24_product_code=item.cafe24_product_code,
                product_code=item.product_code,
                status="skipped",
                message=f"이미 등록된 상품입니다 (product_id: {existing.product_id})",
            ))
            continue

        try:
            product_create = ProductCreate(
                product_code=item.product_code,
                product_kind=item.product_kind,
                product_name=item.product_name,
                external_product_code_cafe24=item.cafe24_product_code,
                list_price=item.list_price,
                sale_price=item.sale_price,
                cost_price=item.cost_price,
                stock_quantity=item.stock_quantity,
                unit_weight=item.unit_weight,
                is_active=True,
            )
            product = product_service.create_product(db, product_create)

            activity_log_service.create_log(
                db=db,
                action=ActivityAction.CREATE,
                target_type=ActivityTargetType.PRODUCT,
                admin_id=current_admin.admin_id,
                admin_name=current_admin.admin_name,
                target_id=product.product_id,
                target_name=product.product_name,
                details={"cafe24_product_code": item.cafe24_product_code},
                ip_address=request.client.host if request.client else None,
                user_agent=request.headers.get("user-agent"),
            )

            results.append(Cafe24ProductImportResultItem(
                cafe24_product_code=item.cafe24_product_code,
                product_code=item.product_code,
                status="created",
            ))
        except HTTPException as e:
            results.append(Cafe24ProductImportResultItem(
                cafe24_product_code=item.cafe24_product_code,
                product_code=item.product_code,
                status="failed",
                message=e.detail,
            ))
        except Exception as e:
            db.rollback()
            results.append(Cafe24ProductImportResultItem(
                cafe24_product_code=item.cafe24_product_code,
                product_code=item.product_code,
                status="failed",
                message=str(e),
            ))

    created = sum(1 for r in results if r.status == "created")
    skipped = sum(1 for r in results if r.status == "skipped")
    failed = sum(1 for r in results if r.status == "failed")

    return Cafe24ProductImportResponse(
        created_count=created,
        skipped_count=skipped,
        failed_count=failed,
        results=results,
    )
