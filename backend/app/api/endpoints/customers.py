from fastapi import APIRouter, Depends, status, Request
from sqlalchemy.orm import Session
from typing import Optional, List
import math

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.customer import (
    CustomerListQuery,
    CustomerCreate,
    CustomerUpdate,
    CustomerResponse,
)
from app.schemas.order import OrderResponse
from app.schemas.common import ResponseModel, PaginatedResponse, PaginationMeta, ResponseBase
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.services import customer_service, activity_log_service

router = APIRouter(prefix="/customers", tags=["고객"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])

@router.get("", response_model=PaginatedResponse[CustomerResponse])
def get_customers(
    query: CustomerListQuery = Depends(CustomerListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 목록 조회"""
    customers, total = customer_service.get_customers(
        db, query.page, query.limit, query.search, query.channel, query.sort, query.order
    )
    
    return PaginatedResponse(
        message="고객 목록을 조회했습니다.",
        data=[CustomerResponse.model_validate(customer) for customer in customers],
        pagination=PaginationMeta(
            total=total,
            page=query.page,
            limit=query.limit,
            total_pages=math.ceil(total / query.limit) if total > 0 else 0
        )
    )


@router.get("/{customer_id}", response_model=ResponseModel[CustomerResponse])
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 상세 조회"""
    customer = customer_service.get_customer_by_id(db, customer_id)
    return ResponseModel(
        message="고객 정보를 조회했습니다.",
        data=CustomerResponse.model_validate(customer)
    )


@router.post("", response_model=ResponseModel[CustomerResponse], status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_in: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 등록"""
    customer = customer_service.create_customer(db, customer_in)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.CUSTOMER,
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        details={"reason": "고객 등록 성공", "phone": customer.customer_phone},
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
    # 수정 전 데이터 저장 (activity log용)
    old_customer = customer_service.get_customer_by_id(db, customer_id)
    old_data = {
        "customer_name": old_customer.customer_name,
        "customer_phone": old_customer.customer_phone,
        "customer_email": old_customer.customer_email
    }
    
    customer = customer_service.update_customer(db, customer_id, customer_in)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.CUSTOMER,
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        details={"reason": "고객 수정 성공", "before": old_data, "after": customer_in.model_dump(exclude_unset=True)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="고객 정보가 수정되었습니다.",
        data=CustomerResponse.model_validate(customer)
    )


@router.delete("/{customer_id}", response_model=ResponseBase)
def delete_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객 삭제"""
    # 삭제 전 데이터 저장 (activity log용)
    customer = customer_service.get_customer_by_id(db, customer_id)
    
    customer_service.delete_customer(db, customer_id)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.CUSTOMER,
        target_id=customer_id,
        target_name=customer.customer_name,
        details={"reason": "고객 삭제 성공", "phone": customer.customer_phone},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseBase(message="고객이 삭제되었습니다.")


@router.patch("/{customer_id}/restore", response_model=ResponseModel[CustomerResponse])
def restore_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """삭제된 고객 복원"""
    customer = customer_service.restore_customer(db, customer_id)
    
    activity_log_service.create_log(
        db=db,
        admin=current_admin,
        action=ActivityAction.RESTORE,
        target_type=ActivityTargetType.CUSTOMER,
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        details={"reason": "고객 복원 성공", "phone": customer.customer_phone},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="고객이 복원되었습니다.",
        data=CustomerResponse.model_validate(customer)
    )