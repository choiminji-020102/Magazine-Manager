import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
  Cafe24ProductsResponse,
  Cafe24OrdersResponse,
  Cafe24ProductImportRequest,
  Cafe24ProductImportResponse,
  Cafe24OrderDetail,
  Cafe24OrderImportRequest,
  Cafe24OrderImportResponse,
} from "../types/cafe24";

export type {
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
  Cafe24ProductsResponse,
  Cafe24OrdersResponse,
  Cafe24ProductImportRequest,
  Cafe24ProductImportResponse,
  Cafe24OrderDetail,
  Cafe24OrderImportRequest,
  Cafe24OrderImportResponse,
};

export const cafe24API = {
  /**
   * OAuth 시작
   * POST /cafe24/oauth/start
   */
  startOAuth: async (): Promise<Cafe24OAuthStartResponse> => {
    try {
      const response = await api.post<Cafe24OAuthStartResponse>(
        "/cafe24/oauth/start"
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_OAUTH_START");
      throw err;
    }
  },

  /**
   * OAuth 상태 조회
   * GET /cafe24/oauth/status
   */
  getStatus: async (): Promise<Cafe24TokenStatusResponse> => {
    try {
      const response = await api.get<Cafe24TokenStatusResponse>(
        "/cafe24/oauth/status"
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_STATUS");
      throw err;
    }
  },

  /**
   * OAuth 토큰 갱신
   * POST /cafe24/oauth/refresh
   */
  refreshToken: async (): Promise<Cafe24TokenStatusResponse> => {
    try {
      const response = await api.post<Cafe24TokenStatusResponse>(
        "/cafe24/oauth/refresh"
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_REFRESH_TOKEN");
      throw err;
    }
  },

  /**
   * Cafe24 주문 목록 조회
   * GET /cafe24/orders/?start_date=...&end_date=...
   */
  getOrders: async (startDate: string, endDate: string): Promise<Cafe24OrdersResponse> => {
    try {
      const response = await api.get<Cafe24OrdersResponse>(
        "/cafe24/orders/",
        { params: { start_date: startDate, end_date: endDate } }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_GET_ORDERS");
      throw err;
    }
  },

  /**
   * Cafe24 주문 상세 조회 (buyer + receivers + items)
   * GET /cafe24/orders/{order_id}/detail
   */
  getOrderDetail: async (orderId: string): Promise<Cafe24OrderDetail> => {
    try {
      const response = await api.get<Cafe24OrderDetail>(
        `/cafe24/orders/${orderId}/detail`
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_GET_ORDER_DETAIL");
      throw err;
    }
  },

  /**
   * Cafe24 상품 목록 조회
   * GET /cafe24/products/
   */
  getProducts: async (): Promise<Cafe24ProductsResponse> => {
    try {
      const response = await api.get<Cafe24ProductsResponse>(
        "/cafe24/products/"
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_GET_PRODUCTS");
      throw err;
    }
  },

  /**
   * Cafe24 상품 → DB 저장
   * POST /cafe24/products/import
   */
  importProducts: async (data: Cafe24ProductImportRequest): Promise<Cafe24ProductImportResponse> => {
    try {
      const response = await api.post<Cafe24ProductImportResponse>(
        "/cafe24/products/import",
        data
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_IMPORT_PRODUCTS");
      throw err;
    }
  },

  /**
   * Cafe24 주문 → DB 저장 (일괄)
   * POST /cafe24/orders/import
   */
  importOrders: async (data: Cafe24OrderImportRequest): Promise<Cafe24OrderImportResponse> => {
    try {
      const response = await api.post<Cafe24OrderImportResponse>(
        "/cafe24/orders/import",
        data
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_IMPORT_ORDERS");
      throw err;
    }
  },
};
