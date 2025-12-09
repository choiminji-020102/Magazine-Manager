import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import { AdminCreate, AdminResponse } from "./adminApi";

// 타입 정의
export interface LoginRequest {
  email: string;
  plain_password: string;
}

export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string; // 기본값 "bearer"
}

export interface RefreshRequest {
  access_token: string;
  refresh_token: string;
}

export interface LogoutRequest {
  refresh_token: string;
}

// API 함수들
export const authAPI = {
  /**
   * 로그인
   * POST /auth/login
   */
  login: async (data: LoginRequest): Promise<TokenPairResponse> => {
    try {
      const response = await api.post<TokenPairResponse>("/auth/login", data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "LOGIN");
      throw err;
    }
  },

  /**
   * 토큰 갱신
   * POST /auth/refresh
   */
  refresh: async (data: RefreshRequest): Promise<TokenPairResponse> => {
    try {
      const response = await api.post<TokenPairResponse>("/auth/refresh", data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "REFRESH_TOKEN");
      throw err;
    }
  },

  /**
   * 로그아웃
   * POST /auth/logout
   */
  logout: async (data: LogoutRequest): Promise<void> => {
    try {
      await api.post("/auth/logout", data);
    } catch (err) {
      logApiError(err as any, "LOGOUT");
      throw err;
    }
  },

  /**
   * 최초 관리자 생성 (인증 불필요, 관리자가 없을 때만 사용 가능)
   * POST /auth/signup/init
   */
  initFirstAdmin: async (data: AdminCreate): Promise<AdminResponse> => {
    try {
      const response = await api.post<AdminResponse>("/auth/signup/init", data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "INIT_FIRST_ADMIN");
      throw err;
    }
  },
};
