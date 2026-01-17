import api from "./axios";
import { logApiError } from "../utils/errorHandler";

// 타입 정의
export enum AdminRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
}

export interface AdminResponse {
  admin_id: number;
  email: string;
  admin_name: string;
  admin_role: AdminRole;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AdminCreate {
  email: string;
  plain_password: string;
  admin_name: string;
  admin_role: AdminRole;
  is_active: boolean;
}

export interface AdminUpdate {
  email?: string;
  plain_password?: string;
  admin_name?: string;
  admin_role?: AdminRole;
  is_active?: boolean;
}

// API 함수들
export const adminAPI = {
  /**
   * 모든 관리자 조회
   * GET /admin
   */
  getAll: async (): Promise<AdminResponse[]> => {
    try {
      const response = await api.get<AdminResponse[]>("/admin");
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_ADMINS");
      throw err;
    }
  },

  /**
   * 현재 로그인한 관리자 조회
   * GET /admin/me
   */
  getMe: async (): Promise<AdminResponse> => {
    try {
      const response = await api.get<AdminResponse>("/admin/me");
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_CURRENT_ADMIN");
      throw err;
    }
  },

  /**
   * 특정 관리자 조회
   * GET /admin/{admin_id}
   */
  getById: async (adminId: number): Promise<AdminResponse> => {
    try {
      const response = await api.get<AdminResponse>(`/admin/${adminId}`);
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ADMIN_BY_ID");
      throw err;
    }
  },

  /**
   * 관리자 생성 (SUPER_ADMIN만 가능)
   * POST /admin
   */
  create: async (data: AdminCreate): Promise<AdminResponse> => {
    try {
      const response = await api.post<AdminResponse>("/admin", data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "CREATE_ADMIN");
      throw err;
    }
  },

  /**
   * 관리자 수정
   * POST /admin/{admin_id}
   */
  update: async (
    adminId: number,
    data: AdminUpdate
  ): Promise<AdminResponse> => {
    try {
      const response = await api.post<AdminResponse>(`/admin/${adminId}`, data);
      return response.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_ADMIN");
      throw err;
    }
  },

  /**
   * 관리자 삭제 (SUPER_ADMIN만 가능, 자기 자신 삭제 불가)
   * DELETE /admin/{admin_id}
   */
  delete: async (adminId: number): Promise<void> => {
    try {
      await api.delete(`/admin/${adminId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_ADMIN");
      throw err;
    }
  },
};
