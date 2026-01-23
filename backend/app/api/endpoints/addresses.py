from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.schemas.address import AddressCreate, AddressUpdate, AddressResponse
from app.schemas.common import ResponseModel
from app.services import address_service, customer_service, activity_log_service

router = APIRouter(prefix="/addresses", tags=["배송지"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])


@router.get("/customer/{customer_id}", response_model=ResponseModel[List[AddressResponse]])
def get_addresses_by_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """고객별 배송지 목록 조회"""
    _ = customer_service.get_customer_by_id(db, customer_id)
    addresses = address_service.get_addresses_by_customer(db, customer_id)
    
    return ResponseModel(
        message="고객별 배송지 목록을 조회했습니다.",
        data=[AddressResponse.model_validate(address) for address in addresses]
    )


@router.get("/{address_id}", response_model=ResponseModel[AddressResponse])
def get_address(
    address_id: int,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """배송지 상세 조회"""
    address = address_service.get_address_by_id(db, address_id)
    
    if address is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="배송지를 찾을 수 없습니다."
        )
    
    return ResponseModel(data=AddressResponse.model_validate(address))


@router.post("", response_model=ResponseModel[AddressResponse], status_code=status.HTTP_201_CREATED)
def create_address(
    address_in: AddressCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """배송지 등록 (동일 주소 있으면 기존 반환)"""
    if address_in.customer_id is not None:
        customer = customer_service.get_customer_by_id(db, address_in.customer_id)
        if customer is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="고객을 찾을 수 없습니다."
            )
    
    # 동일 주소 검색 또는 생성
    address = address_service.find_or_create_address(db, address_in)
    
    activity_log_service.create_log(
        db=db,
        action="CREATE",
        target_type="ADDRESS",
        target_id=address.address_id,
        target_name=address.address_name,
        details={
            "customer_id": address.customer_id,
            "phone": address.phone,
            "postal_code": address.postal_code
        },
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="배송지가 등록되었습니다.",
        data=AddressResponse.model_validate(address)
    )


@router.put("/{address_id}", response_model=ResponseModel[AddressResponse])
def update_address(
    address_id: int,
    address_in: AddressUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """배송지 수정 (address_memo만 수정 가능)"""
    address = address_service.get_address_by_id(db, address_id)
    
    if address is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="배송지를 찾을 수 없습니다."
        )
    
    old_data = {
        "address_memo": address.address_memo
    }
    
    address = address_service.update_address(db, address, address_in)
    
    activity_log_service.create_log(
        db=db,
        action="UPDATE",
        target_type="ADDRESS",
        target_id=address.address_id,
        target_name=address.address_name,
        details={"before": old_data, "after": address_in.model_dump(exclude_unset=True)},
        admin=current_admin,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )
    
    return ResponseModel(
        message="배송지 정보가 수정되었습니다.",
        data=AddressResponse.model_validate(address)
    )