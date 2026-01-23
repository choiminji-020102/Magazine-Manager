import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  DateRange,
  OrderSummary,
  DailyTrend,
  OrdersSummaryResponse,
  ChannelStats,
  OrdersByChannelResponse,
  PeriodStats,
  OrdersByPeriodResponse,
  SubscriptionByKind,
  SubscriptionTotal,
  SubscriptionsActiveResponse,
  IssueSubscription,
  SubscriptionsByIssueResponse,
  CustomerChannelStats,
  CustomerTotal,
  CustomersByChannelResponse,
} from "../types/stats";
import type { ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  DateRange,
  OrderSummary,
  DailyTrend,
  OrdersSummaryResponse,
  ChannelStats,
  OrdersByChannelResponse,
  PeriodStats,
  OrdersByPeriodResponse,
  SubscriptionByKind,
  SubscriptionTotal,
  SubscriptionsActiveResponse,
  IssueSubscription,
  SubscriptionsByIssueResponse,
  CustomerChannelStats,
  CustomerTotal,
  CustomersByChannelResponse,
};

// API 함수들
export const statsAPI = {
  /**
   * 주문 현황 요약
   * GET /stats/orders/summary?start_date=&end_date=
   */
  getOrdersSummary: async (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<OrdersSummaryResponse> => {
    try {
      const response = await api.get<ResponseModel<OrdersSummaryResponse>>(
        "/stats/orders/summary",
        { params }
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDERS_SUMMARY");
      throw err;
    }
  },

  /**
   * 채널별 주문 통계
   * GET /stats/orders/by-channel?start_date=&end_date=
   */
  getOrdersByChannel: async (params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<OrdersByChannelResponse> => {
    try {
      const response = await api.get<ResponseModel<OrdersByChannelResponse>>(
        "/stats/orders/by-channel",
        { params }
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDERS_BY_CHANNEL");
      throw err;
    }
  },

  /**
   * 기간별 주문 통계
   * GET /stats/orders/by-period?period=&start_date=&end_date=
   */
  getOrdersByPeriod: async (params?: {
    period?: "daily" | "weekly" | "monthly";
    start_date?: string;
    end_date?: string;
  }): Promise<OrdersByPeriodResponse> => {
    try {
      const response = await api.get<ResponseModel<OrdersByPeriodResponse>>(
        "/stats/orders/by-period",
        { params }
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDERS_BY_PERIOD");
      throw err;
    }
  },

  /**
   * 활성 구독 현황
   * GET /stats/subscriptions/active?issue=
   */
  getActiveSubscriptions: async (params?: {
    issue?: string;
  }): Promise<SubscriptionsActiveResponse> => {
    try {
      const response = await api.get<ResponseModel<SubscriptionsActiveResponse>>(
        "/stats/subscriptions/active",
        { params }
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ACTIVE_SUBSCRIPTIONS");
      throw err;
    }
  },

  /**
   * 호수별 구독자 수
   * GET /stats/subscriptions/by-issue?start_issue=&end_issue=
   */
  getSubscriptionsByIssue: async (params?: {
    start_issue?: string;
    end_issue?: string;
  }): Promise<SubscriptionsByIssueResponse> => {
    try {
      const response = await api.get<
        ResponseModel<SubscriptionsByIssueResponse>
      >("/stats/subscriptions/by-issue", { params });
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_SUBSCRIPTIONS_BY_ISSUE");
      throw err;
    }
  },

  /**
   * 유입경로별 고객 통계
   * GET /stats/customers/by-channel
   */
  getCustomersByChannel: async (): Promise<CustomersByChannelResponse> => {
    try {
      const response = await api.get<
        ResponseModel<CustomersByChannelResponse>
      >("/stats/customers/by-channel");
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_CUSTOMERS_BY_CHANNEL");
      throw err;
    }
  },
};
