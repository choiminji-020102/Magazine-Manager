# 표준 라이브러리
from typing import Optional, List
from datetime import datetime

# 서드파티 라이브러리
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, case

# 로컬 애플리케이션
from app.models.order_item import OrderItem
from app.models.order import Order
from app.models.product import Product
from app.models.address import Address
from app.models.pause import Pause
from app.models.customer import Customer
from app.schemas.order_item import OrderItemCreate, OrderItemUpdate
from app.crud import order_item as order_item_crud
from app.services import address_service, pause_service


def get_order_item_by_id(db: Session, order_item_id: int) -> OrderItem:
    """주문 품목 ID로 주문 품목 조회 (취소된 것 포함)"""
    return order_item_crud.read_order_item_by_id(order_item_id=order_item_id, db=db)


def get_active_order_item_by_id(db: Session, order_item_id: int) -> OrderItem:
    """활성 주문 품목 ID로 주문 품목 조회 (취소되지 않은 주문 품목)"""
    return order_item_crud.read_active_order_item_by_id(order_item_id=order_item_id, db=db)


def get_order_items_by_order(db: Session, order_id: int) -> List[OrderItem]:
    """주문 ID로 주문 품목 목록 조회 (취소된 것 포함)"""
    order_items = order_item_crud.read_order_items_by_order_id(order_id=order_id, db=db, include_cancelled=True)
    if len(order_items) == 0:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목들을 찾을 수 없습니다."
        )
    return order_items


def get_active_order_items_by_order(db: Session, order_id: int) -> List[OrderItem]:
    """주문 ID로 활성 주문 품목 목록 조회 (취소되지 않은 것만)"""
    order_items = order_item_crud.read_order_items_by_order_id(order_id=order_id, db=db, include_cancelled=False)
    if len(order_items) == 0:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="주문 품목들을 찾을 수 없거나 취소되었습니다."
        )
    return order_items


def create_order_item(db: Session, order: Order, item_in: OrderItemCreate) -> OrderItem:
    """주문 품목 생성"""
    # 상품 조회
    product = db.query(Product).filter(Product.product_code == item_in.product_code).first()
    if not product:
        raise ValueError(f"상품을 찾을 수 없습니다: {item_in.product_code}")
    
    # 배송지 처리
    address_id = order.address_id
    if item_in.address:
        address = address_service.find_or_create_address(db, item_in.address)
        address_id = address.address_id
    elif item_in.address_id:
        address_id = item_in.address_id
    
    # 주문 품목 생성
    order_item = order_item_crud.create_order_item(
        order_id=order.order_id,
        product_code=product.product_code,
        product_kind=product.product_kind,
        product_name=product.product_name,
        address_id=address_id,
        db=db,
        external_order_item_id=item_in.external_order_item_id,
        price=item_in.price if item_in.price is not None else product.price,
        sale=item_in.sale if item_in.sale is not None else product.sale,
        order_num=item_in.order_num or 1,
        subscribe_start_issue=item_in.subscribe_start_issue,
        subscribe_end_issue=item_in.subscribe_end_issue
    )
    
    try:
        db.commit()
        db.refresh(order_item)
        return order_item
    except Exception as e:
        db.rollback()
        raise ValueError(f"주문 품목 생성 중 오류가 발생했습니다: {str(e)}")


def update_order_item(db: Session, order_item: OrderItem, item_in: OrderItemUpdate) -> OrderItem:
    """주문 품목 수정"""
    update_data = item_in.model_dump(exclude_unset=True)
    
    # 환불액/구독기간 변경 여부 확인
    refund_changed = "refund" in update_data
    period_changed = "subscribe_period" in update_data
    
    # 배송지 처리
    if "address" in update_data and update_data["address"]:
        from app.schemas.address import AddressCreate
        address = address_service.find_or_create_address(db, AddressCreate(**update_data["address"]))
        order_item.address_id = address.address_id
    
    # 주문 품목 수정
    order_item = order_item_crud.update_order_item(order_item=order_item, item_in=item_in, db=db)
    
    # 환불액이 변경되면 주문 총액 재계산
    if refund_changed:
        from app.services import order_service
        order = order_service.get_order_by_id(db, order_item.order_id)
        order_service.recalculate_totals(db, order)
    
    # 구독기간이 변경되면 final_subscribe_end_issue 재계산
    if period_changed and order_item.product_kind in ["YEARLY", "MONTHLY"]:
        new_final_issue = recalculate_final_subscribe_end_issue(db, order_item)
        if new_final_issue:
            order_item.final_subscribe_end_issue = new_final_issue
            # subscribe_end_issue도 함께 업데이트 (휴지 제외한 기본 종료호)
            from app.core.utils import calculate_subscribe_end_issue
            order_item.subscribe_end_issue = calculate_subscribe_end_issue(
                order_item.subscribe_start_issue, 
                order_item.subscribe_period or 12
            )
            try:
                db.commit()
                db.refresh(order_item)
            except Exception as e:
                db.rollback()
                raise ValueError(f"구독 기간 업데이트 중 오류가 발생했습니다: {str(e)}")
    
    return order_item


