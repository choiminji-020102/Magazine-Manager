import api from "./axios";
import { logApiError } from "../utils/errorHandler";

export interface Cafe24OAuthStartRequest {
  mall_id: string;
  scopes: string[];
}

export interface Cafe24OAuthStartResponse {
  authorize_url: string;
}

export interface Cafe24TokenStatusResponse {
  mall_id: string;
  authorized: boolean;
  expires_at?: string | null;
  refresh_token_expires_at?: string | null;
  scopes: string[];
}

export const cafe24API = {
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
   * Cafe24 Admin API 호출 (GET)
   * GET /cafe24/admin/{mall_id}/{resource_path}
   */
  getAdmin: async (mallId: string): Promise<any> => {
    try {
      const response = await api.get("/cafe24/admin/products", {
        params: { mall_id: mallId },
      });
      console.log("Cafe24 Admin API Response:", response);
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_ADMIN_GET");
      throw err;
    }
  },

  createProduct: async (
    mallId: string,
    payload: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.post("/cafe24/admin/products", payload, {
        params: { mall_id: mallId },
      });
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_CREATE_PRODUCT");
      throw err;
    }
  },

  listOrders: async (
    mallId: string,
    params: Record<string, any>
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

  getOrder: async (
    mallId: string,
    orderId: string,
    params: Record<string, any>
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

  getOrdersCount: async (
    mallId: string,
    params: Record<string, any>
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

  updateOrdersStatus: async (
    mallId: string,
    payload: Record<string, any>
  ): Promise<any> => {
    try {
      const response = await api.put("/cafe24/admin/orders", payload, {
        params: { mall_id: mallId },
      });
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_ORDERS_UPDATE_BULK");
      throw err;
    }
  },

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
