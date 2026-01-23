import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  OrderChannel,
  OrderStatus,
  OrderResponse,
  OrderListResponse,
  OrderItemResponse,
  OrderDetailResponse,
  OrderCustomerInput,
  OrderAddressInput,
  OrderItemCreateInOrder,
  OrderCreate,
  OrderUpdate,
  OrderStatusUpdate,
} from "../types/order";
import type { PaginatedResponse, ResponseModel } from "../types/api";

// Re-export for backward compatibility
export type {
  OrderChannel,
  OrderStatus,
  OrderResponse,
  OrderListResponse,
  OrderItemResponse,
  OrderDetailResponse,
  OrderCustomerInput,
  OrderAddressInput,
  OrderItemCreateInOrder,
  OrderCreate,
  OrderUpdate,
  OrderStatusUpdate,
};

// API 함수들
export const orderAPI = {
  /**
   * 주문 목록 조회 (페이지네이션)
   * GET /orders?page=1&limit=20&search=&channel=&order_status=&start_date=&end_date=
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    channel?: string;
    order_status?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<OrderListResponse>> => {
    try {
      const response = await api.get<PaginatedResponse<OrderListResponse>>(
        "/orders",
        { params }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_ORDERS");
      throw err;
    }
  },

  /**
   * 채널별 주문 조회
   * GET /orders/channel/{channel}?page=1&limit=20&order_status=
   */
  getByChannel: async (
    channel: string,
    params?: {
      page?: number;
      limit?: number;
      order_status?: string;
    }
  ): Promise<PaginatedResponse<OrderListResponse>> => {
    try {
      const response = await api.get<PaginatedResponse<OrderListResponse>>(
        `/orders/channel/${channel}`,
        { params }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDERS_BY_CHANNEL");
      throw err;
    }
  },

  /**
   * 외부 주문번호로 주문 조회
   * GET /orders/external/{external_order_id}
   */
  getByExternalId: async (
    externalOrderId: string
  ): Promise<OrderDetailResponse> => {
    try {
      const response = await api.get<ResponseModel<OrderDetailResponse>>(
        `/orders/external/${encodeURIComponent(externalOrderId)}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDER_BY_EXTERNAL_ID");
      throw err;
    }
  },

  /**
   * 특정 주문 조회
   * GET /orders/{order_id}
   */
  getById: async (orderId: number): Promise<OrderDetailResponse> => {
    try {
      const response = await api.get<ResponseModel<OrderDetailResponse>>(
        `/orders/${orderId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDER_BY_ID");
      throw err;
    }
  },

  /**
   * 주문 생성
   * POST /orders
   */
  create: async (data: OrderCreate): Promise<OrderDetailResponse> => {
    try {
      const response = await api.post<ResponseModel<OrderDetailResponse>>(
        "/orders",
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_ORDER");
      throw err;
    }
  },

  /**
   * 주문 수정
   * PUT /orders/{order_id}
   */
  update: async (
    orderId: number,
    data: OrderUpdate
  ): Promise<OrderResponse> => {
    try {
      const response = await api.put<ResponseModel<OrderResponse>>(
        `/orders/${orderId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_ORDER");
      throw err;
    }
  },

  /**
   * 주문 상태 변경
   * PATCH /orders/{order_id}/status
   */
  updateStatus: async (
    orderId: number,
    data: OrderStatusUpdate
  ): Promise<OrderResponse> => {
    try {
      const response = await api.patch<ResponseModel<OrderResponse>>(
        `/orders/${orderId}/status`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_ORDER_STATUS");
      throw err;
    }
  },

  /**
   * 주문 취소
   * PATCH /orders/{order_id}/cancel
   */
  cancel: async (orderId: number): Promise<OrderResponse> => {
    try {
      const response = await api.patch<ResponseModel<OrderResponse>>(
        `/orders/${orderId}/cancel`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CANCEL_ORDER");
      throw err;
    }
  },

  /**
   * 주문별 발송 목록
   * GET /orders/{order_id}/sends
   */
  getSends: async (orderId: number): Promise<any[]> => {
    try {
      const response = await api.get<ResponseModel<any[]>>(
        `/orders/${orderId}/sends`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ORDER_SENDS");
      throw err;
    }
  },
};
