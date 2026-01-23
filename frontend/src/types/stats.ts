// Stats 관련 타입

export interface DateRange {
  start: string;
  end: string;
}

export interface OrderSummary {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  avg_order_value: number | null;
}

export interface DailyTrend {
  date: string;
  orders: number;
  revenue: number;
}

export interface OrdersSummaryResponse {
  period: DateRange;
  summary: OrderSummary;
  daily_trend: DailyTrend[];
}

export interface ChannelStats {
  order_channel: string;
  total_orders: number;
  valid_orders: number;
  revenue: number;
}

export interface OrdersByChannelResponse {
  period: DateRange;
  by_channel: ChannelStats[];
}

export interface PeriodStats {
  period: string;
  total_orders: number;
  valid_orders: number;
  revenue: number;
}

export interface OrdersByPeriodResponse {
  period_type: string;
  date_range: DateRange;
  data: PeriodStats[];
}

export interface SubscriptionByKind {
  product_kind: string;
  count: number;
  unique_customers: number;
}

export interface SubscriptionTotal {
  total_subscriptions: number;
  total_subscribers: number;
}

export interface SubscriptionsActiveResponse {
  issue: string;
  total: SubscriptionTotal;
  by_kind: SubscriptionByKind[];
}

export interface IssueSubscription {
  issue: string;
  subscription_count: number;
  subscriber_count: number;
}

export interface SubscriptionsByIssueResponse {
  range: DateRange;
  issues: IssueSubscription[];
}

export interface CustomerChannelStats {
  create_channel: string;
  total_customers: number;
  customers_with_orders: number;
}

export interface CustomerTotal {
  total: number;
  with_orders: number;
}

export interface CustomersByChannelResponse {
  total: CustomerTotal;
  by_channel: CustomerChannelStats[];
}
