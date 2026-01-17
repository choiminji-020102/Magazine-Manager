import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import { OrderItem } from "./orderApi";

// 구독 상세 정보
export interface SubscriptionDetail {
  order_item_id: number;
  order_id: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  product_code: string;
  product_kind: "YEARLY" | "MONTHLY" | "SINGLE";
  product_name: string;
  subscribe_start_issue: string | null;
  subscribe_end_issue: string | null;
  final_subscribe_end_issue: string | null;
  last_send_issue: string | null;
  address_id: number;
  address: {
    address_id: number;
    address_name: string;
    phone: string;
    postal_code: string;
    address1: string;
    address2: string | null;
    address_memo: string | null;
  };
  order: {
    order_id: number;
    order_channel: string;
    order_status: string;
    payment_amount: number;
    order_at: string;
    payment_at: string | null;
  };
  pauses: Array<{
    pause_id: number;
    pause_issue: string;
    reason: string | null;
    created_at: string;
    admin_id: number | null;
  }>;
  shipments: Array<{
    issue: string;
    sended_at: string;
  }>;
}

// 구독 연장 요청
export interface ExtendSubscriptionRequest {
  order_item_id: number;
  months: number; // 연장할 개월 수
}

// 구독 기간 변경 요청
export interface ChangePeriodRequest {
  order_item_id: number;
  subscribe_start_issue: string;
  subscribe_end_issue: string;
}

// 휴지 신청 요청
export interface PauseSubscriptionRequest {
  order_item_id: number;
  pause_issue: string; // 휴지할 호 (예: "2602")
  reason: string | null;
}

// 배송지 변경 요청
export interface ChangeAddressRequest {
  order_item_id: number;
  address: {
    address_name: string;
    phone: string;
    postal_code: string;
    address1: string;
    address2?: string;
    address_memo?: string;
  };
}

// 기간 단축 및 환불 요청
export interface ShortenSubscriptionRequest {
  order_item_id: number;
  final_subscribe_end_issue: string; // 단축된 종료 호
  refund_amount: number;
  use_message_template?: boolean;
  message_template_id?: string | null;
}

// API 함수들
export const subscriptionAPI = {
  /**
   * 구독 상세 정보 조회
   * GET /subscription/{order_item_id}
   */
  getDetail: async (orderItemId: number): Promise<SubscriptionDetail> => {
    try {
      const response = await api.get<SubscriptionDetail>(
        `/subscription/${orderItemId}`
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_SUBSCRIPTION_DETAIL");
      throw err;
    }
  },

  /**
   * 구독 연장 (무상 연장)
   * POST /subscription/{order_item_id}/extend
   */
  extend: async (
    data: ExtendSubscriptionRequest
  ): Promise<{ message: string }> => {
    try {
      const response = await api.post<{ message: string }>(
        `/subscription/${data.order_item_id}/extend`,
        { months: data.months }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "EXTEND_SUBSCRIPTION");
      throw err;
    }
  },

  /**
   * 구독 기간 변경
   * PUT /subscription/{order_item_id}/period
   */
  changePeriod: async (
    data: ChangePeriodRequest
  ): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>(
        `/subscription/${data.order_item_id}/period`,
        {
          subscribe_start_issue: data.subscribe_start_issue,
          subscribe_end_issue: data.subscribe_end_issue,
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CHANGE_SUBSCRIPTION_PERIOD");
      throw err;
    }
  },

  /**
   * 휴지 신청
   * POST /subscription/{order_item_id}/pause
   */
  pause: async (
    data: PauseSubscriptionRequest
  ): Promise<{ message: string }> => {
    try {
      const response = await api.post<{ message: string }>(
        `/subscription/${data.order_item_id}/pause`,
        {
          pause_issue: data.pause_issue,
          reason: data.reason,
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "PAUSE_SUBSCRIPTION");
      throw err;
    }
  },

  /**
   * 배송지 변경
   * PUT /subscription/{order_item_id}/address
   */
  changeAddress: async (
    data: ChangeAddressRequest
  ): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>(
        `/subscription/${data.order_item_id}/address`,
        { address: data.address }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CHANGE_SUBSCRIPTION_ADDRESS");
      throw err;
    }
  },

  /**
   * 기간 단축 및 환불
   * PUT /subscription/{order_item_id}/shorten
   */
  shorten: async (
    data: ShortenSubscriptionRequest
  ): Promise<{ message: string }> => {
    try {
      const response = await api.put<{ message: string }>(
        `/subscription/${data.order_item_id}/shorten`,
        {
          final_subscribe_end_issue: data.final_subscribe_end_issue,
          refund_amount: data.refund_amount,
          use_message_template: data.use_message_template || false,
          message_template_id: data.message_template_id || null,
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "SHORTEN_SUBSCRIPTION");
      throw err;
    }
  },
};
