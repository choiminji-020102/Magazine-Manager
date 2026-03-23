# 표준 라이브러리
from typing import List

# 서드파티 라이브러리
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.activity_log import ActivityAction, ActivityTargetType
from app.schemas.address import AddressCreate, AddressListQuery, AddressResponse, AddressUpdate
from app.schemas.common import PaginatedResponse, ResponseModel
from app.services import activity_log_service, address_service, customer_service

router = APIRouter(tags=["배송지"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])
require_manager = require_roles(["SUPER_ADMIN", "ADMIN", "MANAGER"])


# ── 조회 ──────────────────────────────────────────────────────────────────────

@router.get(
    "/addresses",
    response_model=PaginatedResponse[AddressResponse],
)
def list_addresses(
    query: AddressListQuery = Depends(AddressListQuery.as_query_params),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """배송지 목록 조회"""
    items, total = address_service.list_addresses(db, query)
    total_pages = (total + query.limit - 1) // query.limit

    return PaginatedResponse(
        total=total,
        page=query.page,
        limit=query.limit,
        total_pages=total_pages,
        items=[AddressResponse.model_validate(a) for a in items],
    )


@router.get(
    "/addresses/{address_id}",
    response_model=ResponseModel[AddressResponse],
)
def get_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """배송지 상세 조회"""
    address = address_service.get_address_by_id(db, address_id)

    return ResponseModel(
        message="배송지 정보를 조회했습니다.",
        data=AddressResponse.model_validate(address),
    )


@router.get(
    "/customers/{customer_id}/addresses",
    response_model=ResponseModel[List[AddressResponse]],
)
def get_addresses_by_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_manager),
):
    """고객별 배송지 목록 조회"""
    customer_service.get_customer_by_id(db, customer_id)  # 고객 존재 확인
    addresses = address_service.get_addresses_by_customer(db, customer_id)

    return ResponseModel(
        message="고객별 배송지 목록을 조회했습니다.",
        data=[AddressResponse.model_validate(a) for a in addresses],
    )


# ── 생성 ──────────────────────────────────────────────────────────────────────

@router.post(
    "/addresses",
    response_model=ResponseModel[AddressResponse],
    status_code=status.HTTP_201_CREATED,
)
def create_address(
    address_in: AddressCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """배송지 등록 (동일 주소 있으면 기존 반환)"""
    customer_service.get_customer_by_id(db, address_in.customer_id)  # 고객 존재 확인
    address, created = address_service.find_or_create_address(db, address_in)

    if created:
        activity_log_service.create_log(
            db=db,
            action=ActivityAction.CREATE,
            target_type=ActivityTargetType.ADDRESS,
            admin_id=current_admin.admin_id,
            admin_name=current_admin.admin_name,
            target_id=address.address_id,
            target_name=address.recipient_name,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            details={"customer_id": address.customer_id, "postal_code": address.postal_code},
        )

    message = "배송지가 등록되었습니다." if created else "이미 등록된 배송지입니다."
    return ResponseModel(
        message=message,
        data=AddressResponse.model_validate(address),
    )


# ── 수정 ──────────────────────────────────────────────────────────────────────

@router.put(
    "/addresses/{address_id}",
    response_model=ResponseModel[AddressResponse],
)
def update_address(
    address_id: int,
    address_in: AddressUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """배송지 수정 (admin_memo만 수정 가능)"""
    address = address_service.get_address_by_id(db, address_id)
    before_memo = address.admin_memo

    updated = address_service.update_address(db, address, address_in)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.UPDATE,
        target_type=ActivityTargetType.ADDRESS,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=address_id,
        target_name=updated.recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details={"before": {"admin_memo": before_memo}, "after": {"admin_memo": updated.admin_memo}},
    )

    return ResponseModel(
        message="배송지 정보가 수정되었습니다.",
        data=AddressResponse.model_validate(updated),
    )


# ── 삭제 ──────────────────────────────────────────────────────────────────────

@router.delete(
    "/addresses/{address_id}",
    response_model=ResponseModel,
)
def delete_address(
    address_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin),
):
    """배송지 삭제 (주문/품목에 연결된 경우 불가)"""
    address = address_service.get_address_by_id(db, address_id)
    recipient_name = address.recipient_name

    address_service.delete_address(db, address)

    activity_log_service.create_log(
        db=db,
        action=ActivityAction.DELETE,
        target_type=ActivityTargetType.ADDRESS,
        admin_id=current_admin.admin_id,
        admin_name=current_admin.admin_name,
        target_id=address_id,
        target_name=recipient_name,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    return ResponseModel(message="배송지가 삭제되었습니다.")
