from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_
from typing import Optional
from datetime import datetime, date, timedelta

from app.db.session import get_db
from app.core.deps import require_roles
from app.models.admin import Admin
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.customer import Customer
from app.schemas.stats import (
    OrdersSummaryResponse, OrdersByChannelResponse, OrdersByPeriodResponse,
    SubscriptionsActiveResponse, SubscriptionsByIssueResponse, CustomersByChannelResponse,
    DateRange, OrderSummary, DailyTrend, ChannelStats, PeriodStats,
    SubscriptionByKind, SubscriptionTotal, IssueSubscription,
    CustomerChannelStats, CustomerTotal
)
from app.schemas.common import ResponseModel

router = APIRouter(prefix="/stats", tags=["통계"])

require_admin = require_roles(["SUPER_ADMIN", "ADMIN"])

@router.get("/orders/summary", response_model=ResponseModel[OrdersSummaryResponse])
def get_orders_summary(
    start_date: str = Query(default_factory=lambda: date.today().replace(day=1).isoformat()),
    end_date: str = Query(default_factory=lambda: date.today().isoformat()),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """주문 현황 요약"""
    # Summary
    result = db.query(
        func.count().label("total_orders"),
        func.sum(case((Order.order_status == "COMPLETED", 1), else_=0)).label("completed_orders"),
        func.sum(case((Order.order_status.in_(("CANCELLED", "UNPAID_CANCELLED")), 1), else_=0)).label("cancelled_orders"),
        func.sum(case((Order.order_status.notin_(("CANCELLED", "UNPAID_CANCELLED")), Order.payment_amount), else_=0)).label("total_revenue"),
        func.avg(case((Order.order_status.notin_(("CANCELLED", "UNPAID_CANCELLED")), Order.payment_amount), else_=None)).label("avg_order_value")
    ).filter(
        func.date(Order.order_at).between(start_date, end_date)
    ).first()
    
    # Daily trend
    trend = db.query(
        func.date(Order.order_at).label("date"),
        func.count().label("orders"),
        func.sum(case((Order.order_status.notin_(("CANCELLED", "UNPAID_CANCELLED")), Order.payment_amount), else_=0)).label("revenue")
    ).filter(
        func.date(Order.order_at).between(start_date, end_date)
    ).group_by(func.date(Order.order_at)).order_by(func.date(Order.order_at)).all()
    
    return ResponseModel(data=OrdersSummaryResponse(
        period=DateRange(start=start_date, end=end_date),
        summary=OrderSummary(
            total_orders=result.total_orders or 0,
            completed_orders=result.completed_orders or 0,
            cancelled_orders=result.cancelled_orders or 0,
            total_revenue=result.total_revenue or 0,
            avg_order_value=float(result.avg_order_value) if result.avg_order_value else None
        ),
        daily_trend=[DailyTrend(date=str(t.date), orders=t.orders, revenue=t.revenue or 0) for t in trend]
    ))


@router.get("/orders/by-channel", response_model=ResponseModel[OrdersByChannelResponse])
def get_orders_by_channel(
    start_date: str = Query(default_factory=lambda: date.today().replace(day=1).isoformat()),
    end_date: str = Query(default_factory=lambda: date.today().isoformat()),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """채널별 주문 통계"""
    results = db.query(
        Order.order_channel,
        func.count().label("total_orders"),
        func.sum(case((Order.order_status.notin_(("CANCELLED", "UNPAID_CANCELLED")), 1), else_=0)).label("valid_orders"),
        func.sum(case((Order.order_status.notin_(("CANCELLED", "UNPAID_CANCELLED")), Order.payment_amount), else_=0)).label("revenue")
    ).filter(
        func.date(Order.order_at).between(start_date, end_date)
    ).group_by(Order.order_channel).order_by(func.sum(Order.payment_amount).desc()).all()
    
    return ResponseModel(data=OrdersByChannelResponse(
        period=DateRange(start=start_date, end=end_date),
        by_channel=[ChannelStats(
            order_channel=r.order_channel,
            total_orders=r.total_orders,
            valid_orders=r.valid_orders or 0,
            revenue=r.revenue or 0
        ) for r in results]
    ))


@router.get("/orders/by-period", response_model=ResponseModel[OrdersByPeriodResponse])
def get_orders_by_period(
    period: str = Query("monthly"),
    start_date: str = Query(default_factory=lambda: (date.today() - timedelta(days=365)).isoformat()),
    end_date: str = Query(default_factory=lambda: date.today().isoformat()),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """기간별 주문 통계"""
    if period == "daily":
        group_by = func.date(Order.order_at)
        period_expr = func.date(Order.order_at)
    elif period == "weekly":
        group_by = func.yearweek(Order.order_at, 1)
        period_expr = func.concat(func.year(Order.order_at), "-W", func.lpad(func.week(Order.order_at, 1), 2, "0"))
    else:  # monthly
        group_by = func.date_format(Order.order_at, "%Y-%m")
        period_expr = func.date_format(Order.order_at, "%Y-%m")
    
    results = db.query(
        period_expr.label("period"),
        func.count().label("total_orders"),
        func.sum(case((Order.order_status.notin_(("CANCELLED", "UNPAID_CANCELLED")), 1), else_=0)).label("valid_orders"),
        func.sum(case((Order.order_status.notin_(("CANCELLED", "UNPAID_CANCELLED")), Order.payment_amount), else_=0)).label("revenue")
    ).filter(
        func.date(Order.order_at).between(start_date, end_date)
    ).group_by(group_by).order_by(group_by).all()
    
    return ResponseModel(data=OrdersByPeriodResponse(
        period_type=period,
        date_range=DateRange(start=start_date, end=end_date),
        data=[PeriodStats(period=str(r.period), total_orders=r.total_orders, valid_orders=r.valid_orders or 0, revenue=r.revenue or 0) for r in results]
    ))


@router.get("/subscriptions/active", response_model=ResponseModel[SubscriptionsActiveResponse])
def get_active_subscriptions(
    issue: str = Query(default_factory=lambda: datetime.now().strftime("%Y%m")),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """활성 구독 현황"""
    # By kind
    by_kind = db.query(
        OrderItem.product_kind,
        func.count().label("count"),
        func.count(func.distinct(Order.customer_id)).label("unique_customers")
    ).join(Order, OrderItem.order_id == Order.order_id).filter(
        OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
        OrderItem.cancelled_at.is_(None),
        OrderItem.subscribe_start_issue <= issue,
        or_(OrderItem.final_subscribe_end_issue >= issue, OrderItem.final_subscribe_end_issue.is_(None))
    ).group_by(OrderItem.product_kind).all()
    
    # Total
    total = db.query(
        func.count().label("total_subscriptions"),
        func.count(func.distinct(Order.customer_id)).label("total_subscribers")
    ).select_from(OrderItem).join(Order, OrderItem.order_id == Order.order_id).filter(
        OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
        OrderItem.cancelled_at.is_(None),
        OrderItem.subscribe_start_issue <= issue,
        or_(OrderItem.final_subscribe_end_issue >= issue, OrderItem.final_subscribe_end_issue.is_(None))
    ).first()
    
    return ResponseModel(data=SubscriptionsActiveResponse(
        issue=issue,
        total=SubscriptionTotal(total_subscriptions=total.total_subscriptions or 0, total_subscribers=total.total_subscribers or 0),
        by_kind=[SubscriptionByKind(product_kind=r.product_kind, count=r.count, unique_customers=r.unique_customers) for r in by_kind]
    ))


@router.get("/subscriptions/by-issue", response_model=ResponseModel[SubscriptionsByIssueResponse])
def get_subscriptions_by_issue(
    start_issue: str = Query(default_factory=lambda: (datetime.now() - timedelta(days=180)).strftime("%Y%m")),
    end_issue: str = Query(default_factory=lambda: (datetime.now() + timedelta(days=180)).strftime("%Y%m")),
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """호수별 구독자 수"""
    issues = []
    current = datetime.strptime(start_issue, "%Y%m")
    end = datetime.strptime(end_issue, "%Y%m")
    
    while current <= end:
        issue = current.strftime("%Y%m")
        
        result = db.query(
            func.count().label("subscription_count"),
            func.count(func.distinct(Order.customer_id)).label("subscriber_count")
        ).select_from(OrderItem).join(Order, OrderItem.order_id == Order.order_id).filter(
            OrderItem.product_kind.in_(["YEARLY", "MONTHLY"]),
            OrderItem.cancelled_at.is_(None),
            OrderItem.subscribe_start_issue <= issue,
            or_(OrderItem.final_subscribe_end_issue >= issue, OrderItem.final_subscribe_end_issue.is_(None))
        ).first()
        
        issues.append(IssueSubscription(
            issue=issue,
            subscription_count=result.subscription_count or 0,
            subscriber_count=result.subscriber_count or 0
        ))
        
        # Next month
        if current.month == 12:
            current = current.replace(year=current.year + 1, month=1)
        else:
            current = current.replace(month=current.month + 1)
    
    return ResponseModel(data=SubscriptionsByIssueResponse(
        range=DateRange(start=start_issue, end=end_issue),
        issues=issues
    ))


@router.get("/customers/by-channel", response_model=ResponseModel[CustomersByChannelResponse])
def get_customers_by_channel(
    db: Session = Depends(get_db),
    current_admin: Admin = Depends(require_admin)
):
    """유입경로별 고객 통계"""
    results = db.query(
        Customer.create_channel,
        func.count().label("total_customers"),
        func.count(Customer.last_order_at).label("customers_with_orders")
    ).filter(Customer.deleted_at.is_(None)).group_by(Customer.create_channel).order_by(func.count().desc()).all()
    
    total = db.query(
        func.count().label("total"),
        func.count(Customer.last_order_at).label("with_orders")
    ).filter(Customer.deleted_at.is_(None)).first()
    
    return ResponseModel(data=CustomersByChannelResponse(
        total=CustomerTotal(total=total.total or 0, with_orders=total.with_orders or 0),
        by_channel=[CustomerChannelStats(create_channel=r.create_channel, total_customers=r.total_customers, customers_with_orders=r.customers_with_orders) for r in results]
    ))
