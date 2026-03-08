import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  LoginRequest,
  TokenPairResponse,
  RefreshRequest,
  LogoutRequest,
  PasswordChangeRequest,
  AdminCreate,
  AdminResponse,
} from "../types/auth";

// Re-export for backward compatibility
export type {
  LoginRequest,
  TokenPairResponse,
  RefreshRequest,
  LogoutRequest,
  PasswordChangeRequest,
};

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
   * 관리자 존재 여부 확인 (인증 불필요)
   * GET /auth/check-admin-exists
   */
  checkAdminExists: async (): Promise<{ exists: boolean }> => {
    try {
      const response = await api.get<{ exists: boolean }>("/auth/check-admin-exists");
      return response.data;
    } catch (err) {
      logApiError(err as any, "CHECK_ADMIN_EXISTS");
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

  /**
   * 현재 로그인한 관리자 정보 조회
   * GET /auth/me
   */
  getMe: async (): Promise<AdminResponse> => {
    try {
      const response = await api.get<AdminResponse>("/auth/me");
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_CURRENT_ADMIN");
      throw err;
    }
  },

  /**
   * 현재 로그인한 관리자 비밀번호 변경
   * PUT /auth/password
   */
  changePassword: async (data: PasswordChangeRequest): Promise<void> => {
    try {
      await api.put("/auth/password", data);
    } catch (err) {
      logApiError(err as any, "CHANGE_PASSWORD");
      throw err;
    }
  },
};
