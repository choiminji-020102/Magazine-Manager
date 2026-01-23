import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  OrderItemResponse,
  OrderItemCreate,
  OrderItemUpdate,
  SubscriptionUpdate,
  DispatchTargetItem,
  DispatchTargetListResponse,
} from "../types/orderItem";
import type { ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  OrderItemResponse,
  OrderItemCreate,
  OrderItemUpdate,
  SubscriptionUpdate,
  DispatchTargetItem,
  DispatchTargetListResponse,
};

// API 함수들
export const orderItemsAPI = {
  /**
   * 주문별 품목 목록
   * GET /orders/{order_id}/items
   */
  getByOrder: async (orderId: number): Promise<OrderItemResponse[]> => {
    try {
      const response = await api.get<ResponseModel<OrderItemResponse[]>>(
        `/orders/${orderId}/items`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDER_ITEMS");
      throw err;
    }
  },

  /**
   * 품목 추가
   * POST /orders/{order_id}/items
   */
  create: async (
    orderId: number,
    data: OrderItemCreate
  ): Promise<OrderItemResponse> => {
    try {
      const response = await api.post<ResponseModel<OrderItemResponse>>(
        `/orders/${orderId}/items`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_ORDER_ITEM");
      throw err;
    }
  },

  /**
   * 품목 상세 조회
   * GET /order-items/{order_item_id}
   */
  getById: async (orderItemId: number): Promise<OrderItemResponse> => {
    try {
      const response = await api.get<ResponseModel<OrderItemResponse>>(
        `/order-items/${orderItemId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDER_ITEM_BY_ID");
      throw err;
    }
  },

  /**
   * 품목 수정
   * PUT /order-items/{order_item_id}
   */
  update: async (
    orderItemId: number,
    data: OrderItemUpdate
  ): Promise<OrderItemResponse> => {
    try {
      const response = await api.put<ResponseModel<OrderItemResponse>>(
        `/order-items/${orderItemId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_ORDER_ITEM");
      throw err;
    }
  },

  /**
   * 품목 취소
   * PATCH /order-items/{order_item_id}/cancel
   */
  cancel: async (orderItemId: number): Promise<OrderItemResponse> => {
    try {
      const response = await api.patch<ResponseModel<OrderItemResponse>>(
        `/order-items/${orderItemId}/cancel`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CANCEL_ORDER_ITEM");
      throw err;
    }
  },

  /**
   * 구독 정보 수정
   * PATCH /order-items/{order_item_id}/subscription
   */
  updateSubscription: async (
    orderItemId: number,
    data: SubscriptionUpdate
  ): Promise<OrderItemResponse> => {
    try {
      const response = await api.patch<ResponseModel<OrderItemResponse>>(
        `/order-items/${orderItemId}/subscription`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_SUBSCRIPTION");
      throw err;
    }
  },

  /**
   * 발송대상 목록 조회 (휴지 제외)
   * GET /dispatch-targets/{issue}
   */
  getDispatchTargets: async (
    issue: string
  ): Promise<DispatchTargetListResponse> => {
    try {
      const response = await api.get<ResponseModel<DispatchTargetListResponse>>(
        `/dispatch-targets/${issue}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_DISPATCH_TARGETS");
      throw err;
    }
  },
};
