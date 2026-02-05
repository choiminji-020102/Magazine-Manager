from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.product import ProductListQuery, ProductCreate, ProductUpdate, ProductResponse
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import product_service, activity_log_service

router = APIRouter(prefix="/products", tags=["상품"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("", response_model=PaginatedResponse[ProductResponse])
def get_products(
    query: ProductListQuery = Depends(ProductListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 목록 조회"""
    items, total = product_service.get_products(
        db, query.page, query.limit, query.search, query.kind, query.is_active
    )
    
    return PaginatedResponse(
        data=[ProductResponse.model_validate(item) for item in items],
        pagination=PaginationMeta(
            total=total,
            page=query.page,
            limit=query.limit,
            total_pages=math.ceil(total / query.limit) if total > 0 else 0
        )
    )


@router.get("/code/{product_code}", response_model=ResponseModel[ProductResponse])
def get_product_by_code(
    product_code: str,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품코드로 조회"""
    product = product_service.get_product_by_code(db, product_code)
    
    return ResponseModel(data=ProductResponse.model_validate(product))


@router.get("/{product_id}", response_model=ResponseModel[ProductResponse])
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """상품 상세 조회"""
    product = product_service.get_product_by_id(db, product_id)
    
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
        admin=current_admin,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.PRODUCT,
        target_id=product.product_id,
        target_name=product.product_name,
        details={
            "reason": "상품 등록 성공",
            "code": product.product_code, 
            "kind": product.product_kind, 
            "price": product.price
        },
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
    
    old_data = {
        "product_code": product.product_code,
        "product_name": product.product_name,
        "price": product.price,
        "is_active": product.is_active
    }
    
    # product_code는 수정 불가능하므로 체크하지 않음
    product = product_service.update_product(db, product, product_in)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.PRODUCT,
        target_id=product_id,
        target_name=product.product_name,
        details={
            "reason": "상품 수정 성공",
            "before": old_data, 
            "after": product_in.model_dump(exclude_unset=True, mode='json')
        },
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
    
    product_service.delete_product(db, product)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.PRODUCT,
        target_id=product_id,
        target_name=product.product_name,
        details={
            "reason": "상품 삭제 성공",
            "code": product.product_code
        },
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
    
    product = product_service.toggle_active(db, product)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.ACTIVATE if product.is_active else ActivityAction.DEACTIVATE,
        target_type=ActivityTargetType.PRODUCT,
        target_id=product_id,
        target_name=product.product_name,
        details={
            "reason": "상품 활성화/비활성화 성공",
            "is_active": product.is_active
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    message = "상품이 활성화되었습니다." if product.is_active else "상품이 비활성화되었습니다."
    return ResponseModel(message=message, data={"is_active": product.is_active})