def cancel_order_item(db: Session, order_item: OrderItem) -> OrderItem:
    """주문 품목 취소"""
    return order_item_crud.cancel_order_item(order_item=order_item, db=db)


def update_subscription(db: Session, order_item: OrderItem, start_issue: str, end_issue: str) -> OrderItem:
    """구독 기간 업데이트"""
    return order_item_crud.update_subscription(
        order_item=order_item,
        start_issue=start_issue,
        end_issue=end_issue,
        db=db
    )


def update_last_send_issue(db: Session, order_item: OrderItem, issue: str) -> OrderItem:
    """마지막 발송 호수 업데이트"""
    return order_item_crud.update_last_send_issue(order_item=order_item, issue=issue, db=db)


def convert_to_monthly_product_code(product_code: str, product_kind: str, issue: str) -> str:
    """
    주문품목의 product_code를 발송용 product_code로 변환
    
    - YEARLY: 대표코드+YYYYMM → 대표코드-{issue}
    - MONTHLY: 변환 없음
    - SINGLE: 변환 없음
    
    예) M1001+202601, issue=202603 → M1001-202603
    """
    if product_kind == "YEARLY" and "+" in product_code:
        base_code = product_code.split("+")[0]
        return f"{base_code}-{issue}"
    return product_code


def find_subscription_targets(
    db: Session, 
    issue: str, 
    product_code: Optional[str] = None,
    base_code: Optional[str] = None
) -> List[dict]:
    """Find all subscription items that should receive this issue
    
    Args:
        db: Database session
        issue: 발송 호수 (예: "202602")
        product_code: 상품 코드 필터 - 정확히 일치 (옵션)
        base_code: 대표 코드 필터 - 대표코드로 시작하는 상품 (옵션, 예: "M1001")
    """
    
    # Subquery for pauses
    pause_subquery = db.query(Pause.order_item_id).filter(
        Pause.pause_issue == issue,
        Pause.deleted_at.is_(None)
    ).subquery()
    
    query = db.query(
        OrderItem,
        Order.customer_id,
        Order.order_channel,
        Customer.customer_name,
        Customer.customer_phone,
        Address.recipient_name,
        Address.recipient_phone,
        Address.postal_code,
        Address.address,
        Address.customer_memo
    ).join(Order, OrderItem.order_id == Order.order_id)\
     .join(Customer, Order.customer_id == Customer.customer_id)\
     .outerjoin(Address, OrderItem.address_id == Address.address_id)\
     .filter(
        OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
        OrderItem.cancelled_at.is_(None),
        OrderItem.subscribe_start_issue <= issue,
        or_(
            OrderItem.final_subscribe_end_issue >= issue,
            OrderItem.final_subscribe_end_issue.is_(None)
        ),
        or_(
            OrderItem.last_send_issue.is_(None),
            OrderItem.last_send_issue < issue
        ),
        ~OrderItem.order_item_id.in_(pause_subquery)
    )
    
    # product_code 필터 적용 (정확히 일치)
    if product_code:
        query = query.filter(OrderItem.product_code == product_code)
    
    # base_code 필터 적용 (대표코드로 시작)
    if base_code:
        query = query.filter(OrderItem.product_code.like(f"{base_code}%"))
    
    results = query.order_by(Customer.customer_name.asc()).all()
    
    targets = []
    for row in results:
        item, customer_id, order_channel, customer_name, customer_phone, \
        recipient_name, recipient_phone, postal_code, address, customer_memo = row

        # 발송용 product_code 변환
        send_product_code = convert_to_monthly_product_code(
            item.product_code, item.product_kind, issue
        )

        targets.append({
            "order_item_id": item.order_item_id,
            "order_id": item.order_id,
            "customer_id": customer_id,
            "order_channel": order_channel,
            "product_code": item.product_code,  # 원본 주문품목 코드
            "send_product_code": send_product_code,  # 발송용 상품 코드
            "product_kind": item.product_kind,
            "product_name": item.product_name,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "address_id": item.address_id,
            "recipient_name": recipient_name,
            "recipient_phone": recipient_phone,
            "postal_code": postal_code,
            "address": address,
            "customer_memo": customer_memo
        })
    
    return targets


