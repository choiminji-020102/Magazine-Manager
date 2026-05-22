import api from "./axios";
import type { ResponseModel } from "../types/api";
import type {
  OrdersSummaryResponse,
  OrdersByChannelResponse,
  OrdersByPeriodResponse,
  SubscriptionsByIssueResponse,
  CustomersByChannelResponse,
} from "../types/stats";

export const statsApi = {
  // GET /stats/orders/summary - 주문 현황 요약
  getOrdersSummary: (params: { start_date?: string; end_date?: string }) => {
    return api.get<ResponseModel<OrdersSummaryResponse>>("/stats/orders/summary", { params });
  },

  // GET /stats/orders/by-channel - 채널별 주문 통계
  getOrdersByChannel: (params: { start_date?: string; end_date?: string }) => {
    return api.get<ResponseModel<OrdersByChannelResponse>>("/stats/orders/by-channel", {
      params,
    });
  },

  // GET /stats/orders/by-period - 기간별 주문 통계
  getOrdersByPeriod: (params: {
    period?: string;
    start_date?: string;
    end_date?: string;
  }) => {
    return api.get<ResponseModel<OrdersByPeriodResponse>>("/stats/orders/by-period", { params });
  },

  // GET /stats/subscriptions/by-issue - 호수별 구독자 수
  getSubscriptionsByIssue: (params: { start_issue?: string; end_issue?: string }) => {
    return api.get<ResponseModel<SubscriptionsByIssueResponse>>("/stats/subscriptions/by-issue", {
      params,
    });
  },

  // GET /stats/customers/by-channel - 유입경로별 고객 통계
  getCustomersByChannel: () => {
    return api.get<ResponseModel<CustomersByChannelResponse>>("/stats/customers/by-channel");
  },
};
