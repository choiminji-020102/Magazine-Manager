# 표준 라이브러리
from typing import List, Tuple, Optional
from datetime import datetime

# 서드파티 라이브러리
from sqlalchemy.orm import Session
from sqlalchemy import or_

# 로컬 애플리케이션
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.customer import Customer
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderUpdate
from app.schemas.customer import CustomerCreate
from app.schemas.address import AddressCreate
from app.crud import order as order_crud
from app.services import customer_service, address_service
from app.core.utils import format_phone_number, calculate_subscribe_end_issue


def get_order_by_id(db: Session, order_id: int) -> Order:
    """주문 ID로 주문 조회"""
    return order_crud.read_order_by_id(order_id=order_id, db=db)


def get_active_order_by_id(db: Session, order_id: int) -> Order:
    """활성 주문 ID로 주문 조회 (취소되지 않은 주문)"""
    return order_crud.read_active_order_by_id(order_id=order_id, db=db)


def get_order_by_external_id(db: Session, external_order_id: str) -> Order:
    """외부 주문 ID로 주문 조회"""
    return order_crud.read_order_by_external_id(external_order_id=external_order_id, db=db)


def get_orders(
    db: Session,
    page: int = 1,
    limit: int = 20,
    search: Optional[str] = None,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Tuple[List[dict], int]:
    """주문 목록 조회 (검색, 필터링, 페이지네이션 지원)"""
    query = db.query(
        Order,
        Customer.customer_name,
        Customer.customer_phone
    ).join(Customer, Order.customer_id == Customer.customer_id)
    
    # 검색 조건 적용
    if search:
        search_digits = ''.join(filter(str.isdigit, search))
        
        if len(search_digits) >= 4:
            # 전화번호 형식화하여 검색
            formatted_phone, phone_num4 = format_phone_number(search)
            query = query.filter(
                or_(
                    Customer.customer_name.like(f"%{search}%"),
                    Customer.customer_phone == formatted_phone,
                    Customer.customer_phone.like(f"%{search}%"),
                    Customer.customer_phone_num4 == phone_num4,
                    Order.external_order_id.like(f"%{search}%")
                )
            )
        else:
            query = query.filter(
                or_(
                    Customer.customer_name.like(f"%{search}%"),
                    Customer.customer_phone.like(f"%{search}%"),
                    Order.external_order_id.like(f"%{search}%")
                )
            )
    
    # 필터 조건 적용
    if channel:
        query = query.filter(Order.order_channel == channel)
    
    if status:
        query = query.filter(Order.order_status == status)
    
    if start_date:
        query = query.filter(Order.order_at >= start_date)
    
    if end_date:
        query = query.filter(Order.order_at <= f"{end_date} 23:59:59")
    
    total = query.count()
    
    # 페이지네이션
    offset = (page - 1) * limit
    results = query.order_by(Order.order_at.desc()).offset(offset).limit(limit).all()
    
    # 결과 변환
    items = []
    for order, customer_name, customer_phone in results:
        item_count = db.query(OrderItem).filter(
            OrderItem.order_id == order.order_id,
            OrderItem.cancelled_at.is_(None)
        ).count()
        
        items.append({
            "order_id": order.order_id,
            "customer_id": order.customer_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "external_order_id": order.external_order_id,
            "order_channel": order.order_channel,
            "order_status": order.order_status,
            "total_amount": order.total_amount,
            "payment_amount": order.payment_amount,
            "order_at": order.order_at,
            "item_count": item_count
        })
    
    return items, total


def get_orders_by_customer(db: Session, customer_id: int, limit: int = 50) -> List[Order]:
    """고객 ID로 주문 목록 조회"""
    return order_crud.read_orders_by_customer(customer_id=customer_id, db=db, limit=limit)


def create_order(db: Session, order_in: OrderCreate) -> Order:
    """주문 생성 (주문자/배송지 자동 처리)"""
    
    # 1. 고객 처리: customer_id가 있으면 사용, 없으면 customer 정보로 찾거나 생성
    customer_id = order_in.customer_id
    
    if not customer_id and order_in.customer:
        existing_customer = customer_service.get_customer_by_phone(db, order_in.customer.customer_phone)
        
        if existing_customer:
            customer_id = existing_customer.customer_id
        else:
            # 신규 고객 생성
            new_customer = customer_service.create_customer(db, CustomerCreate(
                customer_name=order_in.customer.customer_name,
                customer_phone=order_in.customer.customer_phone,
                customer_email=order_in.customer.customer_email,
                create_channel=order_in.order_channel
            ))
            customer_id = new_customer.customer_id
    
    if not customer_id:
        raise ValueError("고객 정보가 필요합니다. customer_id 또는 customer 정보를 입력해주세요.")
    
    # 2. 배송지 처리: address_id가 있으면 사용, 없으면 address 정보로 찾거나 생성
    address_id = order_in.address_id
    
    if not address_id and order_in.address:
        address = address_service.find_or_create_address(db, AddressCreate(
            customer_id=customer_id,
            address_name=order_in.address.address_name,
            phone=order_in.address.phone,
            nation=order_in.address.nation,
            postal_code=order_in.address.postal_code,
            address=order_in.address.address,
            address_memo=order_in.address.address_memo
        ))
        address_id = address.address_id
    
    # 3. 주문 생성
    order = order_crud.create_order(
        customer_id=customer_id,
        address_id=address_id,
        external_order_id=order_in.external_order_id,
        order_channel=order_in.order_channel,
        db=db,
        discount_amount=order_in.discount_amount,
        send_fee=order_in.send_fee,
        payment_method=order_in.payment_method,
        request_memo=order_in.request_memo,
        admin_memo=order_in.admin_memo
    )
    
    # 4. 주문 품목 생성 및 금액 계산
    total_amount = 0
    
    for item_in in order_in.items:
        product = db.query(Product).filter(Product.product_code == item_in.product_code).first()
        if not product:
            db.rollback()
            raise ValueError(f"상품을 찾을 수 없습니다: {item_in.product_code}")
        
        price = item_in.price if item_in.price is not None else product.price
        sale = item_in.sale if item_in.sale is not None else product.sale
        
        # 구독 기간 계산
        subscribe_start_issue = None
        subscribe_end_issue = None
        subscribe_period = None
        final_subscribe_end_issue = None
            
        if product.product_kind == "YEARLY":
            subscribe_start_issue = product.subscribe_start_issue
            subscribe_period = item_in.subscribe_period or 12
            if subscribe_start_issue:
                subscribe_end_issue = calculate_subscribe_end_issue(subscribe_start_issue, subscribe_period)
                final_subscribe_end_issue = subscribe_end_issue
        elif product.product_kind == "MONTHLY":
            subscribe_start_issue = product.subscribe_start_issue
            subscribe_end_issue = product.subscribe_start_issue
            subscribe_period = 1
            final_subscribe_end_issue = subscribe_end_issue
        # SINGLE은 모두 NULL
        
        order_item = OrderItem(
            order_id=order.order_id,
            product_code=product.product_code,
            product_name=product.product_name,
            product_kind=product.product_kind,
            price=price,
            sale=sale,
            order_num=item_in.order_num,
            subscribe_start_issue=subscribe_start_issue,
            subscribe_end_issue=subscribe_end_issue,
            subscribe_period=subscribe_period,
            final_subscribe_end_issue=final_subscribe_end_issue,
            address_id=address_id
        )
        db.add(order_item)
        
        # 총 판매가액(total_amount) = 판매가 * 수량
        total_amount += sale * item_in.order_num
    
    # 5. 주문 금액 계산 및 업데이트
    order.total_amount = total_amount
    # 총 결제금액(payment_amount) = total_amount - 특별할인 + 받은배송비
    order.payment_amount = total_amount - (order.discount_amount or 0) + (order.send_fee or 0)
    
    # 6. 고객 최근 주문일 업데이트
    customer = db.query(Customer).filter(Customer.customer_id == customer_id).first()
    if customer:
        customer.last_order_at = datetime.now()
    
    try:
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise ValueError(f"주문 생성 중 오류가 발생했습니다: {str(e)}")


def update_order(db: Session, order: Order, order_in: OrderUpdate) -> Order:
    """주문 수정"""
    return order_crud.update_order(order=order, order_in=order_in, db=db)


def update_order_status(db: Session, order: Order, status: str) -> Order:
    """주문 상태 변경"""
    return order_crud.update_order_status(order=order, status=status, db=db)


def cancel_order(db: Session, order: Order) -> Order:
    """주문 취소"""
    return order_crud.cancel_order(order=order, db=db)


def recalculate_totals(db: Session, order: Order) -> Order:
    """주문 총액 재계산"""
    items = order_crud.read_order_items_by_order_id(
        order_id=order.order_id,
        db=db,
        include_cancelled=False
    )
    
    total_amount = sum(item.sale * item.order_num for item in items)
    refund_amount = sum(item.refund or 0 for item in items)
    
    order.total_amount = total_amount
    order.refund_amount = refund_amount
    order.payment_amount = total_amount - (order.discount_amount or 0) - refund_amount + (order.send_fee or 0)
    
    try:
        db.commit()
        db.refresh(order)
        return order
    except Exception as e:
        db.rollback()
        raise ValueError(f"주문 총액 재계산 중 오류가 발생했습니다: {str(e)}")
