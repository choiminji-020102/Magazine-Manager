import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  Cafe24OAuthStartRequest,
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
} from "../types/cafe24";

export type {
  Cafe24OAuthStartRequest,
  Cafe24OAuthStartResponse,
  Cafe24TokenStatusResponse,
};

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
  ): Promise<Cafe24TokenStatusResponse> => {
    try {
      const response = await api.post<Cafe24TokenStatusResponse>(
        `/cafe24/oauth/refresh/${encodeURIComponent(mallId)}`
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "CAFE24_REFRESH_TOKEN");
      throw err;
    }
  },
};
