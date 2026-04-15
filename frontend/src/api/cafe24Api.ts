import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
  Cafe24ProductsResponse,
} from "../types/cafe24";

export type {
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
  Cafe24ProductsResponse,
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
};
