from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List, Tuple
from datetime import datetime
from fastapi import HTTPException, status

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.core.utils import format_phone_number, extract_phone_num4


def get_customer_by_id(
    db: Session,
    customer_id: int
) -> Optional[Customer]:
    customer = db.query(Customer).filter(
        Customer.customer_id == customer_id,
        Customer.deleted_at.is_(None)
    ).first()
    if customer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="고객을 찾을 수 없습니다."
        )
    return customer


def get_customer_by_phone(
    db: Session,
    phone: str
) -> Optional[Customer]:
    phone_num4 = extract_phone_num4(phone)
    customers = db.query(Customer).filter(
        Customer.customer_phone_num4 == phone_num4,
        Customer.deleted_at.is_(None)
    ).all()

    formatted, _ = format_phone_number(phone)
    for customer in customers:
        if customer.customer_phone == formatted or customer.customer_phone == phone:
            return customer

    return None


def get_customers(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    channel: Optional[str] = None,
    sort: str = "created_at",
    order: str = "DESC",
    deleted_only: bool = False
) -> Tuple[List[Customer], int]:
    query = db.query(Customer)
    
    # 삭제 상태 필터링
    if deleted_only:
        # 삭제된 고객만 조회
        query = query.filter(Customer.deleted_at.isnot(None))
    else:
        # 기본값: 삭제되지 않은 고객만 조회 (기존 동작 유지)
        query = query.filter(Customer.deleted_at.is_(None))

    if search:
        # 검색어가 숫자만 포함하면 전화번호로 간주
        search_digits = ''.join(filter(str.isdigit, search))
        
        if len(search_digits) >= 4:
            # 전화번호 검색: 표준화된 형식으로 변환하여 검색
            formatted_phone, phone_num4 = format_phone_number(search)
            query = query.filter(
                or_(
                    Customer.customer_name.like(f"%{search}%"),
                    Customer.customer_phone == formatted_phone,
                    Customer.customer_phone.like(f"%{search}%"),
                    Customer.customer_phone_num4 == phone_num4
                )
            )
        else:
            query = query.filter(
                or_(
                    Customer.customer_name.like(f"%{search}%"),
                    Customer.customer_phone.like(f"%{search}%"),
                    Customer.customer_email.like(f"%{search}%")
                )
            )
    
    if channel:
        query = query.filter(Customer.create_channel == channel)
    
    total = query.count()
    
    sort_column = getattr(Customer, sort, Customer.created_at)
    if order.upper() == "DESC":
        sort_column = sort_column.desc()
    
    offset = (page - 1) * limit
    items = query.order_by(sort_column).offset(offset).limit(limit).all()
    
    return items, total



def search_customers(db: Session, keyword: str, limit: int = 20) -> List[Customer]:
    # 검색어가 숫자만 포함하면 전화번호로 간주
    search_digits = ''.join(filter(str.isdigit, keyword))
    
    if len(search_digits) >= 4:
        formatted_phone, phone_num4 = format_phone_number(keyword)
        return db.query(Customer).filter(
            Customer.deleted_at == None,
            or_(
                Customer.customer_name.like(f"%{keyword}%"),
                Customer.customer_phone == formatted_phone,
                Customer.customer_phone_num4 == phone_num4
            )
        ).limit(limit).all()
    
    return db.query(Customer).filter(
        Customer.deleted_at.is_(None),
        or_(
            Customer.customer_name.like(f"%{keyword}%"),
            Customer.customer_phone.like(f"%{keyword}%")
        )
    ).limit(limit).all()


def create_customer(
    db: Session,
    customer_in: CustomerCreate
) -> Customer:
    # 전화번호 중복 체크
    if get_customer_by_phone(db, customer_in.customer_phone):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 연락처입니다."
        )

    data = customer_in.model_dump()

    if data.get("customer_phone"):
        formatted_phone, phone_num4 = format_phone_number(data["customer_phone"])
        data["customer_phone"] = formatted_phone
        data["customer_phone_num4"] = phone_num4

    customer = Customer(**data)
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(
    db: Session,
    customer_id: int,
    customer_in: CustomerUpdate
) -> Customer:
    """고객 수정 (고객 존재 여부 및 전화번호 중복 체크 포함)"""
    customer = get_customer_by_id(db, customer_id)

    update_data = customer_in.model_dump(exclude_unset=True)  # 변경된 필드만 추출

    # 전화번호 변경시 중복 체크 (본인 제외)
    if "customer_phone" in update_data and update_data["customer_phone"]:
        if update_data["customer_phone"] != customer.customer_phone:
            existing = get_customer_by_phone(db, update_data["customer_phone"])
            if existing and existing.customer_id != customer_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="이미 등록된 연락처입니다."
                )

        formatted_phone, phone_num4 = format_phone_number(update_data["customer_phone"])
        update_data["customer_phone"] = formatted_phone
        update_data["customer_phone_num4"] = phone_num4

    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(
    db: Session,
    customer_id: int
) -> None:
    """고객 삭제 (소프트 삭제, 고객 존재 여부 체크 포함)"""
    customer = get_customer_by_id(db, customer_id)
    customer.deleted_at = datetime.now()
    db.commit()


def restore_customer(
    db: Session,
    customer_id: int
) -> Customer:
    """삭제된 고객 복원 (고객 존재 여부 및 삭제 여부 체크 포함)"""
    # 삭제된 고객만 조회
    customer = db.query(Customer).filter(
        Customer.customer_id == customer_id,
        Customer.deleted_at.isnot(None)
    ).first()

    if customer is None:
        # 고객이 없거나 이미 복원된 경우
        # 활성화된 고객인지 확인
        try:
            get_customer_by_id(db, customer_id)
            # 활성화된 고객이 존재하는 경우
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 활성화된 고객입니다."
            )
        except HTTPException:
            # get_customer_by_id가 404를 발생시킨 경우 (고객이 존재하지 않음)
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="고객을 찾을 수 없습니다."
            )

    customer.deleted_at = None
    db.commit()
    db.refresh(customer)
    return customer