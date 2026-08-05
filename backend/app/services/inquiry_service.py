from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional, List, Tuple
from app.core.utils import now_kst
from app.models.inquiry import Inquiry
from app.models.customer import Customer
from app.models.admin import Admin
from app.models.order import Order
from app.schemas.inquiry import InquiryCreate, InquiryUpdate


def get_inquiry_by_id(db: Session, inquiry_id: int) -> Optional[Inquiry]:
    return db.query(Inquiry).filter(Inquiry.inquiry_id == inquiry_id).first()


def get_inquiries(
    db: Session,
    page: int = 1,
    limit: int = 20,
    customer_id: Optional[int] = None,
    inquiry_type: Optional[str] = None,
    inquiry_status: Optional[str] = None,
    search: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Tuple[List[dict], int]:
    query = db.query(
        Inquiry,
        Customer.customer_name,
        Customer.customer_phone,
        Admin.admin_name.label("handler_name")
    ).join(
        Customer, Inquiry.customer_id == Customer.customer_id
    ).outerjoin(
        Admin, Inquiry.handled_by == Admin.admin_id
    )
    
    if customer_id:
        query = query.filter(Inquiry.customer_id == customer_id)
    if inquiry_type:
        query = query.filter(Inquiry.inquiry_type == inquiry_type)
    if inquiry_status:
        query = query.filter(Inquiry.inquiry_status == inquiry_status)
    if search:
        query = query.filter(
            or_(
                Customer.customer_name.like(f"%{search}%"),
                Customer.customer_phone.like(f"%{search}%"),
                Inquiry.title.like(f"%{search}%"),
                Inquiry.content.like(f"%{search}%")
            )
        )
    if start_date:
        query = query.filter(Inquiry.created_at >= start_date)
    if end_date:
        query = query.filter(Inquiry.created_at <= end_date + " 23:59:59")
    
    total = query.count()
    
    offset = (page - 1) * limit
    # PK 2차 정렬키 — created_at 이 같은 행이 많으면 페이징 순서가 비결정적이라 중복·누락 발생
    results = (
        query.order_by(Inquiry.created_at.desc(), Inquiry.inquiry_id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    items = []
    for inquiry, customer_name, customer_phone, handler_name in results:
        items.append({
            "inquiry_id": inquiry.inquiry_id,
            "customer_id": inquiry.customer_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "inquiry_type": inquiry.inquiry_type,
            "inquiry_category": inquiry.inquiry_category,
            "title": inquiry.title,
            "inquiry_status": inquiry.inquiry_status,
            "handled_by": inquiry.handled_by,
            "handler_name": handler_name,
            "created_at": inquiry.created_at
        })
    
    return items, total


def get_inquiries_by_customer(db: Session, customer_id: int, limit: int = 10) -> List[Inquiry]:
    # PK 2차 정렬키 — created_at 이 같은 행이 경계에 걸리면 상위 N 건이 조회마다 달라짐
    return db.query(Inquiry).filter(
        Inquiry.customer_id == customer_id
    ).order_by(Inquiry.created_at.desc(), Inquiry.inquiry_id.desc()).limit(limit).all()


def create_inquiry(db: Session, inquiry_in: InquiryCreate) -> Inquiry:
    inquiry = Inquiry(**inquiry_in.model_dump())
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)
    return inquiry


def update_inquiry(
    db: Session,
    inquiry: Inquiry,
    inquiry_in: InquiryUpdate,
    admin_id: Optional[int] = None,
) -> Inquiry:
    update_data = inquiry_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(inquiry, field, value)

    # 상태 전이에 따른 처리 이력 동기화
    # 완료 처리 → 담당자/처리일시 기록, 접수로 되돌리기(재오픈·취소해제) → 초기화
    if "inquiry_status" in update_data:
        new_status = update_data["inquiry_status"]
        if new_status == "COMPLETED":
            inquiry.handled_by = admin_id
            inquiry.handled_at = now_kst()
        elif new_status == "RECEIVED":
            inquiry.handled_by = None
            inquiry.handled_at = None

    db.commit()
    db.refresh(inquiry)
    return inquiry


def answer_inquiry(
    db: Session,
    inquiry: Inquiry,
    answer: str,
    status: str,
    admin_id: int
) -> Inquiry:
    inquiry.answer = answer
    inquiry.inquiry_status = status
    inquiry.handled_by = admin_id
    if status == "COMPLETED":
        inquiry.handled_at = now_kst()
    db.commit()
    db.refresh(inquiry)
    return inquiry


def delete_inquiry(db: Session, inquiry: Inquiry) -> None:
    db.delete(inquiry)
    db.commit()


# 전화번호 뒤4자리로 고객 검색
def search_customers_by_phone4(db: Session, phone_num4: str) -> List[Customer]:
    return db.query(Customer).filter(
        Customer.customer_phone_num4 == phone_num4,
        Customer.deleted_at == None
    ).order_by(Customer.created_at.desc()).all()


# 고객 문의 이력 조회 (주문 + 문의)
def get_customer_inquiry_history(db: Session, customer_id: int) -> dict:
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if not customer:
        return None
    
    # 주문 수
    orders_count = db.query(Order).filter(Order.customer_id == customer_id).count()
    
    # 문의 수
    inquiries_count = db.query(Inquiry).filter(Inquiry.customer_id == customer_id).count()
    
    # 최근 주문 5건 — PK 2차 정렬키로 5·6위 동점 시에도 결과가 흔들리지 않게 고정
    recent_orders = db.query(Order).filter(
        Order.customer_id == customer_id
    ).order_by(Order.order_at.desc(), Order.order_id.desc()).limit(5).all()

    # 최근 문의 5건 — 위와 동일
    recent_inquiries = db.query(Inquiry).filter(
        Inquiry.customer_id == customer_id
    ).order_by(Inquiry.created_at.desc(), Inquiry.inquiry_id.desc()).limit(5).all()
    
    return {
        "customer": customer,
        "orders_count": orders_count,
        "inquiries_count": inquiries_count,
        "recent_orders": [{
            "order_id": o.order_id,
            "order_channel": o.order_channel,
            "order_status": o.order_status,
            "total_amount": o.total_amount,
            "payment_amount": o.payment_amount,
            "order_at": o.order_at.isoformat() if o.order_at else None
        } for o in recent_orders],
        "recent_inquiries": recent_inquiries
    }