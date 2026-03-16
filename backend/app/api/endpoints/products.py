# 표준 라이브러리
import math

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.deps import require_admin
from app.db.session import get_db
from app.models.activity_log import ActivityAction, ActivityTargetType
from app.models.admin import Admin
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.product import (
    ProductCreate, ProductListQuery, ProductResponse,
    ProductStockUpdate, ProductUpdate,
)
from app.services import activity_log_service, product_service

router = APIRouter(prefix="/products", tags=["상품"])


@router.get("", response_model=PaginatedResponse[ProductResponse])
def get_products(
    query: ProductListQuery = Depends(ProductListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품 목록 조회"""
    items, total = product_service.get_products(db, query)
    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=math.ceil(total / query.limit) if total > 0 else 0,
        items=[ProductResponse.model_validate(item) for item in items],
    )


@router.get("/code/{product_code}", response_model=ResponseModel[ProductResponse])
def get_product_by_code(
    product_code: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품코드로 조회"""
    product = product_service.get_product_by_code(db, product_code)
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 상품 코드를 찾을 수 없습니다.",
        )
    return ResponseModel(data=ProductResponse.model_validate(product))


@router.get("/{product_id}", response_model=ResponseModel[ProductResponse])
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품 상세 조회"""
    product = product_service.get_product_by_id(db, product_id)
    return ResponseModel(data=ProductResponse.model_validate(product))


@router.post("", response_model=ResponseModel[ProductResponse], status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품 등록"""
    product = product_service.create_product(db, product_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.PRODUCT,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=product.product_id,
        target_name=product.product_name,
        details={
            "product_code": product.product_code,
            "product_kind": product.product_kind,
            "list_price": product.list_price,
            "sale_price": product.sale_price,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="상품이 등록되었습니다.", data=ProductResponse.model_validate(product))


@router.put("/{product_id}", response_model=ResponseModel[ProductResponse])
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품 수정"""
    product = product_service.get_product_by_id(db, product_id)
    before = {
        "product_code": product.product_code,
        "product_kind": product.product_kind,
        "product_name": product.product_name,
        "list_price": product.list_price,
        "sale_price": product.sale_price,
        "cost_price": product.cost_price,
        "is_active": product.is_active,
    }

    product = product_service.update_product(db, product, product_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.PRODUCT,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=product_id,
        target_name=product.product_name,
        details={"before": before, "after": product_in.model_dump(exclude_unset=True, mode="json")},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="상품이 수정되었습니다.", data=ProductResponse.model_validate(product))


@router.delete("/{product_id}", response_model=ResponseModel)
def delete_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품 삭제"""
    product = product_service.get_product_by_id(db, product_id)
    product_name = product.product_name
    product_code = product.product_code

    product_service.delete_product(db, product)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.PRODUCT,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=product_id,
        target_name=product_name,
        details={"product_code": product_code},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="상품이 삭제되었습니다.")


@router.patch("/{product_id}/activate", response_model=ResponseModel[ProductResponse])
def activate_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품 활성화"""
    product = product_service.get_product_by_id(db, product_id)
    if product.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 활성화된 상품입니다.",
        )

    product = product_service.activate(db, product)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.ACTIVATE,
        target_type=ActivityTargetType.PRODUCT,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=product_id,
        target_name=product.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="상품이 활성화되었습니다.", data=ProductResponse.model_validate(product))


@router.patch("/{product_id}/deactivate", response_model=ResponseModel[ProductResponse])
def deactivate_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """상품 비활성화"""
    product = product_service.get_product_by_id(db, product_id)
    if not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 비활성화된 상품입니다.",
        )

    product = product_service.deactivate(db, product)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DEACTIVATE,
        target_type=ActivityTargetType.PRODUCT,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=product_id,
        target_name=product.product_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="상품이 비활성화되었습니다.", data=ProductResponse.model_validate(product))


@router.patch("/{product_id}/stock", response_model=ResponseModel[ProductResponse])
def update_stock(
    product_id: int,
    stock_in: ProductStockUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """재고 수정"""
    product = product_service.get_product_by_id(db, product_id)
    before_stock = product.stock_quantity

    product = product_service.update_stock(db, product, stock_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.PRODUCT,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=product_id,
        target_name=product.product_name,
        details={
            "before": {"stock_quantity": before_stock},
            "after": {"stock_quantity": product.stock_quantity},
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="재고가 수정되었습니다.", data=ProductResponse.model_validate(product))
