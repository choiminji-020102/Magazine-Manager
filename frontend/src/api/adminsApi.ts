import api from "./axios";
import { logApiError } from "../utils/errorHandler";
import type {
  AdminResponse,
  AdminCreate,
  AdminUpdate,
  AdminActivateRequest,
  AdminPasswordChange,
} from "../types/admin";
import { AdminRole } from "../types/admin";
import type { PaginatedResponse, ResponseModel } from "../types/api";

// Re-export for backward compatibility
export { AdminRole };
export type {
  AdminResponse,
  AdminCreate,
  AdminUpdate,
  AdminActivateRequest,
  AdminPasswordChange,
};

// API 함수들
export const adminAPI = {
  /**
   * 관리자 목록 조회 (페이지네이션)
   * GET /admins?page=1&limit=20&search=&role=
   */
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<PaginatedResponse<AdminResponse>> => {
    try {
      const response = await api.get<PaginatedResponse<AdminResponse>>(
        "/admins",
        { params }
      );
      return response.data;
    } catch (err) {
      logApiError(err as any, "GET_ALL_ADMINS");
      throw err;
    }
  },

  /**
   * 특정 관리자 조회
   * GET /admins/{admin_id}
   */
  getById: async (adminId: number): Promise<AdminResponse> => {
    try {
      const response = await api.get<ResponseModel<AdminResponse>>(
        `/admins/${adminId}`
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "GET_ADMIN_BY_ID");
      throw err;
    }
  },

  /**
   * 관리자 생성 (SUPER_ADMIN만 가능)
   * POST /admins
   */
  create: async (data: AdminCreate): Promise<AdminResponse> => {
    try {
      const response = await api.post<ResponseModel<AdminResponse>>(
        "/admins",
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "CREATE_ADMIN");
      throw err;
    }
  },

  /**
   * 관리자 수정
   * PUT /admins/{admin_id}
   */
  update: async (
    adminId: number,
    data: AdminUpdate
  ): Promise<AdminResponse> => {
    try {
      const response = await api.put<ResponseModel<AdminResponse>>(
        `/admins/${adminId}`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "UPDATE_ADMIN");
      throw err;
    }
  },

  /**
   * 관리자 삭제 (SUPER_ADMIN만 가능, 자기 자신 삭제 불가)
   * DELETE /admins/{admin_id}
   */
  delete: async (adminId: number): Promise<void> => {
    try {
      await api.delete(`/admins/${adminId}`);
    } catch (err) {
      logApiError(err as any, "DELETE_ADMIN");
      throw err;
    }
  },

  /**
   * 관리자 활성화/비활성화
   * PATCH /admins/{admin_id}/activate
   */
  activate: async (
    adminId: number,
    data: AdminActivateRequest
  ): Promise<{ is_active: boolean }> => {
    try {
      const response = await api.patch<ResponseModel<{ is_active: boolean }>>(
        `/admins/${adminId}/activate`,
        data
      );
      return response.data.data;
    } catch (err) {
      logApiError(err as any, "ACTIVATE_ADMIN");
      throw err;
    }
  },

  /**
   * 관리자 비밀번호 변경 (SUPER_ADMIN 전용)
   * PATCH /admins/{admin_id}/password
   */
  changePassword: async (
    adminId: number,
    data: AdminPasswordChange
  ): Promise<void> => {
    try {
      await api.patch(`/admins/${adminId}/password`, data);
    } catch (err) {
      logApiError(err as any, "CHANGE_ADMIN_PASSWORD");
      throw err;
    }
  },
};
