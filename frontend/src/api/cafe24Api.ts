import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  Cafe24OAuthStartRequest,
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
  Cafe24OAuthRefreshResponse,
} from "../types/cafe24";

// Re-export for backward compatibility
export type {
  Cafe24OAuthStartRequest,
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
  Cafe24OAuthRefreshResponse,
};

// API 함수들
export const cafe24API = {
  /**
   * OAuth 시작
   * POST /cafe24/oauth/start
   */
  startOAuth: async (
    data: Cafe24OAuthStartRequest
  ): Promise<Cafe24OAuthStartResponse> => {
    try {
      const response = await api.post<Cafe24OAuthStartResponse>(
        "/cafe24/oauth/start",
        data
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_OAUTH_START");
      throw err;
    }
  },

  /**
   * OAuth 상태 조회
   * GET /cafe24/oauth/status/{mall_id}
   */
  getStatus: async (mallId: string): Promise<Cafe24TokenStatusResponse> => {
    try {
      const response = await api.get<Cafe24TokenStatusResponse>(
        `/cafe24/oauth/status/${encodeURIComponent(mallId)}`
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_STATUS");
      throw err;
    }
  },

  /**
   * OAuth 토큰 갱신
   * POST /cafe24/oauth/refresh/{mall_id}
   */
  refreshToken: async (
    mallId: string
  ): Promise<Cafe24OAuthRefreshResponse> => {
    try {
      const response = await api.post<Cafe24OAuthRefreshResponse>(
        `/cafe24/oauth/refresh/${encodeURIComponent(mallId)}`
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_REFRESH_TOKEN");
      throw err;
    }
  },

  /**
   * Cafe24 상품 목록 조회
   * GET /cafe24/admin/products?mall_id=
   */
  getProducts: async (
    mallId: string,
    params?: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.get("/cafe24/admin/products", {
        params: { mall_id: mallId, ...params },
      });
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_GET_PRODUCTS");
      throw err;
    }
  },

  /**
   * Cafe24 상품 생성
   * POST /cafe24/admin/products?mall_id=
   */
  createProduct: async (
    mallId: string,
    payload: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.post(
        "/cafe24/admin/products",
        payload,
        {
          params: { mall_id: mallId },
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_CREATE_PRODUCT");
      throw err;
    }
  },

  /**
   * Cafe24 상품 수정
   * PUT /cafe24/admin/products/{product_no}?mall_id=
   */
  updateProduct: async (
    mallId: string,
    productNo: number,
    payload: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.put(
        `/cafe24/admin/products/${productNo}`,
        payload,
        {
          params: { mall_id: mallId },
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_UPDATE_PRODUCT");
      throw err;
    }
  },

  /**
   * Cafe24 상품 삭제
   * DELETE /cafe24/admin/products/{product_no}?mall_id=
   */
  deleteProduct: async (
    mallId: string,
    productNo: number
  ): Promise<any> => {
    try {
      const response = await api.delete(
        `/cafe24/admin/products/${productNo}`,
        {
          params: { mall_id: mallId },
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_DELETE_PRODUCT");
      throw err;
    }
  },

  /**
   * Cafe24 주문 목록 조회
   * GET /cafe24/admin/orders?mall_id=
   */
  listOrders: async (
    mallId: string,
    params?: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.get("/cafe24/admin/orders", {
        params: { mall_id: mallId, ...params },
      });
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_ORDERS_LIST");
      throw err;
    }
  },

  /**
   * Cafe24 주문 조회
   * GET /cafe24/admin/orders/{order_id}?mall_id=
   */
  getOrder: async (
    mallId: string,
    orderId: string,
    params?: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.get(
        `/cafe24/admin/orders/${encodeURIComponent(orderId)}`,
        {
          params: { mall_id: mallId, ...params },
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_ORDERS_GET");
      throw err;
    }
  },

  /**
   * Cafe24 주문 개수 조회
   * GET /cafe24/admin/orders/count?mall_id=
   */
  getOrdersCount: async (
    mallId: string,
    params?: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.get("/cafe24/admin/orders/count", {
        params: { mall_id: mallId, ...params },
      });
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_ORDERS_COUNT");
      throw err;
    }
  },

  /**
   * Cafe24 주문 상태 일괄 변경
   * PUT /cafe24/admin/orders?mall_id=
   */
  updateOrdersStatus: async (
    mallId: string,
    payload: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.put(
        "/cafe24/admin/orders",
        payload,
        {
          params: { mall_id: mallId },
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_ORDERS_UPDATE_BULK");
      throw err;
    }
  },

  /**
   * Cafe24 주문 상태 변경
   * PUT /cafe24/admin/orders/{order_id}?mall_id=
   */
  updateOrderStatus: async (
    mallId: string,
    orderId: string,
    payload: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.put(
        `/cafe24/admin/orders/${encodeURIComponent(orderId)}`,
        payload,
        {
          params: { mall_id: mallId },
        }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_ORDERS_UPDATE_ONE");
      throw err;
    }
  },
};
