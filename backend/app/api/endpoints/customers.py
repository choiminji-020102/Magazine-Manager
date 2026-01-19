from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.schemas.order import OrderResponse
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta
from app.services import customer_service, order_service, activity_log_service

router = APIRouter(prefix="/customers", tags=["고객"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("", response_model=PaginatedResponse[CustomerResponse])
def get_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    channel: Optional[str] = None,
    sort: str = "created_at",
    order: str = "DESC",
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 목록 조회"""
    items, total = customer_service.get_customers(db, page, limit, search, channel, sort, order)
    
    return PaginatedResponse(
        data=[CustomerResponse.model_validate(item) for item in items],
        pagination=PaginationMeta(
            total=total,
            page=page,
            limit=limit,
            total_pages=math.ceil(total / limit) if total > 0 else 0
        )
    )


@router.get("/search", response_model=ResponseModel[List[CustomerResponse]])
def search_customers(
    keyword: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 검색"""
    customers = customer_service.search_customers(db, keyword, limit)
    return ResponseModel(data=[CustomerResponse.model_validate(c) for c in customers])


@router.get("/{customer_id}", response_model=ResponseModel[CustomerResponse])
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 상세 조회"""
    customer = customer_service.get_customer_by_id(db, customer_id)
    
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다."
        )
    
    return ResponseModel(data=CustomerResponse.model_validate(customer))


@router.post("", response_model=ResponseModel[CustomerResponse], status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_in: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 등록"""
    if customer_service.get_customer_by_phone(db, customer_in.customer_phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 연락처입니다."
        )
    
    customer = customer_service.create_customer(db, customer_in)
    
    activity_log_service.create_log(
        db=db,
        action="CREATE",
        target_type="CUSTOMER",
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        details={"phone": customer.customer_phone, "channel": customer.create_channel},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="고객이 등록되었습니다.",
        data=CustomerResponse.model_validate(customer)
    )


@router.put("/{customer_id}", response_model=ResponseModel[CustomerResponse])
def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 수정"""
    customer = customer_service.get_customer_by_id(db, customer_id)
    
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다."
        )
    
    old_data = {
        "customer_name": customer.customer_name,
        "customer_phone": customer.customer_phone,
        "customer_email": customer.customer_email
    }
    
    # 전화번호 변경시 중복 체크 (본인 제외)
    if customer_in.customer_phone and customer_in.customer_phone != customer.customer_phone:
        existing = customer_service.get_customer_by_phone(db, customer_in.customer_phone)
        if existing and existing.customer_id != customer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 등록된 연락처입니다."
            )
    
    customer = customer_service.update_customer(db, customer, customer_in)
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE",
        target_type="CUSTOMER",
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        details={"before": old_data, "after": customer_in.model_dump(exclude_unset=True)},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="고객 정보가 수정되었습니다.",
        data=CustomerResponse.model_validate(customer)
    )


@router.delete("/{customer_id}", response_model=ResponseModel)
def delete_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 삭제"""
    customer = customer_service.get_customer_by_id(db, customer_id)
    
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다."
        )
    
    customer_name = customer.customer_name
    customer_phone = customer.customer_phone
    customer_service.delete_customer(db, customer)
    
    activity_log_service.create_log(
        db=db,
        action="DELETE",
        target_type="CUSTOMER",
        target_id=customer_id,
        target_name=customer_name,
        details={"phone": customer_phone},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(message="고객이 삭제되었습니다.")


@router.get("/{customer_id}/orders", response_model=ResponseModel[List[OrderResponse]])
def get_customer_orders(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객별 주문 이력 조회"""
    customer = customer_service.get_customer_by_id(db, customer_id)
    
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다."
        )
    
    orders = order_service.get_orders_by_customer(db, customer_id)
    
    return ResponseModel(data=[OrderResponse.model_validate(o) for o in orders])