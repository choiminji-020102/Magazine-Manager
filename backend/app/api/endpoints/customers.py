# 표준 라이브러리
import math
from typing import List, Optional

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.deps import require_admin
from app.db.session import get_db
from app.models import admin as admin_model
from app.models.activity_log import ActivityAction, ActivityTargetType
from app.schemas.customer import (
    CustomerCreate,
    CustomerDetailResponse,
    CustomerListQuery,
    CustomerResponse,
    CustomerUpdate,
)
from app.schemas.common import PaginatedResponse, ResponseModel
from app.schemas.order import OrderResponse as OrderResp
from app.services import activity_log_service, customer_service

router = APIRouter(prefix="/customers", tags=["고객"])


@router.get("", response_model=PaginatedResponse[CustomerResponse])
def get_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    create_channel: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_deleted: bool = False,
    phone_num4: Optional[str] = Query(None, max_length=4),
    search: Optional[str] = None,
    admin_memo: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 목록 조회"""
    query = CustomerListQuery(
        page=page, limit=limit,
        create_channel=create_channel, is_active=is_active, is_deleted=is_deleted,
        phone_num4=phone_num4, search=search, admin_memo=admin_memo,
        sort_by=sort_by, sort_order=sort_order,
    )
    items, total = customer_service.get_customers(db=db, query=query)
    return PaginatedResponse(
        total=total,
        page=page,
        limit=limit,
        total_pages=math.ceil(total / limit) if total > 0 else 0,
        items=items,
    )


@router.get("/{customer_id}", response_model=ResponseModel[CustomerDetailResponse])
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 상세 조회 (주문·배송지 포함, 삭제된 고객도 조회 가능)"""
    customer = customer_service.get_customer_by_id(db=db, customer_id=customer_id, include_deleted=True)
    data = CustomerDetailResponse.model_validate(customer)
    # ORM relationship 이름(orders)과 스키마 필드명(recent_orders) 불일치 → 명시적 매핑 (최근 5건, 주문일 DESC)
    sorted_orders = sorted(customer.orders, key=lambda o: o.order_at, reverse=True)[:5]
    data.recent_orders = [OrderResp.model_validate(o) for o in sorted_orders]
    return ResponseModel(data=data)


@router.post("", response_model=ResponseModel[CustomerResponse], status_code=status.HTTP_201_CREATED)
def create_customer(
    customer_in: CustomerCreate,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 등록"""
    customer = customer_service.create_customer(db=db, customer_in=customer_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.CREATE,
        target_type=ActivityTargetType.CUSTOMER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        details={"customer_phone": customer.customer_phone},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="고객이 등록되었습니다.", data=customer)


@router.put("/{customer_id}", response_model=ResponseModel[CustomerDetailResponse])
def update_customer(
    customer_id: int,
    customer_in: CustomerUpdate,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 수정"""
    existing = customer_service.get_customer_by_id(db=db, customer_id=customer_id)
    old_data = {
        "customer_name": existing.customer_name,
        "customer_phone": existing.customer_phone,
        "customer_email": existing.customer_email,
    }

    customer_service.update_customer(
        db=db, customer_id=customer_id, customer_in=customer_in
    )
    # 수정 후 전체 정보(주문·배송지 포함) 재조회
    customer = customer_service.get_customer_by_id(db=db, customer_id=customer_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.CUSTOMER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=customer_id,
        target_name=customer.customer_name,
        details={"before": old_data, "after": customer_in.model_dump(exclude_unset=True)},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="고객 정보가 수정되었습니다.", data=customer)


@router.patch("/{customer_id}/activate", response_model=ResponseModel[CustomerResponse])
def activate_customer(
    customer_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 활성화"""
    customer = customer_service.activate(db=db, customer_id=customer_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.ACTIVATE,
        target_type=ActivityTargetType.CUSTOMER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="고객이 활성화되었습니다.", data=customer)


@router.patch("/{customer_id}/deactivate", response_model=ResponseModel[CustomerResponse])
def deactivate_customer(
    customer_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 비활성화"""
    customer = customer_service.deactivate(db=db, customer_id=customer_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DEACTIVATE,
        target_type=ActivityTargetType.CUSTOMER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="고객이 비활성화되었습니다.", data=customer)


@router.delete("/{customer_id}", response_model=ResponseModel, status_code=status.HTTP_200_OK)
def delete_customer(
    customer_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 삭제 (소프트 삭제)"""
    customer = customer_service.get_customer_by_id(db=db, customer_id=customer_id)
    customer_service.delete_customer(db=db, customer_id=customer_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.CUSTOMER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=customer_id,
        target_name=customer.customer_name,
        details={"customer_phone": customer.customer_phone},
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="고객이 삭제되었습니다.")


@router.post("/{customer_id}/restore", response_model=ResponseModel[CustomerResponse])
def restore_customer(
    customer_id: int,
    req: Request,
    db: Session = Depends(get_db),
    current_admin: admin_model.Admin = Depends(require_admin),
):
    """고객 복구"""
    customer = customer_service.restore_customer(db=db, customer_id=customer_id)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.RESTORE,
        target_type=ActivityTargetType.CUSTOMER,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=customer.customer_id,
        target_name=customer.customer_name,
        ip_address=req.client.host if req.client else None,
        user_agent=req.headers.get("user-agent"),
    )
    return ResponseModel(message="고객이 복구되었습니다.", data=customer)
