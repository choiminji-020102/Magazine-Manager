from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal


class DateRange(BaseModel):
    start: str
    end: str


class OrderSummary(BaseModel):
    total_orders: int
    completed_orders: int
    cancelled_orders: int
    total_revenue: int
    avg_order_value: Optional[float] = None


class DailyTrend(BaseModel):
    date: str
    orders: int
    revenue: int


class OrdersSummaryResponse(BaseModel):
    period: DateRange
    summary: OrderSummary
    daily_trend: List[DailyTrend]


class ChannelStats(BaseModel):
    order_channel: str
    total_orders: int
    valid_orders: int
    revenue: int


class OrdersByChannelResponse(BaseModel):
    period: DateRange
    by_channel: List[ChannelStats]


class PeriodStats(BaseModel):
    period: str
    total_orders: int
    valid_orders: int
    revenue: int


class OrdersByPeriodResponse(BaseModel):
    period_type: str
    date_range: DateRange
    data: List[PeriodStats]


class IssueSubscription(BaseModel):
    issue: str
    subscription_count: int
    subscriber_count: int


class SubscriptionsByIssueResponse(BaseModel):
    range: DateRange
    issues: List[IssueSubscription]


class CustomerChannelStats(BaseModel):
    create_channel: str
    total_customers: int
    customers_with_orders: int


class CustomerTotal(BaseModel):
    total: int
    with_orders: int


class CustomersByChannelResponse(BaseModel):
    total: CustomerTotal
    by_channel: List[CustomerChannelStats]
