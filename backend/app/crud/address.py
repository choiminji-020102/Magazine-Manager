# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.models.address import Address
from app.schemas.address import AddressCreate, AddressUpdate


def read_address_by_id(db: Session, address_id: int) -> Address:
    address = db.query(Address).filter(Address.address_id == address_id).first()
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="배송지를 찾을 수 없습니다.",
        )
    return address


def read_addresses_by_customer(db: Session, customer_id: int) -> List[Address]:
    return (
        db.query(Address)
        .filter(Address.customer_id == customer_id)
        .order_by(Address.created_at.desc())
        .all()
    )


def list_addresses(
    db: Session,
    page: int = 1,
    limit: int = 20,
    customer_id: Optional[int] = None,
    postal_code: Optional[str] = None,
    country_code: Optional[str] = None,
    vip_slot_number: Optional[int] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[Address], int]:
    query = db.query(Address)

    if customer_id is not None:
        query = query.filter(Address.customer_id == customer_id)
    if postal_code:
        query = query.filter(Address.postal_code == postal_code)
    if country_code:
        query = query.filter(Address.country_code == country_code)
    if vip_slot_number is not None:
        vip_col = getattr(Address, f"vip{vip_slot_number}")
        query = query.filter(vip_col.is_(True))

    allowed_sort = {"created_at", "updated_at", "recipient_name", "postal_code"}
    sort_col = getattr(Address, sort_by if sort_by in allowed_sort else "created_at")
    # PK 2차 정렬키 — 정렬값이 같은 행이 많으면 페이징 순서가 비결정적이라 중복·누락 발생
    is_asc = sort_order == "asc"
    query = query.order_by(
        sort_col.asc() if is_asc else sort_col.desc(),
        Address.address_id.asc() if is_asc else Address.address_id.desc(),
    )

    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


def find_duplicate_address(
    db: Session,
    customer_id: int,
    recipient_name: str,
    recipient_phone: str,
    recipient_address: str,
) -> Optional[Address]:
    """동일 주소 검색 (customer_id + 수령인 + 연락처 + 주소)"""
    return (
        db.query(Address)
        .filter(
            Address.customer_id == customer_id,
            Address.recipient_name == recipient_name,
            Address.recipient_phone == recipient_phone,
            Address.recipient_address == recipient_address,
        )
        .first()
    )


def create_address(db: Session, address_in: AddressCreate) -> Address:
    address = Address(**address_in.model_dump())
    db.add(address)
    db.flush()
    return address


def update_address(db: Session, address: Address, address_in: AddressUpdate) -> Address:
    for field, value in address_in.model_dump(exclude_unset=True).items():
        setattr(address, field, value)
    db.commit()
    db.refresh(address)
    return address


def delete_address(db: Session, address: Address) -> None:
    db.delete(address)
    db.commit()
