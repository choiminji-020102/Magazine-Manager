# 표준 라이브러리
from typing import List, Optional, Tuple

# 서드파티 라이브러리
from sqlalchemy.orm import Session

# 로컬 애플리케이션
from app.crud import customer as customer_crud
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerListQuery, CustomerUpdate


def get_customers(db: Session, query: CustomerListQuery) -> Tuple[List[Customer], int]:
    return customer_crud.list_customers(
        db=db,
        page=query.page,
        limit=query.limit,
        create_channel=query.create_channel,
        is_active=query.is_active,
        is_deleted=query.is_deleted,
        phone_num4=query.phone_num4,
        search=query.search,
        admin_memo=query.admin_memo,
        sort_by=query.sort_by,
        sort_order=query.sort_order,
    )


def get_customer_by_id(db: Session, customer_id: int, include_deleted: bool = False) -> Customer:
    return customer_crud.read_customer_by_id(customer_id=customer_id, db=db, include_deleted=include_deleted)


def get_customer_by_phone(db: Session, phone: str) -> Optional[Customer]:
    return customer_crud.read_customer_by_phone(phone=phone, db=db)


def create_customer(db: Session, customer_in: CustomerCreate) -> Customer:
    return customer_crud.create_customer(customer_in=customer_in, db=db)


def update_customer(
    db: Session, customer_id: int, customer_in: CustomerUpdate
) -> Customer:
    return customer_crud.update_customer(
        customer_id=customer_id, customer_in=customer_in, db=db
    )


def activate(db: Session, customer_id: int) -> Customer:
    return customer_crud.update_customer_active(
        customer_id=customer_id, is_active=True, db=db
    )


def deactivate(db: Session, customer_id: int) -> Customer:
    return customer_crud.update_customer_active(
        customer_id=customer_id, is_active=False, db=db
    )


def delete_customer(db: Session, customer_id: int) -> None:
    customer_crud.delete_customer(customer_id=customer_id, db=db)


def restore_customer(db: Session, customer_id: int) -> Customer:
    return customer_crud.restore_customer(customer_id=customer_id, db=db)
