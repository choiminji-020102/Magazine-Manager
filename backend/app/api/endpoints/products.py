from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
from app.services import product_service, activity_log_service

router = APIRouter(prefix="/products", tags=["상품"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("", response_model=PaginatedResponse[ProductResponse])
def get_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    kind: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 목록 조회"""
    items, total = product_service.get_products(db, page, limit, search, kind, is_active)
    
    return PaginatedResponse(
        data=[ProductResponse.model_validate(item) for item in items],
        pagination=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    )


@router.get("/kind/{product_kind}", response_model=ResponseModel[List[ProductResponse]])
def get_products_by_kind(
    product_kind: str,
    active_only: bool = Query(True),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품종류별 조회"""
    if product_kind not in ["YEARLY", "MONTHLY", "SINGLE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 상품 종류입니다."
        )
    
    products = product_service.get_products_by_kind(db, product_kind, active_only)
    
    return ResponseModel(data=[ProductResponse.model_validate(p) for p in products])


@router.get("/code/{product_code}", response_model=ResponseModel[ProductResponse])
def get_product_by_code(
    product_code: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품코드로 조회"""
    product = product_service.get_product_by_code(db, product_code)
    
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다."
        )
    
    return ResponseModel(data=ProductResponse.model_validate(product))


@router.get("/{product_id}", response_model=ResponseModel[ProductResponse])
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 상세 조회"""
    product = product_service.get_product_by_id(db, product_id)
    
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다."
        )
    
    return ResponseModel(data=ProductResponse.model_validate(product))


@router.post("", response_model=ResponseModel[ProductResponse], status_code=status.HTTP_201_CREATED)
def create_product(
    product_in: ProductCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 등록"""
    if product_service.get_product_by_code(db, product_in.product_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 상품 코드입니다."
        )
    
    product = product_service.create_product(db, product_in)
    
    activity_log_service.create_log(
        db=db,
        action="CREATE",
        target_type="PRODUCT",
        target_id=product.product_id,
        target_name=product.product_name,
        details={"code": product.product_code, "kind": product.product_kind, "price": product.price},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="상품이 등록되었습니다.",
        data=ProductResponse.model_validate(product)
    )


@router.put("/{product_id}", response_model=ResponseModel[ProductResponse])
def update_product(
    product_id: int,
    product_in: ProductUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 수정"""
    product = product_service.get_product_by_id(db, product_id)
    
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다."
        )
    
    old_data = {
        "product_code": product.product_code,
        "product_name": product.product_name,
        "price": product.price,
        "is_active": product.is_active
    }
    
    if product_in.product_code and product_in.product_code != product.product_code:
        if product_service.get_product_by_code(db, product_in.product_code):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 상품 코드입니다."
            )
    
    product = product_service.update_product(db, product, product_in)
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE",
        target_type="PRODUCT",
        target_id=product.product_id,
        target_name=product.product_name,
        details={"before": old_data, "after": product_in.model_dump(exclude_unset=True)},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="상품 정보가 수정되었습니다.",
        data=ProductResponse.model_validate(product)
    )


@router.delete("/{product_id}", response_model=ResponseModel)
def delete_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 삭제"""
    product = product_service.get_product_by_id(db, product_id)
    
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다."
        )
    
    product_name = product.product_name
    product_code = product.product_code
    product_service.delete_product(db, product)
    
    activity_log_service.create_log(
        db=db,
        action="DELETE",
        target_type="PRODUCT",
        target_id=product_id,
        target_name=product_name,
        details={"code": product_code},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="상품이 삭제되었습니다.")


@router.patch("/{product_id}/activate", response_model=ResponseModel)
def activate_product(
    product_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 활성화/비활성화"""
    product = product_service.get_product_by_id(db, product_id)
    
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="상품을 찾을 수 없습니다."
        )
    
    product = product_service.toggle_active(db, product)
    
    activity_log_service.create_log(
        db=db,
        action="ACTIVATE" if product.is_active else "DEACTIVATE",
        target_type="PRODUCT",
        target_id=product.product_id,
        target_name=product.product_name,
        details={"is_active": product.is_active},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    message = "상품이 활성화되었습니다." if product.is_active else "상품이 비활성화되었습니다."
    return ResponseModel(message=message, data={"is_active": product.is_active})