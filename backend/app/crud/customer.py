# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.core.utils import format_phone_number, now_kst
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


def list_customers(
    db: Session,
    page: int = 1,
    limit: int = 20,
    create_channel: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_deleted: bool = False,
    phone_num4: Optional[str] = None,
    search: Optional[str] = None,
    admin_memo: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> Tuple[List[Customer], int]:
    query = db.query(Customer).filter(Customer.is_deleted == is_deleted)

    if create_channel:
        query = query.filter(Customer.create_channel == create_channel)
    if is_active is not None:
        query = query.filter(Customer.is_active == is_active)
    if phone_num4:
        query = query.filter(Customer.customer_phone_num4 == phone_num4)
    if search:
        query = query.filter(
            or_(
                Customer.customer_name.like(f"%{search}%"),
                Customer.customer_email.like(f"%{search}%"),
            )
        )
    if admin_memo:
        query = query.filter(Customer.admin_memo.like(f"%{admin_memo}%"))

    sort_col = getattr(Customer, sort_by, Customer.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    total = query.count()
    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()
    return items, total


def read_customer_by_id(customer_id: int, db: Session, include_deleted: bool = False) -> Customer:
    query = db.query(Customer).filter(Customer.customer_id == customer_id)
    if not include_deleted:
        query = query.filter(Customer.is_deleted == False)
    customer = query.first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {customer_id}에 해당하는 고객을 찾을 수 없습니다.",
        )
    return customer


def read_customer_by_phone(phone: str, db: Session) -> Optional[Customer]:
    formatted_phone, _ = format_phone_number(phone)
    return db.query(Customer).filter(
        Customer.customer_phone == formatted_phone,
        Customer.is_deleted == False,
    ).first()


def check_phone_duplicate(
    phone: str, db: Session, exclude_customer_id: Optional[int] = None
) -> None:
    formatted_phone, _ = format_phone_number(phone)
    query = db.query(Customer).filter(
        Customer.customer_phone == formatted_phone,
        Customer.is_deleted == False,
    )
    if exclude_customer_id is not None:
        query = query.filter(Customer.customer_id != exclude_customer_id)
    if query.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 연락처입니다.",
        )


def create_customer(customer_in: CustomerCreate, db: Session) -> Customer:
    check_phone_duplicate(phone=customer_in.customer_phone, db=db)

    formatted_phone, phone_num4 = format_phone_number(customer_in.customer_phone)
    new_customer = Customer(
        customer_phone=formatted_phone,
        customer_phone_num4=phone_num4,
        customer_name=customer_in.customer_name,
        create_channel=customer_in.create_channel,
        customer_email=customer_in.customer_email,
        admin_memo=customer_in.admin_memo,
        is_active=True,
    )
    db.add(new_customer)
    db.commit()
    db.refresh(new_customer)
    return new_customer


def update_customer(
    customer_id: int, customer_in: CustomerUpdate, db: Session
) -> Customer:
    customer = read_customer_by_id(customer_id=customer_id, db=db)
    update_data = customer_in.model_dump(exclude_unset=True)

    if "customer_phone" in update_data and update_data["customer_phone"]:
        check_phone_duplicate(
            phone=update_data["customer_phone"],
            db=db,
            exclude_customer_id=customer_id,
        )
        formatted_phone, phone_num4 = format_phone_number(update_data["customer_phone"])
        update_data["customer_phone"] = formatted_phone
        update_data["customer_phone_num4"] = phone_num4

    for field, value in update_data.items():
        setattr(customer, field, value)

    db.commit()
    db.refresh(customer)
    return customer


def update_customer_active(
    customer_id: int, is_active: bool, db: Session
) -> Customer:
    customer = read_customer_by_id(customer_id=customer_id, db=db)
    customer.is_active = is_active
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(customer_id: int, db: Session) -> None:
    customer = read_customer_by_id(customer_id=customer_id, db=db)
    customer.is_deleted = True
    customer.is_active = False
    customer.deleted_at = now_kst()
    db.commit()


def restore_customer(customer_id: int, db: Session) -> Customer:
    customer = db.query(Customer).filter(
        Customer.customer_id == customer_id,
        Customer.is_deleted == True,
    ).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ID {customer_id}에 해당하는 삭제된 고객을 찾을 수 없습니다.",
        )
    customer.is_deleted = False
    customer.deleted_at = None
    customer.is_active = True
    db.commit()
    db.refresh(customer)
    return customer