def get_subscription_stats(
    db: Session, 
    issue: str, 
    product_code: Optional[str] = None,
    base_code: Optional[str] = None
) -> dict:
    """Get subscription statistics for an issue
    
    Args:
        db: Database session
        issue: 발송 호수 (예: "202602")
        product_code: 상품 코드 필터 - 정확히 일치 (옵션)
        base_code: 대표 코드 필터 (옵션)
    """
    
    query = db.query(
        func.count().label("total_subscriptions"),
        func.sum(case((OrderItem.product_kind == "YEARLY", 1), else_=0)).label("yearly_count"),
        func.sum(case((OrderItem.product_kind == "MONTHLY", 1), else_=0)).label("monthly_count"),
        func.sum(case((OrderItem.last_send_issue == issue, 1), else_=0)).label("sent_count")
    ).filter(
        OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
        OrderItem.cancelled_at.is_(None),
        OrderItem.subscribe_start_issue <= issue,
        or_(
            OrderItem.final_subscribe_end_issue >= issue,
            OrderItem.final_subscribe_end_issue.is_(None)
        )
    )
    
    if product_code:
        query = query.filter(OrderItem.product_code == product_code)
    
    if base_code:
        query = query.filter(OrderItem.product_code.like(f"{base_code}%"))
    
    result = query.first()
    
    return {
        "total_subscriptions": result.total_subscriptions or 0,
        "yearly_count": result.yearly_count or 0,
        "monthly_count": result.monthly_count or 0,
        "sent_count": result.sent_count or 0
    }


def find_single_targets(
    db: Session, 
    product_code: str
) -> List[dict]:
    """Find all SINGLE product items that should be dispatched
    
    SINGLE 상품은 구독 기간 개념이 없으므로:
    - product_code로 필터
    - 취소되지 않은 품목 (cancelled_at IS NULL)
    - 아직 발송되지 않은 품목 (sended_at IS NULL)
    
    Args:
        db: Database session
        product_code: 상품 코드 (예: "A5500")
    """
    
    results = db.query(
        OrderItem,
        Order.customer_id,
        Order.order_channel,
        Customer.customer_name,
        Customer.customer_phone,
        Address.recipient_name,
        Address.recipient_phone,
        Address.postal_code,
        Address.address,
        Address.customer_memo
    ).join(Order, OrderItem.order_id == Order.order_id)\
     .join(Customer, Order.customer_id == Customer.customer_id)\
     .outerjoin(Address, OrderItem.address_id == Address.address_id)\
     .filter(
        OrderItem.product_code == product_code,
        OrderItem.product_kind == "SINGLE",
        OrderItem.cancelled_at.is_(None),
        OrderItem.sended_at.is_(None)  # 아직 발송 안된 것만
    ).order_by(Customer.customer_name.asc()).all()
    
    targets = []
    for row in results:
        item, customer_id, order_channel, customer_name, customer_phone, \
        recipient_name, recipient_phone, postal_code, address, customer_memo = row

        targets.append({
            "order_item_id": item.order_item_id,
            "order_id": item.order_id,
            "customer_id": customer_id,
            "order_channel": order_channel,
            "product_code": item.product_code,
            "send_product_code": item.product_code,  # SINGLE은 변환 없음
            "product_kind": item.product_kind,
            "product_name": item.product_name,
            "order_num": item.order_num,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "address_id": item.address_id,
            "recipient_name": recipient_name,
            "recipient_phone": recipient_phone,
            "postal_code": postal_code,
            "address": address,
            "customer_memo": customer_memo
        })
    
    return targets


