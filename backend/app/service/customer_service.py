from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List, Tuple
from datetime import datetime

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.core.utils import format_phone_number, extract_phone_num4


def get_customer_by_id(db: Session, customer_id: int) -> Optional[Customer]:
    return db.query(Customer).filter(
        Customer.customer_id == customer_id,
        Customer.deleted_at == None
    ).first()


def get_customer_by_phone(db: Session, phone: str) -> Optional[Customer]:
    phone_num4 = extract_phone_num4(phone)
    customers = db.query(Customer).filter(
        Customer.customer_phone_num4 == phone_num4,
        Customer.deleted_at == None
    ).all()
    
    # 표준화된 번호로 정확한 매칭
    formatted, _ = format_phone_number(phone)
    for c in customers:
        if c.customer_phone == formatted or c.customer_phone == phone:
            return c
    
    return None


def get_customers(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    channel: Optional[str] = None,
    sort: str = "created_at",
    order: str = "DESC"
) -> Tuple[List[Customer], int]:
    query = db.query(Customer).filter(Customer.deleted_at == None)
    
    if search:
        query = query.filter(
            or_(
                Customer.customer_name.like(f"%{search}%"),
                Customer.customer_phone.like(f"%{search}%"),
                Customer.customer_email.like(f"%{search}%"),
                Customer.customer_phone_num4 == search
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
    return db.query(Customer).filter(
        Customer.deleted_at == None,
        or_(
            Customer.customer_name.like(f"%{keyword}%"),
            Customer.customer_phone.like(f"%{keyword}%"),
            Customer.customer_phone_num4 == keyword
        )
    ).limit(limit).all()


def create_customer(db: Session, customer_in: CustomerCreate) -> Customer:
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


def update_customer(db: Session, customer: Customer, customer_in: CustomerUpdate) -> Customer:
    update_data = customer_in.model_dump(exclude_unset=True)
    
    if "customer_phone" in update_data and update_data["customer_phone"]:
        formatted_phone, phone_num4 = format_phone_number(update_data["customer_phone"])
        update_data["customer_phone"] = formatted_phone
        update_data["customer_phone_num4"] = phone_num4
    
    for field, value in update_data.items():
        setattr(customer, field, value)
    
    db.commit()
    db.refresh(customer)
    return customer


def delete_customer(db: Session, customer: Customer) -> None:
    """소프트 삭제"""
    customer.deleted_at = datetime.now()
    db.commit()


def restore_customer(db: Session, customer_id: int) -> Optional[Customer]:
    """삭제된 고객 복원"""
    customer = db.query(Customer).filter(
        Customer.customer_id == customer_id,
        Customer.deleted_at != None
    ).first()
    
    if customer:
        customer.deleted_at = None
        db.commit()
        db.refresh(customer)
    
    return customer