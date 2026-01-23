from sqlalchemy.orm import Session
from typing import Optional, List

from app.models.address import Address
from app.schemas.address import AddressCreate, AddressUpdate
from app.core.utils import format_phone_number


def get_address_by_id(db: Session, address_id: int) -> Optional[Address]:
    return db.query(Address).filter(Address.address_id == address_id).first()


def get_addresses_by_customer(db: Session, customer_id: int) -> List[Address]:
    """고객별 배송지 목록 조회"""
    return db.query(Address).filter(
        Address.customer_id == customer_id
    ).order_by(Address.created_at.desc()).all()


def find_address(
    db: Session,
    customer_id: Optional[int],
    address_name: str,
    phone: str,
    address: str
) -> Optional[Address]:
    """
    동일한 배송지가 이미 존재하는지 검색하는 함수
    - 중복 배송지 생성을 방지하기 위해 사용
    - [customer_id + 수령인 이름 + 연락처 + 주소]를 기준으로 동일 주소 판단
    - find_or_create_address 함수에서 호출되어 기존 주소 재사용 시 활용
    """
    formatted_phone, _ = format_phone_number(phone)
    
    query = db.query(Address).filter(
        Address.address_name == address_name,
        Address.phone == formatted_phone,
        Address.address == address
    )
    
    if customer_id is not None:
        query = query.filter(Address.customer_id == customer_id)
    else:
        query = query.filter(Address.customer_id.is_(None))
    
    return query.first()


def create_address(db: Session, address_in: AddressCreate) -> Address:
    data = address_in.model_dump()
    
    if data.get("phone"):
        formatted_phone, _ = format_phone_number(data["phone"])
        data["phone"] = formatted_phone
    
    address = Address(**data)
    db.add(address)
    db.commit()
    db.refresh(address)
    return address


def update_address(db: Session, address: Address, address_in: AddressUpdate) -> Address:
    update_data = address_in.model_dump(exclude_unset=True)
    
    # 변경사항이 없으면 그대로 반환
    if not update_data:
        return address
    
    try:
        # 변경사항 적용
        for field, value in update_data.items():
            setattr(address, field, value)
        
        db.commit()
        db.refresh(address)
        return address
    except Exception as e:
        db.rollback()
        raise e


def find_or_create_address(db: Session, address_in: AddressCreate) -> Address:
    """동일 주소 검색 또는 생성"""
    formatted_phone, _ = format_phone_number(address_in.phone)
    
    existing = find_address(
        db,
        address_in.customer_id,
        address_in.address_name,
        formatted_phone,
        address_in.address
    )
    
    if existing:
        return existing
    
    return create_address(db, address_in)