def recalculate_final_subscribe_end_issue(db: Session, order_item: OrderItem) -> str:
    """
    subscribe_period와 휴지 개수를 기반으로 final_subscribe_end_issue 재계산
    
    계산식:
    final_subscribe_end_issue = subscribe_start_issue + subscribe_period - 1 + 휴지개수
    """
    from app.models.pause import Pause
    from app.core.utils import calculate_subscribe_end_issue
    
    if not order_item.subscribe_start_issue:
        return None
    
    if order_item.product_kind not in ["YEARLY", "MONTHLY"]:
        return None
    
    # 휴지 개수 조회
    pause_count = db.query(Pause).filter(
        Pause.order_item_id == order_item.order_item_id,
        Pause.deleted_at == None
    ).count()
    
    # 기본 구독 기간 + 휴지 개수
    period = order_item.subscribe_period or 12
    total_period = period + pause_count
    
    # final_subscribe_end_issue 계산
    final_issue = calculate_subscribe_end_issue(order_item.subscribe_start_issue, total_period)
    
    return final_issue


def get_order_item_with_pauses(db: Session, order_item_id: int) -> Optional[dict]:
    """주문품목 상세 조회 (휴지 정보 포함)"""
    
    order_item = get_active_order_item_by_id(db, order_item_id)
    
    pauses = pause_service.get_pauses_by_order_item(db, order_item_id)
    
    return {
        "order_item_id": order_item.order_item_id,
        "order_id": order_item.order_id,
        "product_code": order_item.product_code,
        "product_name": order_item.product_name,
        "product_kind": order_item.product_kind,
        "price": order_item.price or 0,
        "sale": order_item.sale or 0,
        "refund": order_item.refund or 0,
        "order_num": order_item.order_num or 1,
        "subscribe_start_issue": order_item.subscribe_start_issue,
        "subscribe_end_issue": order_item.subscribe_end_issue,
        "subscribe_period": order_item.subscribe_period,
        "last_send_issue": order_item.last_send_issue,
        "final_subscribe_end_issue": order_item.final_subscribe_end_issue,
        "address_id": order_item.address_id,
        "memo": order_item.memo,
        "sended_at": order_item.sended_at,
        "cancelled_at": order_item.cancelled_at,
        "created_at": order_item.created_at,
        "updated_at": order_item.updated_at,
        "pauses": [
            {
                "pause_id": p.pause_id,
                "pause_issue": p.pause_issue,
                "reason": p.reason,
                "created_at": p.created_at
            } for p in pauses
        ]
    }


def get_order_items_with_pauses(db: Session, order_id: int) -> List[dict]:
    """주문별 품목 목록 조회 (휴지 정보 포함)"""
    from app.models.pause import Pause
    
    order_items = db.query(OrderItem).filter(
        OrderItem.order_id == order_id
    ).order_by(OrderItem.order_item_id).all()
    
    result = []
    for item in order_items:
        pauses = db.query(Pause).filter(
            Pause.order_item_id == item.order_item_id,
            Pause.deleted_at == None
        ).order_by(Pause.pause_issue).all()
        
        result.append({
            "order_item_id": item.order_item_id,
            "order_id": item.order_id,
            "product_code": item.product_code,
            "product_name": item.product_name,
            "product_kind": item.product_kind,
            "price": item.price or 0,
            "sale": item.sale or 0,
            "refund": item.refund or 0,
            "order_num": item.order_num or 1,
            "subscribe_start_issue": item.subscribe_start_issue,
            "subscribe_end_issue": item.subscribe_end_issue,
            "subscribe_period": item.subscribe_period,
            "last_send_issue": item.last_send_issue,
            "final_subscribe_end_issue": item.final_subscribe_end_issue,
            "address_id": item.address_id,
            "memo": item.memo,
            "sended_at": item.sended_at,
            "cancelled_at": item.cancelled_at,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
            "pauses": [
                {
                    "pause_id": p.pause_id,
                    "pause_issue": p.pause_issue,
                    "reason": p.reason,
                    "created_at": p.created_at
                } for p in pauses
            ]
        })
    
    return result