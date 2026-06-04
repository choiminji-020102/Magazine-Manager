# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import format_phone_number
from app.crud import address as address_crud
from app.models.address import Address
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.send import Send
from app.schemas.address import AddressCreate, AddressListQuery, AddressUpdate


def get_address_by_id(db: Session, address_id: int) -> Address:
    return address_crud.read_address_by_id(db=db, address_id=address_id)


def get_addresses_by_customer(db: Session, customer_id: int) -> List[Address]:
    return address_crud.read_addresses_by_customer(db=db, customer_id=customer_id)


def list_addresses(db: Session, query: AddressListQuery) -> Tuple[List[Address], int]:
    return address_crud.list_addresses(
        db=db,
        page=query.page,
        limit=query.limit,
        customer_id=query.customer_id,
        postal_code=query.postal_code,
        country_code=query.country_code,
        vip_slot_number=query.vip_slot_number,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


def find_or_create_address(db: Session, address_in: AddressCreate) -> tuple[Address, bool]:
    """동일 주소 검색 또는 생성 (전화번호 포매팅 포함)
    Returns: (address, created) — created=True이면 신규 생성, False이면 기존 주소 반환
    """
    formatted_phone, _ = format_phone_number(address_in.recipient_phone)

    existing = address_crud.find_duplicate_address(
        db=db,
        customer_id=address_in.customer_id,
        recipient_name=address_in.recipient_name,
        recipient_phone=formatted_phone,
        recipient_address=address_in.recipient_address,
    )
    if existing:
        return existing, False

    # 전화번호 포매팅 후 생성
    normalized = address_in.model_copy(update={"recipient_phone": formatted_phone})
    address = address_crud.create_address(db=db, address_in=normalized)
    db.commit()
    db.refresh(address)
    return address, True


def create_address(db: Session, address_in: AddressCreate) -> Address:
    formatted_phone, _ = format_phone_number(address_in.recipient_phone)
    normalized = address_in.model_copy(update={"recipient_phone": formatted_phone})
    address = address_crud.create_address(db=db, address_in=normalized)
    db.commit()
    db.refresh(address)
    return address


def update_address(db: Session, address: Address, address_in: AddressUpdate) -> Address:
    """배송지 수정.

    VIP 단일성 제약: 한 Address에 vip1~vip6 중 최대 1개만 true.
    payload(exclude_unset)와 기존 DB 값을 합친 결과로 검증 (모든 슬롯 대상).
    """
    payload_dict = address_in.model_dump(exclude_unset=True)
    new_vip = {f"vip{n}": getattr(address, f"vip{n}") for n in range(1, 7)}
    for n in range(1, 7):
        field = f"vip{n}"
        if field in payload_dict:
            new_vip[field] = payload_dict[field]
    active_slots = [k for k, v in new_vip.items() if v is True]
    if len(active_slots) > 1:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"VIP 슬롯은 한 배송지당 최대 1개만 활성화 가능합니다. 시도된 활성 슬롯: {active_slots}",
        )

    return address_crud.update_address(db=db, address=address, address_in=address_in)


def delete_address(db: Session, address: Address) -> None:
    """배송지 삭제 (주문/품목/발송에 연결된 경우 불가)"""
    # 주문에 연결된 경우 차단
    if db.query(Order).filter(Order.address_id == address.address_id).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="주문에 연결된 배송지는 삭제할 수 없습니다.",
        )

    # 주문 품목에 연결된 경우 차단
    if db.query(OrderItem).filter(OrderItem.address_id == address.address_id).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="주문 품목에 연결된 배송지는 삭제할 수 없습니다.",
        )

    # 발송에 연결된 경우 차단
    if db.query(Send).filter(Send.address_id == address.address_id).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="발송에 연결된 배송지는 삭제할 수 없습니다.",
        )

    address_crud.delete_address(db=db, address=address)
